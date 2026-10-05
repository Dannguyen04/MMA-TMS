import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../database/database.module.js';
import { aiAnalyses, analysisJobs, fighters, movementEvidenceReviews, sessionExercises, trainingSessions } from '../database/schema.js';
import { AUTH_ACCESS_SERVICE, type AuthAccessService } from '../shared/contracts/auth-access.contract.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { VideoAccessService } from '../videos/video-access.service.js';
import { movementEvidenceSchema } from './movement-evidence.contract.js';
import { movementReviewSchema, type MovementReviewDto } from './movement-review.dto.js';
import { resultDigest } from './result-receipt.js';

@Injectable()
export class MovementReviewService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly access: VideoAccessService,
    @Inject(AUTH_ACCESS_SERVICE) private readonly permissions: AuthAccessService) {}

  private async authorize(actor: AuthenticatedUser, fighterId: string | null, write: boolean) {
    if (!fighterId || !['FIGHTER', 'COACH', 'DOCTOR', 'ADMIN'].includes(actor.role) ||
        (write && !['COACH', 'DOCTOR'].includes(actor.role)) ||
        !await this.permissions.hasPermissions(actor, { allOf: write ? ['movement.evidence:read', 'movement.evidence:review'] : ['movement.evidence:read'] })) {
      throw new ForbiddenException('Movement evidence access denied.');
    }
    await this.access.assertFighterAccess(actor, fighterId);
    const [fighter] = await this.db.select({ id: fighters.id }).from(fighters)
      .where(and(eq(fighters.id, fighterId), eq(fighters.isActive, true), isNull(fighters.deletedAt))).limit(1);
    if (!fighter) throw new ForbiddenException('The fighter is not active.');
  }

  async read(actor: AuthenticatedUser, jobId: string) {
    const [job] = await this.db.select().from(analysisJobs).where(eq(analysisJobs.id, jobId)).limit(1);
    if (!job) throw new NotFoundException('Analysis job not found.');
    await this.authorize(actor, job.fighterId, false);
    const reviews = await this.db.select().from(movementEvidenceReviews)
      .where(eq(movementEvidenceReviews.jobId, jobId)).orderBy(asc(movementEvidenceReviews.createdAt), asc(movementEvidenceReviews.revision));
    const canReview = ['COACH', 'DOCTOR'].includes(actor.role) &&
      await this.permissions.hasPermissions(actor, { allOf: ['movement.evidence:review'] });
    return { jobId, reviewerId: actor.id, canReview, context: job.evidenceContext,
      reviews: reviews.map(({ requestHash: _requestHash, ...review }) => review) };
  }

  async exercises(actor: AuthenticatedUser, sessionId: string) {
    const [session] = await this.db.select().from(trainingSessions).where(and(
      eq(trainingSessions.id, sessionId), eq(trainingSessions.isActive, true), isNull(trainingSessions.deletedAt))).limit(1);
    if (!session) throw new NotFoundException('Training session not found.');
    await this.authorize(actor, session.fighterId, false);
    return this.db.select({ id: sessionExercises.id, exerciseId: sessionExercises.exerciseId,
      name: sessionExercises.exerciseNameSnapshot }).from(sessionExercises)
      .where(eq(sessionExercises.sessionId, sessionId)).orderBy(asc(sessionExercises.orderIndex));
  }

  async append(actor: AuthenticatedUser, jobId: string, input: MovementReviewDto) {
    const parsed = movementReviewSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid movement review.');
    const dto = parsed.data;
    return this.db.transaction(async (tx) => {
      // Serialize all reviews for a job; revisions remain append-only under concurrency.
      const [job] = await tx.select().from(analysisJobs).where(eq(analysisJobs.id, jobId)).for('update');
      if (!job) throw new NotFoundException('Analysis job not found.');
      await this.authorize(actor, job.fighterId, true);
      const requestHash = resultDigest({ jobId, ...dto });
      const [replayed] = await tx.select().from(movementEvidenceReviews)
        .where(and(eq(movementEvidenceReviews.reviewerId, actor.id), eq(movementEvidenceReviews.requestId, dto.requestId))).limit(1);
      if (replayed) {
        if (replayed.requestHash !== requestHash) throw new ConflictException('This request ID was used for a different review.');
        return { id: replayed.id, revision: replayed.revision, replayed: true };
      }
      if (job.status !== 'DONE') throw new ConflictException('Wait for the analysis to complete.');
      const [analysis] = await tx.select().from(aiAnalyses).where(eq(aiAnalyses.jobId, jobId)).limit(1);
      const profile = analysis?.styleProfile as { movementEvidence?: unknown } | null;
      const report = movementEvidenceSchema.safeParse(profile?.movementEvidence);
      if (!report.success) throw new ConflictException('No valid persisted movement evidence exists for this job.');
      const window = report.data.windows.find((w) => w.id === dto.windowId);
      if (!window) throw new BadRequestException('The window does not belong to this report.');
      if (dto.decision === 'corrected' && (dto.startMs! < window.startMs || dto.endMs! > window.endMs)) {
        throw new BadRequestException('A corrected interval must stay inside the original evidence window.');
      }
      const [latest] = await tx.select().from(movementEvidenceReviews).where(and(
        eq(movementEvidenceReviews.jobId, jobId), eq(movementEvidenceReviews.windowId, dto.windowId),
        eq(movementEvidenceReviews.reviewerId, actor.id))).orderBy(desc(movementEvidenceReviews.revision)).limit(1);
      const previousRevision = latest?.revision ?? 0;
      if (dto.expectedRevision !== previousRevision) throw new ConflictException('Your review has changed. Reload the history before submitting.');
      const [saved] = await tx.insert(movementEvidenceReviews).values({ jobId, windowId: dto.windowId,
        reviewerId: actor.id, reviewerRole: actor.role, revision: previousRevision + 1,
        requestId: dto.requestId, requestHash, evidenceHash: resultDigest(report.data),
        decision: dto.decision, notes: dto.notes, startMs: dto.startMs ?? null, endMs: dto.endMs ?? null,
      }).returning();
      return { id: saved.id, revision: saved.revision, replayed: false };
    });
  }
}
