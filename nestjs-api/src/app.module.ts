import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { JobsModule } from './jobs/jobs.module.js';
import { DatabaseModule } from './database/database.module.js';
import { DatasetExportModule } from './dataset-export/dataset-export.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { FighterAdmissionsModule } from './fighter-admissions/fighter-admissions.module.js';
import { FightersModule } from './fighters/fighters.module.js';
import { TrainingModule } from './training/training.module.js';
import { AuthorizationModule } from './authorization/authorization.module.js';
import { CoachesModule } from './coaches/coaches.module.js';
import { MedicalModule } from './medical/medical.module.js';
import { CoachingModule } from './coaching/coaching.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { resolveRedisConnection } from './shared/config/redis.config.js';
import { loadEnv } from './shared/config/env.js';
import { VideosModule } from './videos/videos.module.js';
import { GoalsModule } from './goals/goals.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // ConfigModule uses the validator's return value as the complete config.
      // Preserve unrelated service settings (Supabase, database, Redis, etc.)
      // while replacing the shared keys with their validated/coerced values.
      validate: (config) => ({ ...config, ...loadEnv(config) }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          ...resolveRedisConnection(config),
          maxRetriesPerRequest: null,
        },
      }),
    }),
    DatabaseModule,
    VideosModule,
    JobsModule,
    UsersModule,
    AuthModule,
    FightersModule,
    FighterAdmissionsModule,
    TrainingModule,
    AuthorizationModule,
    DatasetExportModule,
    CoachesModule,
    MedicalModule,
    CoachingModule,
    GoalsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
