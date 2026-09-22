import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { ObjectStorageService } from './object-storage.service.js';
import { VideosController } from './videos.controller.js';
import { VideosRepository } from './videos.repo.js';
import { VideosService } from './videos.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [VideosController],
  providers: [ObjectStorageService, VideosRepository, VideosService],
  exports: [ObjectStorageService, VideosRepository, VideosService],
})
export class VideosModule {}
