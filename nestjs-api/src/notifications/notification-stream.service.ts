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
  MAX_TIMER_DELAY_MS,
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

/** The only frame still written while a stream is closing. */
const CLOSING_FRAME_PREFIX = `event: ${NOTIFICATION_STREAM_EVENT.CLOSING}\ndata: `;

type StreamEvent =
  (typeof NOTIFICATION_STREAM_EVENT)[keyof typeof NOTIFICATION_STREAM_EVENT];

interface StreamConnection {
  readonly id: string;
  readonly userId: string;
  send(event: StreamEvent, data: Record<string, unknown>): void;
  close(reason: NotificationStreamCloseReason): void;
}

/** Scheduling only; the guard already verified the token. */
function readTokenExpiry(accessToken: string): number | undefined {
  try {
    const [, segment] = accessToken.split('.');
    if (!segment) return undefined;
    const claims: unknown = JSON.parse(
      Buffer.from(segment, 'base64url').toString('utf8'),
    );
    if (typeof claims !== 'object' || claims === null || !('exp' in claims)) {
      return undefined;
    }
    const { exp } = claims;
    return typeof exp === 'number' && Number.isFinite(exp)
      ? exp * 1000
      : undefined;
  } catch {
    return undefined;
  }
}

// Frames are written directly so a slow consumer is bounded by the socket buffer
// and no error reaches the JSON exception filter after headers are sent.
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

  // Every failing check runs before the first byte, so it still uses the error
  // envelope; `ready` is sent only once registered and the subscription is live.
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
    const clientGone = new AbortController();
    const onEarlyClose = () => clientGone.abort();
    response.once('close', onEarlyClose);
    let live: boolean;
    try {
      live = await this.distribution.waitUntilSubscribed(
        this.settings.SSE_SUBSCRIBE_TIMEOUT_MS,
        clientGone.signal,
      );
    } finally {
      response.off('close', onEarlyClose);
    }
    if (clientGone.signal.aborted || request.socket.destroyed) return;
    if (response.writableEnded) return;
    if (!live) throw notificationStreamUnavailable();
    // Re-checked after the await so concurrent opens cannot exceed the limit.
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

    const timers: NodeJS.Timeout[] = [];
    let state: 'open' | 'closing' | 'closed' = 'open';

    const release = () => {
      if (state === 'closed') return;
      state = 'closed';
      timers.forEach((timer) => clearTimeout(timer));
      timers.length = 0;
      response.off('close', release);
      this.unregister(connection);
    };

    // Discards buffered data so an unhealthy socket is freed now, not after a
    // flush that may never come.
    const terminate = (reason: NotificationStreamCloseReason) => {
      if (state === 'closed') return;
      this.logger.warn({ event: 'notification.stream_terminated', reason });
      release();
      response.destroy();
    };

    /** Single write path; never throws. */
    const write = (frame: string): boolean => {
      if (state !== 'open' && !frame.startsWith(CLOSING_FRAME_PREFIX)) {
        return false;
      }
      if (response.destroyed || response.writableEnded) {
        release();
        return false;
      }
      if (response.writableLength > this.settings.SSE_MAX_BUFFERED_BYTES) {
        terminate(NOTIFICATION_STREAM_CLOSE_REASON.SLOW_CONSUMER);
        return false;
      }
      try {
        response.write(frame);
        return true;
      } catch {
        terminate(NOTIFICATION_STREAM_CLOSE_REASON.TRANSPORT_ERROR);
        return false;
      }
    };

    const connection: StreamConnection = {
      id: randomUUID(),
      userId: user.id,
      send: (event, data) => {
        if (state !== 'open') return;
        write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      },
      close: (reason) => {
        if (state !== 'open') return;
        state = 'closing';
        timers.forEach((timer) => clearTimeout(timer));
        timers.length = 0;
        // Stays counted until the transport really closes; a stalled flush is
        // forced down after the grace period.
        if (
          !write(
            `${CLOSING_FRAME_PREFIX}${JSON.stringify({ reason })}\n\n`,
          )
        ) {
          return;
        }
        const grace = setTimeout(() => {
          if (state !== 'closed') terminate(reason);
        }, this.settings.SSE_CLOSE_GRACE_MS);
        grace.unref();
        response.once('close', () => clearTimeout(grace));
        try {
          response.end();
        } catch {
          terminate(NOTIFICATION_STREAM_CLOSE_REASON.TRANSPORT_ERROR);
        }
      },
    };

    // The response, not the request, closes on disconnect, flushed end or destroy().
    response.on('close', release);
    response.on('error', () =>
      terminate(NOTIFICATION_STREAM_CLOSE_REASON.TRANSPORT_ERROR),
    );
    this.register(connection);

    // Timer callbacks must never throw into the event loop.
    const guarded = (work: () => void) => () => {
      try {
        work();
      } catch {
        terminate(NOTIFICATION_STREAM_CLOSE_REASON.TRANSPORT_ERROR);
      }
    };
    const schedule = (timer: NodeJS.Timeout) => {
      timer.unref();
      timers.push(timer);
    };
    schedule(
      setInterval(
        guarded(() => connection.send(NOTIFICATION_STREAM_EVENT.HEARTBEAT, {})),
        this.settings.SSE_HEARTBEAT_MS,
      ),
    );
    // One check in flight so a slow auth backend cannot pile up calls.
    let revalidating = false;
    schedule(
      setInterval(
        guarded(() => {
          if (revalidating) return;
          revalidating = true;
          void this.revalidate(connection, accessToken).finally(() => {
            revalidating = false;
          });
        }),
        this.settings.SSE_REVALIDATE_MS,
      ),
    );
    schedule(
      setTimeout(
        guarded(() =>
          connection.close(
            closesAtExpiry
              ? NOTIFICATION_STREAM_CLOSE_REASON.TOKEN_EXPIRED
              : NOTIFICATION_STREAM_CLOSE_REASON.LIFETIME_REACHED,
          ),
        ),
        lifetimeMs,
      ),
    );

    write(`retry: ${this.settings.SSE_RETRY_MS}\n\n`);
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
    // Copy first: a send may terminate (and unregister) a slow connection.
    for (const set of [...this.connections.values()]) {
      for (const connection of [...set]) {
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
    // Copy first: a send may terminate (and unregister) a slow connection.
    for (const connection of [...set]) {
      connection.send(event, data);
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
