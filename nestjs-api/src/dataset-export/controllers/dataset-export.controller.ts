import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { DatasetExportService } from '../services/dataset-export.service.js';
import {
  PromotionRequestDto,
  RevocationRequestDto,
} from '../dto/promotion-request.dto.js';
import { PromotionAuthGuard, AuthenticatedUser } from '../guards/promotion-auth.guard.js';

@Controller('internal')
@UseGuards(PromotionAuthGuard)
export class DatasetExportController {
  constructor(private readonly datasetExportService: DatasetExportService) {}

  @Post('dataset-exports/:exportId/promotions')
  @HttpCode(HttpStatus.CREATED)
  async promoteCandidate(
    @Param('exportId') exportId: string,
    @Body() dto: PromotionRequestDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @Req() req: Request,
  ) {
    if (dto.candidate.exportId !== exportId) {
      throw new BadRequestException(
        `Route exportId '${exportId}' does not match body candidate.exportId '${dto.candidate.exportId}'.`,
      );
    }
    const user = (req as any).user as AuthenticatedUser;
    return await this.datasetExportService.promoteCandidate(
      dto,
      idempotencyKey,
      user.actorId,
    );
  }

  @Get('dataset-exports/:exportId/promotion')
  @HttpCode(HttpStatus.OK)
  async getPromotionStatus(@Param('exportId') exportId: string) {
    return await this.datasetExportService.getPromotionStatus(exportId);
  }

  @Post('dataset-attestations/:attestationId/revoke')
  @HttpCode(HttpStatus.OK)
  async revokeAttestation(
    @Param('attestationId') attestationId: string,
    @Body() dto: RevocationRequestDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @Req() req: Request,
  ) {
    const user = (req as any).user as AuthenticatedUser;
    return await this.datasetExportService.revokeAttestation(
      attestationId,
      dto.reason,
      idempotencyKey,
      user.actorId,
    );
  }
}
