import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AppReadinessService } from './app-readiness.service.js';

describe('AppController', () => {
  let appController: AppController;
  const readiness = {
    status: 'ready',
    dependencies: { postgres: 'up', redis: 'up' },
    timestamp: '2026-09-21T00:00:00.000Z',
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: AppReadinessService,
          useValue: { check: vi.fn().mockResolvedValue(readiness) },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('ready', () => {
    it('returns dependency readiness', async () => {
      await expect(appController.getReady()).resolves.toEqual(readiness);
    });
  });
});
