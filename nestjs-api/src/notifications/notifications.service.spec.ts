import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { notificationNotFound } from './notifications.error.js';
import { NotificationsRepository } from './notifications.repo.js';
import { NotificationsService } from './notifications.service.js';

const actor: AuthenticatedUser = {
  id: '11111111-1111-4111-8111-111111111101',
  authSubject: '22222222-2222-4222-8222-222222222201',
  email: 'fighter@example.test',
  role: 'FIGHTER',
};

describe('NotificationsService', () => {
  const repository = {
    findPage: vi.fn(),
    findSummary: vi.fn(),
    transaction: vi.fn((work) => work({ execute: vi.fn() })),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  } as unknown as NotificationsRepository;
  const service = new NotificationsService(repository);

  it('maps persisted notification types to the frontend contract', async () => {
    vi.mocked(repository.findPage).mockResolvedValue({
      items: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          userId: actor.id,
          type: 'VIDEO_PROCESSED',
          title: 'Analysis ready',
          message: 'Review the latest result.',
          payload: { href: '/fighter/videos/video-1' },
          isRead: false,
          readAt: null,
          createdAt: new Date('2026-09-20T00:00:00.000Z'),
        },
      ],
      pageInfo: { hasNextPage: false, endCursor: null },
      total: 1,
    });

    await expect(service.list(actor, { limit: 50 })).resolves.toEqual({
      items: [
        expect.objectContaining({
          category: 'AI_ANALYSIS',
          severity: 'SUCCESS',
          body: 'Review the latest result.',
          href: '/fighter/videos/video-1',
          readAt: null,
        }),
      ],
      pageInfo: { hasNextPage: false, endCursor: null },
      total: 1,
    });
  });

  it('filters a category by the stored types presented under it', async () => {
    const emptyPage = {
      items: [],
      pageInfo: { hasNextPage: false, endCursor: null },
      total: 0,
    };
    vi.mocked(repository.findPage).mockResolvedValue(emptyPage);

    await service.list(actor, { category: 'AI_ANALYSIS', limit: 20 });
    expect(repository.findPage).toHaveBeenLastCalledWith(actor.id, {
      limit: 20,
      types: ['ANOMALY_HIGH', 'ANOMALY_MEDIUM', 'VIDEO_PROCESSED'],
    });

    await service.list(actor, { category: 'GOAL', limit: 20 });
    expect(repository.findPage).toHaveBeenLastCalledWith(actor.id, {
      limit: 20,
      types: [],
    });
  });

  it('fails visibly when the notification is outside the caller scope', async () => {
    vi.mocked(repository.markRead).mockResolvedValue(false);

    await expect(
      service.markRead(
        actor,
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'request-id',
      ),
    ).rejects.toEqual(notificationNotFound());
  });

  it('returns the number of unread notifications changed for the caller', async () => {
    vi.mocked(repository.markAllRead).mockResolvedValue(3);

    await expect(service.markAllRead(actor, 'request-id')).resolves.toEqual({
      count: 3,
    });
  });
});
