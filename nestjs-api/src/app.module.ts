import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { JobsModule } from './jobs/jobs.module.js';
import { DatabaseModule, readBoolean } from './database/database.module.js';
import { DatasetExportModule } from './dataset-export/dataset-export.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AppReadinessService } from './app-readiness.service.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { FightersModule } from './fighters/fighters.module.js';
import { TrainingModule } from './training/training.module.js';
import { AuthorizationModule } from './authorization/authorization.module.js';
import { NavigationModule } from './navigation/navigation.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { VideosModule } from './videos/videos.module.js';
import { StaffModule } from './staff/staff.module.js';
import { PerformanceModule } from './performance/performance.module.js';
import { GoalsModule } from './goals/goals.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');
        if (redisUrl) {
          const isTls = redisUrl.startsWith('rediss://');
          return {
            connection: {
              url: redisUrl,
              tls: isTls
                ? {
                    rejectUnauthorized: readBoolean(
                      config,
                      'REDIS_TLS_REJECT_UNAUTHORIZED',
                      true,
                    ),
                  }
                : undefined,
              maxRetriesPerRequest: null,
            },
          };
        }

        return {
          connection: {
            host: config.get('REDIS_HOST', 'localhost'),
            port: config.get<number>('REDIS_PORT', 6379),
            password: config.get('REDIS_PASSWORD') || undefined,
            maxRetriesPerRequest: null,
          },
        };
      },
    }),
    DatabaseModule,
    UsersModule,
    AuthModule,
    FightersModule,
    TrainingModule,
    AuthorizationModule,
    NavigationModule,
    NotificationsModule,
    VideosModule,
    StaffModule,
    PerformanceModule,
    GoalsModule,
    DatasetExportModule,
    JobsModule,
  ],
  controllers: [AppController],
  providers: [AppService, AppReadinessService],
})
export class AppModule {}
