import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { NavigationRepository } from './navigation.repo.js';
import { NavigationService } from './navigation.service.js';

const users: Record<AuthenticatedUser['role'], AuthenticatedUser> = {
  FIGHTER: {
    id: '11111111-1111-4111-8111-111111111101',
    authSubject: '22222222-2222-4222-8222-222222222201',
    email: 'fighter@example.test',
    role: 'FIGHTER',
  },
  COACH: {
    id: '11111111-1111-4111-8111-111111111106',
    authSubject: '22222222-2222-4222-8222-222222222206',
    email: 'coach@example.test',
    role: 'COACH',
  },
  DOCTOR: {
    id: '11111111-1111-4111-8111-111111111108',
    authSubject: '22222222-2222-4222-8222-222222222208',
    email: 'doctor@example.test',
    role: 'DOCTOR',
  },
  ADMIN: {
    id: '11111111-1111-4111-8111-111111111110',
    authSubject: '22222222-2222-4222-8222-222222222210',
    email: 'admin@example.test',
    role: 'ADMIN',
  },
};

describe('NavigationService', () => {
  const repository = {
    countUnreadNotifications: vi.fn().mockResolvedValue(3),
    countCoachReviewQueue: vi.fn().mockResolvedValue(2),
    countDoctorPendingAlerts: vi.fn().mockResolvedValue(4),
    countFailedJobs: vi.fn().mockResolvedValue(5),
  } as unknown as NavigationRepository;
  const service = new NavigationService(repository);

  it('returns only unread notifications for a fighter', async () => {
    await expect(service.getBadges(users.FIGHTER)).resolves.toEqual({
      notifications: 3,
    });
  });

  it('adds only the role-specific operational badge', async () => {
    await expect(service.getBadges(users.COACH)).resolves.toEqual({
      notifications: 3,
      reviewQueue: 2,
    });
    await expect(service.getBadges(users.DOCTOR)).resolves.toEqual({
      notifications: 3,
      newAlerts: 4,
    });
    await expect(service.getBadges(users.ADMIN)).resolves.toEqual({
      notifications: 3,
      failedJobs: 5,
    });
  });
});
