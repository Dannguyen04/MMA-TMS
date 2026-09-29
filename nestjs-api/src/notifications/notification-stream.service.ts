import { randomUUID } from 'node:crypto';
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  AUTH_ACCESS_SERVICE,
  type AuthAccessService,
} from '../shared/contracts/auth-access.contract.js';
import { authenticationRequired } from '../shared/errors/access.error.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { NotificationDistributionService } from './notification-distribution.service.js';
import {
  NOTIFICATION_SIGNAL_KIND,
  NOTIFICATION_STREAM_CLOSE_REASON,
  NOTIFICATION_STREAM_EVENT,
  NOTIFICATIONS_CONFIG,
  type NotificationStreamCloseReason,
} from './notifications.constant.js';
import type { NotificationsConfig } from './notifications.config.js';
import {
  notificationStreamLimitReached,
  notificationStreamUnavailable,
} from './notifications.error.js';
import type { NotificationSignal } from './notifications.model.js';

/** setTimeout stores its delay as a signed 32-bit integer. */
const MAX_TIMER_DELAY_MS = 2_147_483_647;

type StreamEvent =
  (typeof NOTIFICATION_STREAM_EVENT)[keyof typeof NOTIFICATION_STREAM_EVENT];

interface StreamConnection {
  readonly id: string;
  readonly userId: string;
  send(event: StreamEvent, data: Record<string, unknown>): void;
  close(reason: NotificationStreamCloseReason): void;
}

/** Reads `exp` for scheduling only; the token was already verified by the guard. */
function readTokenExpiry(accessToken: string): number | undefined {
  try {
    const [, segment] = accessToken.split('.');
    if (!segment) return undefined;
    const claims = JSON.parse(
      Buffer.from(segment, 'base64url').toString('utf8'),
    ) as { exp?: unknown };
    return typeof claims.exp === 'number' ? claims.exp * 1000 : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Local Server-Sent Events connections of this API instance. One user may
 * hold several connections (tabs/devices); each closes independently. Frames
 * are written directly so a slow consumer is bounded by the socket buffer and
 * no error can reach the JSON exception filter after headers are sent.
 */
@Injectable()
export class NotificationStreamService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationStreamService.name);
  private readonly connections = new Map<string, Set<StreamConnection>>();
  private readonly teardown: Array<() => void> = [];

  constructor(
    private readonly distribution: NotificationDistributionService,
    @Inject(AUTH_ACCESS_SERVICE)
    private readonly authAccess: AuthAccessService,
    @Inject(NOTIFICATIONS_CONFIG)
    private readonly settings: NotificationsConfig,
  ) {}

  onModuleInit(): void {
    this.teardown.push(
      this.distribution.onSignal((signal) => this.route(signal)),
      this.distribution.onResync(() => this.broadcastResync()),
    );
  }

  onModuleDestroy(): void {
    this.teardown.splice(0).forEach((unsubscribe) => unsubscribe());
    for (const set of this.connections.values()) {
      for (const connection of [...set]) {
        connection.close(NOTIFICATION_STREAM_CLOSE_REASON.SERVER_SHUTDOWN);
      }
    }
  }

  /**
   * Opens a stream for the authenticated user. Every check that can fail runs
   * before the first byte is written, so those failures still use the error
   * envelope. `ready` is sent only after the connection is registered and the
   * signal subscription is live; the client loads the inbox after `ready`.
   */
  async open(
    user: AuthenticatedUser,
    accessToken: string,
    request: Request,
    response: Response,
  ): Promise<void> {
    const expiresAt = readTokenExpiry(accessToken);
    if (expiresAt !== undefined && expiresAt <= Date.now()) {
      throw authenticationRequired();
    }
    this.assertBelowConnectionLimit(user.id);
    if (
      !(await this.distribution.waitUntilSubscribed(
        this.settings.SSE_SUBSCRIBE_TIMEOUT_MS,
      ))
    ) {
      throw notificationStreamUnavailable();
    }
    // The client left while the subscription was awaited: nothing to open.
    if (request.socket.destroyed || response.writableEnded) return;
    // Re-checked after the wait so concurrent opens cannot exceed the limit.
    this.assertBelowConnectionLimit(user.id);

    const untilExpiry =
      expiresAt === undefined ? Infinity : expiresAt - Date.now();
    const closesAtExpiry = untilExpiry <= this.settings.SSE_MAX_LIFETIME_MS;
    const lifetimeMs = Math.max(
      0,
      Math.min(untilExpiry, this.settings.SSE_MAX_LIFETIME_MS, MAX_TIMER_DELAY_MS),
    );

    response.status(200);
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-store, no-transform');
    response.setHeader('Connection', 'keep-alive');
    // Disables response buffering in nginx-compatible proxies.
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders();
    response.write(`retry: ${this.settings.SSE_RETRY_MS}\n\n`);

    const timers: NodeJS.Timeout[] = [];
    let closed = false;
    const connection: StreamConnection = {
      id: randomUUID(),
      userId: user.id,
      send: (event, data) => {
        if (closed) return;
        if (response.writableLength > this.settings.SSE_MAX_BUFFERED_BYTES) {
          connection.close(NOTIFICATION_STREAM_CLOSE_REASON.SLOW_CONSUMER);
          return;
        }
        response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      },
      close: (reason) => {
        if (closed) return;
        if (response.writableLength <= this.settings.SSE_MAX_BUFFERED_BYTES) {
          response.write(
            `event: ${NOTIFICATION_STREAM_EVENT.CLOSING}\ndata: ${JSON.stringify({ reason })}\n\n`,
          );
        }
        cleanup();
        response.end();
      },
    };
    const cleanup = () => {
      if (closed) return;
      closed = true;
      timers.forEach((timer) => clearTimeout(timer));
      this.unregister(connection);
    };

    // The response (not the request) closes when the client goes away.
    response.on('close', cleanup);
    response.on('error', cleanup);
    this.register(connection);

    const schedule = (timer: NodeJS.Timeout) => {
      timer.unref();
      timers.push(timer);
    };
    schedule(
      setInterval(
        () => connection.send(NOTIFICATION_STREAM_EVENT.HEARTBEAT, {}),
        this.settings.SSE_HEARTBEAT_MS,
      ),
    );
    schedule(
      setInterval(
        () => void this.revalidate(connection, accessToken),
        this.settings.SSE_REVALIDATE_MS,
      ),
    );
    schedule(
      setTimeout(
        () =>
          connection.close(
            closesAtExpiry
              ? NOTIFICATION_STREAM_CLOSE_REASON.TOKEN_EXPIRED
              : NOTIFICATION_STREAM_CLOSE_REASON.LIFETIME_REACHED,
          ),
        lifetimeMs,
      ),
    );

    connection.send(NOTIFICATION_STREAM_EVENT.READY, {
      connectionId: connection.id,
    });
  }

  private assertBelowConnectionLimit(userId: string): void {
    if (
      (this.connections.get(userId)?.size ?? 0) >=
      this.settings.SSE_MAX_CONNECTIONS_PER_USER
    ) {
      throw notificationStreamLimitReached();
    }
  }

  private async revalidate(
    connection: StreamConnection,
    accessToken: string,
  ): Promise<void> {
    try {
      const current = await this.authAccess.authenticate(accessToken);
      if (current.id !== connection.userId) {
        connection.close(NOTIFICATION_STREAM_CLOSE_REASON.AUTH_REVOKED);
      }
    } catch {
      connection.close(NOTIFICATION_STREAM_CLOSE_REASON.AUTH_REVOKED);
    }
  }

  private route(signal: NotificationSignal): void {
    if (signal.kind === NOTIFICATION_SIGNAL_KIND.CREATED) {
      for (const delivery of signal.deliveries) {
        this.sendToUser(delivery.userId, NOTIFICATION_STREAM_EVENT.CREATED, {
          notificationId: delivery.notificationId,
        });
      }
      return;
    }
    this.sendToUser(signal.userId, NOTIFICATION_STREAM_EVENT.READ, {
      notificationId: signal.notificationId,
    });
  }

  private broadcastResync(): void {
    for (const set of this.connections.values()) {
      for (const connection of set) {
        connection.send(NOTIFICATION_STREAM_EVENT.RESYNC, {});
      }
    }
  }

  private sendToUser(
    userId: string,
    event: StreamEvent,
    data: Record<string, unknown>,
  ): void {
    const set = this.connections.get(userId);
    if (!set) return;
    // Copy first: a send may close (and unregister) a slow connection.
    for (const connection of [...set]) {
      try {
        connection.send(event, data);
      } catch {
        this.logger.warn('Closing a notification stream after a write error');
        connection.close(NOTIFICATION_STREAM_CLOSE_REASON.SLOW_CONSUMER);
      }
    }
  }

  private register(connection: StreamConnection): void {
    const set = this.connections.get(connection.userId) ?? new Set();
    set.add(connection);
    this.connections.set(connection.userId, set);
  }

  private unregister(connection: StreamConnection): void {
    const set = this.connections.get(connection.userId);
    if (!set) return;
    set.delete(connection);
    if (set.size === 0) this.connections.delete(connection.userId);
  }
}
