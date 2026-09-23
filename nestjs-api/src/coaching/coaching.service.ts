import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { sql, eq, and, desc, isNull } from 'drizzle-orm';
import * as crypto from 'node:crypto';
import { DRIZZLE, type DrizzleDB } from '../database/database.module.js';
import {
  users,
  coaches,
  fighters,
  coachFighters,
  trainingPlans,
  trainingSessions,
  videos,
  analysisJobs,
  aiAnalyses,
  coachReviews,
  fighterBaselines,
  auditLogs,
  actionAssessments,
  actionFindingReviews,
  techniqueReferences,
  progressSnapshots,
} from '../database/schema.js';
import {
  CreateAssignmentDto,
  UploadVideoDto,
  CreateAnalysisJobDto,
  PersistWorkerResultDto,
  ReviewFindingDto,
  CoachCorrectionDto,
  SelectReferenceDto,
  RevokeReferenceDto,
  CreateBaselineDto,
} from './dto/coaching.dto.js';

@Injectable()
export class CoachingService implements OnModuleInit {
  private readonly logger = new Logger(CoachingService.name);

  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  async onModuleInit() {
    const requiredTables = [
      'action_assessments',
      'action_finding_reviews',
      'technique_references',
      'progress_snapshots',
      'fighter_baselines',
      'algorithm_configs',
    ];

    try {
      const res = await this.db.execute(sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ANY(ARRAY[${sql.join(requiredTables.map((t) => sql`${t}`), sql`, `)}]);
      `);

      const rows = res.rows || res || [];
      const foundTables = new Set(rows.map((r: any) => r.table_name));
      const missing = requiredTables.filter((t) => !foundTables.has(t));

      if (missing.length > 0) {
        throw new Error(
          `CoachingService startup failed: required tables [${missing.join(', ')}] missing. Please run migration 005_coaching_loop_and_constraints.sql.`,
        );
      }

      this.logger.log('Coaching loop authoritative schema verified.');
    } catch (err: any) {
      this.logger.error(`Coaching loop schema verification failed: ${err.message}`, err.stack);
      throw err;
    }
  }

  // ─── Helper: RBAC Verification ─────────────────────────────────────────────

  async verifyCoachAuthorization(coachId: string, fighterId: string, tx?: any) {
    const client = tx || this.db;
    const assignment = await client
      .select()
      .from(coachFighters)
      .where(
        and(
          eq(coachFighters.coachId, coachId),
          eq(coachFighters.fighterId, fighterId),
          isNull(coachFighters.endsAt),
        ),
      )
      .limit(1);

    if (assignment.length === 0) {
      throw new ForbiddenException(
        `Coach '${coachId}' is not authorized or active for fighter '${fighterId}'.`,
      );
    }
    return assignment[0];
  }

  async getCoachByUserId(userId: string, tx?: any) {
    const client = tx || this.db;
    const [coach] = await client
      .select()
      .from(coaches)
      .where(eq(coaches.userId, userId))
      .limit(1);
    return coach || null;
  }

  async getFighterByUserId(userId: string, tx?: any) {
    const client = tx || this.db;
    const [fighter] = await client
      .select()
      .from(fighters)
      .where(eq(fighters.userId, userId))
      .limit(1);
    return fighter || null;
  }

  // ─── Helper: Audit Trail ───────────────────────────────────────────────────

  async logAudit(
    action: string,
    resourceType: string,
    resourceId: string | null,
    actorId: string | null,
    details: Record<string, any>,
    tx?: any,
  ) {
    const client = tx || this.db;
    let validUserId: string | null = null;

    if (actorId) {
      try {
        const user = await client
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, actorId))
          .limit(1);

        if (user.length > 0) {
          validUserId = user[0].id;
        } else {
          const coach = await client
            .select({ userId: coaches.userId })
            .from(coaches)
            .where(eq(coaches.id, actorId))
            .limit(1);

          if (coach.length > 0) {
            validUserId = coach[0].userId;
          } else {
            const fighter = await client
              .select({ userId: fighters.userId })
              .from(fighters)
              .where(eq(fighters.id, actorId))
              .limit(1);

            if (fighter.length > 0) {
              validUserId = fighter[0].userId;
            }
          }
        }
      } catch (err: any) {
        validUserId = null;
      }
    }

    await client.insert(auditLogs).values({
      action,
      resourceType,
      resourceId: resourceId || undefined,
      actorType: validUserId ? 'USER' : 'SYSTEM',
      actorUserId: validUserId || undefined,
      details,
      createdAt: new Date(),
    });
  }

  // ─── 1. Assignments and Training Sessions ──────────────────────────────────

  async createAssignment(dto: CreateAssignmentDto) {
    return await this.db.transaction(async (tx: any) => {
      // 1. Verify active coach-fighter relationship
      await this.verifyCoachAuthorization(dto.coachId, dto.fighterId, tx);

      // 2. Create training plan
      const planTitle = dto.planTitle || `Plan for ${dto.title}`;
      const [plan] = await tx
        .insert(trainingPlans)
        .values({
          fighterId: dto.fighterId,
          coachId: dto.coachId,
          title: planTitle,
          startDate: new Date().toISOString().split('T')[0],
          status: 'ACTIVE',
        })
        .returning();

      // 3. Create training session
      const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : new Date();
      const sessionType = (dto.sessionType as any) || 'SHADOW_BOXING';

      const [session] = await tx
        .insert(trainingSessions)
        .values({
          fighterId: dto.fighterId,
          planId: plan.id,
          title: dto.title,
          scheduledAt,
          sessionType,
          status: 'SCHEDULED',
        })
        .returning();

      await this.logAudit(
        'CREATE_ASSIGNMENT',
        'training_sessions',
        session.id,
        dto.coachId,
        { planId: plan.id, fighterId: dto.fighterId },
        tx,
      );

      return {
        planId: plan.id,
        sessionId: session.id,
        title: session.title,
        status: session.status,
        scheduledAt: session.scheduledAt,
      };
    });
  }

  // ─── 2. Video Upload & Analysis Job Creation ───────────────────────────────

  async uploadVideo(dto: UploadVideoDto, actorId?: string) {
    let uploader = actorId;
    if (!uploader) {
      const fighter = await this.db
        .select({ userId: fighters.userId })
        .from(fighters)
        .where(eq(fighters.id, dto.fighterId))
        .limit(1);
      uploader = fighter[0]?.userId;
    }

    if (!uploader) {
      throw new BadRequestException(`Unable to resolve user for fighter '${dto.fighterId}'.`);
    }

    const [video] = await this.db
      .insert(videos)
      .values({
        subjectFighterId: dto.fighterId,
        uploadedById: uploader,
        sessionId: dto.sessionId || null,
        title: dto.title,
        storageProvider: 'supabase',
        storageBucket: 'videos',
        storageKey: dto.storageKey,
        fileSizeBytes: dto.fileSizeBytes ? BigInt(dto.fileSizeBytes) : BigInt(1),
        mimeType: dto.mimeType || 'video/mp4',
        durationMs: dto.durationMs ?? null,
        cameraAngle: (dto.cameraAngle as any) || 'FRONT',
        status: 'UPLOAD_COMPLETE',
      })
      .returning();

    await this.logAudit('UPLOAD_VIDEO', 'videos', video.id, uploader, {
      fighterId: dto.fighterId,
      storageKey: dto.storageKey,
    });

    return video;
  }

  async createAnalysisJob(dto: CreateAnalysisJobDto, actorId?: string) {
    return await this.db.transaction(async (tx: any) => {
      let user = actorId;
      if (!user) {
        const fighter = await tx
          .select({ userId: fighters.userId })
          .from(fighters)
          .where(eq(fighters.id, dto.fighterId))
          .limit(1);
        user = fighter[0]?.userId;
      }

      if (!user) {
        throw new BadRequestException(`Unable to resolve user for fighter '${dto.fighterId}'.`);
      }

      // 1. Create analysis job
      const [job] = await tx
        .insert(analysisJobs)
        .values({
          videoId: dto.videoId,
          videoUrl: `https://storage.local/${dto.videoId}.mp4`,
          userId: user,
          status: 'PENDING',
        })
        .returning();

      let configId = dto.algorithmConfigId;
      if (!configId) {
        const configs = await tx.execute(
          sql`SELECT id FROM public.algorithm_configs WHERE is_active = true LIMIT 1`,
        );
        configId = configs.rows[0]?.id || '00000000-0000-0000-0000-000000000001';
      }

      const [analysis] = await tx
        .insert(aiAnalyses)
        .values({
          jobId: job.id,
          videoId: dto.videoId,
          fighterId: dto.fighterId,
          sessionId: dto.sessionId || null,
          algorithmConfigId: configId,
          status: 'QUEUED',
        })
        .returning();

      await this.logAudit('CREATE_ANALYSIS_JOB', 'analysis_jobs', job.id, user, {
        videoId: dto.videoId,
        analysisId: analysis.id,
      }, tx);

      return {
        jobId: job.id,
        analysisId: analysis.id,
        status: job.status,
      };
    });
  }

  // ─── 3. Non-Destructive Re-Analysis ────────────────────────────────────────

  async reanalyzeVideo(videoId: string, fighterId: string, actorId?: string) {
    return await this.db.transaction(async (tx: any) => {
      const existingVideo = await tx
        .select()
        .from(videos)
        .where(eq(videos.id, videoId))
        .limit(1);

      if (existingVideo.length === 0) {
        throw new NotFoundException(`Video '${videoId}' not found.`);
      }

      let user = actorId;
      if (!user) {
        const fighter = await tx
          .select({ userId: fighters.userId })
          .from(fighters)
          .where(eq(fighters.id, fighterId))
          .limit(1);
        user = fighter[0]?.userId;
      }

      // Non-destructive: Create a new video revision linked to the session
      const [newVideo] = await tx
        .insert(videos)
        .values({
          subjectFighterId: fighterId,
          uploadedById: user,
          sessionId: existingVideo[0].sessionId,
          title: `${existingVideo[0].title} (Reanalysis)`,
          storageProvider: existingVideo[0].storageProvider,
          storageBucket: existingVideo[0].storageBucket,
          storageKey: `${existingVideo[0].storageKey}_rev_${Date.now()}`,
          fileSizeBytes: existingVideo[0].fileSizeBytes,
          mimeType: existingVideo[0].mimeType,
          durationMs: existingVideo[0].durationMs,
          cameraAngle: existingVideo[0].cameraAngle,
          status: 'UPLOAD_COMPLETE',
        })
        .returning();

      // Re-analysis creates a NEW job and NEW analysis record without overwriting previous history
      const [newJob] = await tx
        .insert(analysisJobs)
        .values({
          videoId: newVideo.id,
          videoUrl: `https://storage.local/${newVideo.id}.mp4`,
          userId: user,
          status: 'PENDING',
        })
        .returning();

      const configs = await tx.execute(
        sql`SELECT id FROM public.algorithm_configs WHERE is_active = true LIMIT 1`,
      );
      const configId = configs.rows[0]?.id || '00000000-0000-0000-0000-000000000001';

      const [newAnalysis] = await tx
        .insert(aiAnalyses)
        .values({
          jobId: newJob.id,
          videoId: newVideo.id,
          fighterId,
          sessionId: existingVideo[0].sessionId || null,
          algorithmConfigId: configId,
          status: 'QUEUED',
        })
        .returning();

      await this.logAudit('REANALYZE_VIDEO', 'ai_analyses', newAnalysis.id, user || null, {
        previousVideoId: videoId,
        newVideoId: newVideo.id,
        newJobId: newJob.id,
      }, tx);

      return {
        reanalysis: true,
        jobId: newJob.id,
        analysisId: newAnalysis.id,
        newVideoId: newVideo.id,
        status: 'QUEUED',
      };
    });
  }

  // ─── 4. Persist Worker Result (Actions, Phases, Metrics, Criteria, Findings) ─

  async persistWorkerResult(dto: PersistWorkerResultDto, actorId?: string) {
    return await this.db.transaction(async (tx: any) => {
      // 1. Update analysis status
      const now = new Date();
      const startedAt = dto.provenance?.processingStartedAt
        ? new Date(dto.provenance.processingStartedAt)
        : now;
      const confidenceScore = dto.actions.length > 0
        ? dto.actions.reduce((acc, a) => acc + (a.confidence || 0), 0) / dto.actions.length
        : null;

      await tx
        .update(aiAnalyses)
        .set({
          status: 'COMPLETED',
          confidenceScore,
          processingStartedAt: startedAt,
          processingCompletedAt: now,
          updatedAt: now,
        })
        .where(eq(aiAnalyses.id, dto.analysisId));

      // 2. Update analysis job
      await tx
        .update(analysisJobs)
        .set({
          status: 'DONE',
          score: dto.overallScore ?? null,
          updatedAt: new Date(),
        })
        .where(eq(analysisJobs.id, dto.jobId));

      // 3. Persist actions
      const insertedActions = [];
      for (const action of dto.actions) {
        const [persisted] = await tx
          .insert(actionAssessments)
          .values({
            analysisId: dto.analysisId,
            actionId: action.actionId,
            technique: action.technique,
            limbSide: action.limbSide,
            assessmentStatus: action.assessmentStatus,
            overallScore: action.overallScore ?? null,
            grade: action.grade || null,
            confidence: action.confidence,
            rubricId: action.rubricId || null,
            evidence: action.evidence || {},
            phases: action.phases || {},
            kinematicFeatures: action.kinematicFeatures || {},
            criteriaScores: action.criteriaScores || {},
            findings: action.findings || [],
            provenance: dto.provenance || action.provenance || {},
          })
          .returning();
        insertedActions.push(persisted);
      }

      await this.logAudit(
        'PERSIST_WORKER_RESULT',
        'ai_analyses',
        dto.analysisId,
        actorId || null,
        {
          actionCount: dto.actions.length,
          overallScore: dto.overallScore,
        },
        tx,
      );

      return {
        persisted: true,
        analysisId: dto.analysisId,
        actionCount: insertedActions.length,
        actions: insertedActions,
      };
    });
  }

  // ─── 5. Finding Approval / Rejection ───────────────────────────────────────

  async reviewFinding(dto: ReviewFindingDto) {
    return await this.db.transaction(async (tx: any) => {
      // 1. Verify analysis exists and get fighterId
      const analysis = await tx
        .select()
        .from(aiAnalyses)
        .where(eq(aiAnalyses.id, dto.analysisId))
        .limit(1);

      if (analysis.length === 0) {
        throw new NotFoundException(`Analysis '${dto.analysisId}' not found.`);
      }

      // 2. Verify coach authorization
      await this.verifyCoachAuthorization(dto.coachId, analysis[0].fighterId, tx);

      // 3. Persist finding review
      const [review] = await tx
        .insert(actionFindingReviews)
        .values({
          analysisId: dto.analysisId,
          actionId: dto.actionId,
          findingId: dto.findingId,
          coachId: dto.coachId,
          status: dto.status,
          notes: dto.notes || null,
        })
        .returning();

      await this.logAudit(
        'REVIEW_FINDING',
        'action_finding_reviews',
        review.id,
        dto.coachId,
        {
          findingId: dto.findingId,
          actionId: dto.actionId,
          status: dto.status,
        },
        tx,
      );

      return review;
    });
  }

  // ─── 6. Append-Only Coach Correction Revisions ─────────────────────────────

  async submitCoachCorrection(dto: CoachCorrectionDto) {
    return await this.db.transaction(async (tx: any) => {
      const analysis = await tx
        .select()
        .from(aiAnalyses)
        .where(eq(aiAnalyses.id, dto.analysisId))
        .limit(1);

      if (analysis.length === 0) {
        throw new NotFoundException(`Analysis '${dto.analysisId}' not found.`);
      }

      await this.verifyCoachAuthorization(dto.coachId, analysis[0].fighterId, tx);

      // Enforce append-only revision rules matching SQL constraints:
      // revision 1 <=> supersedesId is null
      // revision > 1 <=> supersedesId is not null
      const revision = dto.revision || 1;

      if (revision === 1 && dto.supersedesId) {
        throw new BadRequestException('Revision 1 cannot have a supersedesId.');
      }
      if (revision > 1 && !dto.supersedesId) {
        throw new BadRequestException('Revisions > 1 must specify a valid supersedesId.');
      }

      if (dto.supersedesId) {
        const prev = await tx
          .select()
          .from(coachReviews)
          .where(eq(coachReviews.id, dto.supersedesId))
          .limit(1);

        if (prev.length === 0) {
          throw new NotFoundException(`Predecessor review '${dto.supersedesId}' not found.`);
        }
      }

      const [review] = await tx
        .insert(coachReviews)
        .values({
          analysisId: dto.analysisId,
          coachId: dto.coachId,
          reviewText: dto.reviewText,
          techniqueRating: dto.techniqueRating || null,
          correctedStrikeCounts: dto.correctedStrikeCounts || null,
          overridesAi: dto.overridesAi ?? false,
          revision,
          supersedesId: dto.supersedesId || null,
        })
        .returning();

      await this.logAudit(
        'COACH_CORRECTION_SUBMITTED',
        'coach_reviews',
        review.id,
        dto.coachId,
        {
          analysisId: dto.analysisId,
          revision,
          supersedesId: dto.supersedesId,
        },
        tx,
      );

      return review;
    });
  }

  // ─── 7. Reference Selection & Revocation ───────────────────────────────────

  async selectReference(dto: SelectReferenceDto) {
    return await this.db.transaction(async (tx: any) => {
      await this.verifyCoachAuthorization(dto.coachId, dto.fighterId, tx);

      const [ref] = await tx
        .insert(techniqueReferences)
        .values({
          fighterId: dto.fighterId,
          technique: dto.technique,
          actionId: dto.actionId,
          videoId: dto.videoId,
          sessionId: dto.sessionId || null,
          selectedById: dto.coachId,
          status: 'active',
        })
        .returning();

      await this.logAudit('SELECT_REFERENCE', 'technique_references', ref.id, dto.coachId, {
        fighterId: dto.fighterId,
        technique: dto.technique,
        actionId: dto.actionId,
      }, tx);

      return ref;
    });
  }

  async revokeReference(dto: RevokeReferenceDto) {
    return await this.db.transaction(async (tx: any) => {
      const existing = await tx
        .select()
        .from(techniqueReferences)
        .where(eq(techniqueReferences.id, dto.referenceId))
        .limit(1);

      if (existing.length === 0) {
        throw new NotFoundException(`Reference '${dto.referenceId}' not found.`);
      }

      await this.verifyCoachAuthorization(dto.coachId, existing[0].fighterId, tx);

      const [revoked] = await tx
        .update(techniqueReferences)
        .set({
          status: 'revoked',
          revokedById: dto.coachId,
          revokedAt: new Date(),
          revokedReason: dto.reason,
        })
        .where(eq(techniqueReferences.id, dto.referenceId))
        .returning();

      await this.logAudit('REVOKE_REFERENCE', 'technique_references', dto.referenceId, dto.coachId, {
        reason: dto.reason,
      }, tx);

      return revoked;
    });
  }

  // ─── 8. Baseline & Progress Snapshots ──────────────────────────────────────

  async createBaseline(dto: CreateBaselineDto) {
    const isApproved = !!dto.approvedById;
    const now = new Date();

    let sampleCount = dto.sampleCount ?? 0;
    try {
      const activeRefs = await this.db
        .select({ id: techniqueReferences.id })
        .from(techniqueReferences)
        .where(
          and(
            eq(techniqueReferences.fighterId, dto.fighterId),
            eq(techniqueReferences.technique, dto.techniqueType),
            eq(techniqueReferences.status, 'active'),
          ),
        );
      if (activeRefs.length > 0 && (!dto.sampleCount || dto.sampleCount === 0)) {
        sampleCount = activeRefs.length;
      }
    } catch {
      // fallback to dto.sampleCount
    }

    const sampleSessions = dto.sampleSessions ?? (sampleCount > 0 ? 1 : 0);
    const sourceDescription = dto.sourceDescription || (dto.approvedById ? 'Coach approved baseline snapshot' : 'Baseline snapshot');

    const [baseline] = await this.db
      .insert(fighterBaselines)
      .values({
        fighterId: dto.fighterId,
        algorithmConfigId: dto.algorithmConfigId,
        techniqueType: dto.techniqueType as any,
        limbSide: dto.limbSide as any,
        romBaselineDeg: dto.romBaselineDeg,
        velocityBaseline: dto.velocityBaseline,
        jerkThreshold: dto.jerkThreshold,
        covarianceMatrix: dto.covarianceMatrix || [],
        sampleCount,
        sampleSessions,
        sourceDescription,
        isLocked: isApproved,
        approvedById: dto.approvedById || null,
        approvedAt: isApproved ? now : null,
        isActive: true,
      })
      .returning();

    await this.logAudit('CREATE_BASELINE', 'fighter_baselines', baseline.id, dto.approvedById || null, {
      technique: dto.techniqueType,
      fighterId: dto.fighterId,
    });

    return baseline;
  }

  async recordProgressSnapshot(
    fighterId: string,
    technique: string,
    sessionId: string,
    score: number,
    trend: string,
    baselineId?: string,
  ) {
    const [snapshot] = await this.db
      .insert(progressSnapshots)
      .values({
        fighterId,
        technique,
        sessionId,
        baselineId: baselineId || null,
        movingAvgScore: score,
        trend,
        sampleCount: 1,
        metrics: { lastScore: score },
      })
      .returning();

    await this.logAudit('RECORD_PROGRESS_SNAPSHOT', 'progress_snapshots', snapshot.id, null, {
      fighterId,
      technique,
      score,
    });

    return snapshot;
  }

  // ─── 9. Comprehensive Coaching Loop State Query ────────────────────────────

  async getCoachingLoopState(fighterId: string, sessionId?: string) {
    const sessions = await this.db
      .select()
      .from(trainingSessions)
      .where(
        sessionId
          ? and(eq(trainingSessions.fighterId, fighterId), eq(trainingSessions.id, sessionId))
          : eq(trainingSessions.fighterId, fighterId),
      )
      .orderBy(desc(trainingSessions.scheduledAt))
      .limit(10);

    const activeReferences = await this.db
      .select()
      .from(techniqueReferences)
      .where(
        and(
          eq(techniqueReferences.fighterId, fighterId),
          eq(techniqueReferences.status, 'active'),
        ),
      );

    const baselines = await this.db
      .select()
      .from(fighterBaselines)
      .where(
        and(
          eq(fighterBaselines.fighterId, fighterId),
          eq(fighterBaselines.isActive, true),
        ),
      );

    return {
      fighterId,
      sessions,
      activeReferences,
      baselines,
    };
  }
}
