import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { JobsModule } from './jobs/jobs.module.js';
import { DatabaseModule } from './database/database.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { FightersModule } from './fighters/fighters.module.js';

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
              tls: isTls ? { rejectUnauthorized: false } : undefined,
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
    JobsModule,
    UsersModule,
    AuthModule,
    FightersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
