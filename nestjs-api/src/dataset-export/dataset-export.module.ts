import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module.js';
import { DatasetExportController } from './controllers/dataset-export.controller.js';
import { DatasetExportService } from './services/dataset-export.service.js';
import { AttestationSignerService } from './services/attestation-signer.service.js';
import { NonceStoreService } from './services/nonce-store.service.js';
import { AuthoritativeGovernanceService } from './services/authoritative-governance.service.js';
import { PromotionAuthGuard } from './guards/promotion-auth.guard.js';

@Module({
  imports: [ConfigModule, DatabaseModule],
  controllers: [DatasetExportController],
  providers: [
    DatasetExportService,
    AttestationSignerService,
    NonceStoreService,
    AuthoritativeGovernanceService,
    PromotionAuthGuard,
  ],
  exports: [
    DatasetExportService,
    AttestationSignerService,
    NonceStoreService,
    AuthoritativeGovernanceService,
  ],
})
export class DatasetExportModule {}
