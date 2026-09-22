import { Test, type TestingModule } from '@nestjs/testing';
import type { Mocked } from 'vitest';
import { StaffRepository } from './staff.repo.js';
import { StaffService } from './staff.service.js';

function repositoryMock() {
  return {
    findCoaches: vi.fn(),
    findDoctors: vi.fn(),
    findCoachById: vi.fn(),
    findDoctorById: vi.fn(),
  };
}

describe('StaffService', () => {
  let service: StaffService;
  let repo: Mocked<StaffRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffService,
        { provide: StaffRepository, useValue: repositoryMock() },
      ],
    }).compile();
    service = module.get(StaffService);
    repo = module.get(StaffRepository);
  });

  it('returns a bounded coach page with continuation metadata', async () => {
    repo.findCoaches.mockResolvedValue({ data: [], total: 21 });

    await expect(service.listCoaches({ page: 2, limit: 10 })).resolves.toEqual({
      data: [],
      total: 21,
      hasNextPage: true,
    });
  });

  it('returns a bounded doctor page with continuation metadata', async () => {
    repo.findDoctors.mockResolvedValue({ data: [], total: 1 });

    await expect(service.listDoctors({ page: 1, limit: 20 })).resolves.toEqual({
      data: [],
      total: 1,
      hasNextPage: false,
    });
  });
});
