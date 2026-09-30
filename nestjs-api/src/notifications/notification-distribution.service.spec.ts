import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { EventEmitter } from 'node:events';
import { NotificationDistributionService } from './notification-distribution.service.js';
import {
  NOTIFICATION_CONFIG_DEFAULTS,
  NOTIFICATION_DISTRIBUTION_EVENT,
  NOTIFICATION_SIGNAL_CHANNEL,
} from './notifications.constant.js';

class MockRedisClient extends EventEmitter {
  status = 'ready';
  subscribe = vi.fn().mockResolvedValue(1);
  publish = vi.fn().mockResolvedValue(1);
  disconnect = vi.fn();
  quit = vi.fn().mockResolvedValue('OK');
}

let mockPublisher: MockRedisClient;
let mockSubscriber: MockRedisClient;

vi.mock('../shared/config/redis.config.js', () => ({
  resolveRedisConnection: vi.fn().mockReturnValue({ host: 'localhost', port: 6379 }),
  createRedisClient: vi.fn().mockImplementation((_opts, custom) => {
    if (custom?.autoResubscribe === false) {
      return mockSubscriber;
    }
    return mockPublisher;
  }),
  closeRedisClient: vi.fn().mockResolvedValue(undefined),
}));

describe('NotificationDistributionService (F4)', () => {
  let service: NotificationDistributionService;
  let configService: ConfigService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPublisher = new MockRedisClient();
    mockSubscriber = new MockRedisClient();
    configService = new ConfigService({});
    service = new NotificationDistributionService(
      configService,
      NOTIFICATION_CONFIG_DEFAULTS,
    );
  });

  it('disables autoResubscribe on subscriber Redis client', async () => {
    const { createRedisClient } = await import('../shared/config/redis.config.js');
    service.onModuleInit();

    expect(createRedisClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        autoResubscribe: false,
        enableOfflineQueue: false,
      }),
    );
  });

  it('reports not live when Redis emits ready but SUBSCRIBE has not confirmed', async () => {
    // Subscriber SUBSCRIBE does not resolve yet
    mockSubscriber.subscribe.mockReturnValue(new Promise(() => {}));

    service.onModuleInit();
    mockSubscriber.emit('ready');

    // Wait short time: should not be live
    const waitPromise = service.waitUntilSubscribed(50);
    await expect(waitPromise).resolves.toBe(false);
  });

  it('marks channel live and emits SUBSCRIBED without RESYNC on initial subscription', async () => {
    let subscribedEmitted = false;
    let resyncEmitted = false;

    service.onModuleInit();
    service.onResync(() => {
      resyncEmitted = true;
    });

    const waitPromise = service.waitUntilSubscribed(1000);

    mockSubscriber.emit('ready');

    const result = await waitPromise;
    expect(result).toBe(true);
    expect(resyncEmitted).toBe(false);
  });

  it('emits exactly one RESYNC after a successful reconnection subscription', async () => {
    let resyncCount = 0;

    service.onModuleInit();
    service.onResync(() => {
      resyncCount++;
    });

    // 1st initial connect
    mockSubscriber.emit('ready');
    await service.waitUntilSubscribed(1000);
    expect(resyncCount).toBe(0);

    // Connection drops
    mockSubscriber.emit('close');

    // 2nd connect (reconnection)
    mockSubscriber.emit('ready');
    await service.waitUntilSubscribed(1000);

    expect(resyncCount).toBe(1);
  });

  it('cancels stream wait when client aborts signal', async () => {
    // Subscription pending indefinitely
    mockSubscriber.subscribe.mockReturnValue(new Promise(() => {}));

    service.onModuleInit();
    mockSubscriber.emit('ready');

    const controller = new AbortController();
    const waitPromise = service.waitUntilSubscribed(5000, controller.signal);

    // Abort after 20ms
    setTimeout(() => controller.abort(), 20);

    const result = await waitPromise;
    expect(result).toBe(false);
  });

  it('ignores late SUBSCRIBE confirmation from an older connection generation', async () => {
    let delayedSubscribeResolve: () => void = () => {};
    mockSubscriber.subscribe.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          delayedSubscribeResolve = () => resolve(1);
        }),
    );

    service.onModuleInit();

    // Generation 1 starts
    mockSubscriber.emit('ready');

    // Before generation 1 confirms, connection drops and reconnects (Generation 2 starts)
    mockSubscriber.emit('close');
    mockSubscriber.emit('ready');

    // Now generation 1 belatedly resolves
    delayedSubscribeResolve();

    // Give microtasks time to run
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Current subscriber is generation 2 which was confirmed
    expect(await service.waitUntilSubscribed(100)).toBe(true);
  });

  it('safely handles non-JSON and invalid schema messages without crashing', () => {
    service.onModuleInit();

    // Invalid non-JSON
    expect(() => {
      mockSubscriber.emit('message', NOTIFICATION_SIGNAL_CHANNEL, 'NOT_JSON');
    }).not.toThrow();

    // Invalid schema
    expect(() => {
      mockSubscriber.emit(
        NOTIFICATION_SIGNAL_CHANNEL,
        JSON.stringify({ kind: 'UNKNOWN' }),
      );
    }).not.toThrow();
  });
});
