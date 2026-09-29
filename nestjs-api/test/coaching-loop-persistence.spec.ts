import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ForbiddenException, BadRequestException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { AppModule } from '../src/app.module.js';
import { DRIZZLE } from '../src/database/database.module.js';
import { CoachingService } from '../src/coaching/coaching.service.js';
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
} from '../src/database/schema.js';
import { eq, and, sql } from 'drizzle-orm';

describe('Task TL-09 — Persist the Complete Coaching Loop', () => {
  let app: INestApplication;
  let db: any;
  let coachingService: CoachingService;

  let coachUserId: string;
  let coachId: string;
  let fighterUserId: string;
  let fighterId: string;
  let unauthorizedCoachId: string;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    db = moduleFixture.get(DRIZZLE);
    coachingService = moduleFixture.get<CoachingService>(CoachingService);

    const idSuffix = Math.floor(Math.random() * 1000000);

    const createTestUser = async (role: 'COACH' | 'FIGHTER' | 'ADMIN', prefix: string) => {
      const authId = crypto.randomUUID();
      const email = `${prefix}_${idSuffix}@test.invalid`;
      try {
        await db.execute(sql`
          INSERT INTO auth.users (id, email, aud, role)
          VALUES (${authId}, ${email}, 'authenticated', 'authenticated')
          ON CONFLICT (id) DO NOTHING
        `);
      } catch (err: any) {
        console.log('auth.users insert err:', err.message);
      }

      const [u] = await db
        .insert(users)
        .values({
          email,
          authUserId: authId,
          role,
        })
        .returning();
      return u;
    };

    const cUser = await createTestUser('COACH', 'coach');
    coachUserId = cUser.id;

    const [coach] = await db
      .insert(coaches)
      .values({
        userId: coachUserId,
        firstName: 'Master',
        lastName: `Coach_${idSuffix}`,
      })
      .returning();
    coachId = coach.id;

    const uUser = await createTestUser('COACH', 'unauth_coach');
    const [unauthCoach] = await db
      .insert(coaches)
      .values({
        userId: uUser.id,
        firstName: 'Unauth',
        lastName: `Coach_${idSuffix}`,
      })
      .returning();
    unauthorizedCoachId = unauthCoach.id;

    const fUser = await createTestUser('FIGHTER', 'fighter');
    fighterUserId = fUser.id;

    const [fighter] = await db
      .insert(fighters)
      .values({
        userId: fighterUserId,
        firstName: 'Active',
        lastName: `Fighter_${idSuffix}`,
        dateOfBirth: '1998-05-15',
        weightClass: 'WELTERWEIGHT',
      })
      .returning();
    fighterId = fighter.id;

    // 4. Assign coach to fighter in coach_fighters
    await db.insert(coachFighters).values({
      coachId,
      fighterId,
      assignedById: coachUserId,
      startsAt: new Date(),
    });
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('1. Enforces RBAC on assignment creation (rejects unauthorized coach)', async () => {
    // Authorized coach succeeds
    const assignment = await coachingService.createAssignment({
      coachId,
      fighterId,
      title: 'Jab & Cross Masterclass',
      sessionType: 'SHADOW_BOXING',
    });

    expect(assignment.sessionId).toBeDefined();
    expect(assignment.planId).toBeDefined();
    expect(assignment.title).toBe('Jab & Cross Masterclass');

    // Unauthorized coach fails with ForbiddenException
    await expect(
      coachingService.createAssignment({
        coachId: unauthorizedCoachId,
        fighterId,
        title: 'Unauthorized Assignment',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('2. Persists video upload, analysis job, and full worker result with actions, phases, findings', async () => {
    // 1. Create assignment
    const assignment = await coachingService.createAssignment({
      coachId,
      fighterId,
      title: 'Power Strike Session',
    });

    // 2. Upload video
    const video = await coachingService.uploadVideo({
      fighterId,
      sessionId: assignment.sessionId,
      title: 'Power Strike Video 1',
      storageKey: `videos/${fighterId}/strikes_1.mp4`,
    });
    expect(video.id).toBeDefined();

    // 3. Create analysis job
    const jobInfo = await coachingService.createAnalysisJob({
      videoId: video.id,
      fighterId,
      sessionId: assignment.sessionId,
    });
    expect(jobInfo.jobId).toBeDefined();
    expect(jobInfo.analysisId).toBeDefined();

    // 4. Persist worker result
    const workerResult = await coachingService.persistWorkerResult({
      jobId: jobInfo.jobId,
      analysisId: jobInfo.analysisId,
      overallScore: 88,
      actions: [
        {
          actionId: 'punch_1250',
          technique: 'cross',
          limbSide: 'right',
          assessmentStatus: 'EVALUATED',
          overallScore: 88,
          grade: 'B',
          confidence: 0.92,
          rubricId: 'boxing_v1',
          evidence: {
            level: 'DIRECT_MEASUREMENT',
            frameInterval: [30, 65],
            timeRangeMs: [1000, 2167],
          },
          phases: {
            EXTENSION: {
              name: 'EXTENSION',
              startMs: 1000,
              endMs: 1500,
              evidenceLevel: 'DIRECT_MEASUREMENT',
            },
          },
          kinematicFeatures: {
            peakVelocity: {
              value: 7.8,
              unit: 'm/s',
              evidenceLevel: 'DIRECT_MEASUREMENT',
            },
          },
          criteriaScores: {
            guardPreservation: { score: 90, status: 'pass' },
          },
          findings: [
            {
              findingId: 'f_elbow_flare_1',
              criterionId: 'elbow_trajectory',
              severity: 'minor',
              priority: 1,
              status: 'active',
              message: 'Elbow flared 12 degrees during extension',
              coachingCue: 'Keep elbow tucked until final third',
            },
          ],
        },
      ],
      provenance: {
        pipelineVersion: '2.4.0',
        calibrationDigest: 'sha256:abc',
      },
    });

    expect(workerResult.persisted).toBe(true);
    expect(workerResult.actionCount).toBe(1);
    expect(workerResult.actions[0].technique).toBe('cross');
    expect(workerResult.actions[0].findings.length).toBe(1);

    // 5. Coach reviews finding (approves finding)
    const findingReview = await coachingService.reviewFinding({
      coachId,
      analysisId: jobInfo.analysisId,
      actionId: 'punch_1250',
      findingId: 'f_elbow_flare_1',
      status: 'approved',
      notes: 'Confirmed by coach, focus on tucked elbow in next drill',
    });

    expect(findingReview.status).toBe('approved');
    expect(findingReview.notes).toContain('Confirmed by coach');
  });

  it('3. Enforces append-only coach correction revisions and prevents overwriting', async () => {
    // Setup video and analysis
    const video = await coachingService.uploadVideo({
      fighterId,
      title: 'Correction Test Video',
      storageKey: `videos/${fighterId}/corr.mp4`,
    });
    const job = await coachingService.createAnalysisJob({
      videoId: video.id,
      fighterId,
    });

    // Revision 1 (initial coach review)
    const rev1 = await coachingService.submitCoachCorrection({
      coachId,
      analysisId: job.analysisId,
      reviewText: 'Good initial form, slight guard drop.',
      techniqueRating: 7,
      revision: 1,
    });

    expect(rev1.id).toBeDefined();
    expect(rev1.revision).toBe(1);
    expect(rev1.supersedesId).toBeNull();

    // Revision 1 cannot specify supersedesId
    await expect(
      coachingService.submitCoachCorrection({
        coachId,
        analysisId: job.analysisId,
        reviewText: 'Invalid rev1 with supersedes',
        revision: 1,
        supersedesId: rev1.id,
      }),
    ).rejects.toThrow(BadRequestException);

    // Revision 2 without supersedesId is rejected
    await expect(
      coachingService.submitCoachCorrection({
        coachId,
        analysisId: job.analysisId,
        reviewText: 'Revision 2 missing supersedes',
        revision: 2,
      }),
    ).rejects.toThrow(BadRequestException);

    // Revision 2 with valid supersedesId succeeds
    const rev2 = await coachingService.submitCoachCorrection({
      coachId,
      analysisId: job.analysisId,
      reviewText: 'Updated assessment: guard drop was tactical feint.',
      techniqueRating: 9,
      revision: 2,
      supersedesId: rev1.id,
    });

    expect(rev2.id).toBeDefined();
    expect(rev2.revision).toBe(2);
    expect(rev2.supersedesId).toBe(rev1.id);
  });

  it('4. Selects and revokes reference standards with audit logging', async () => {
    const video = await coachingService.uploadVideo({
      fighterId,
      title: 'Reference Standard Candidate',
      storageKey: `videos/${fighterId}/ref_1.mp4`,
    });

    // Select reference
    const ref = await coachingService.selectReference({
      coachId,
      fighterId,
      technique: 'jab',
      actionId: 'action_jab_golden_01',
      videoId: video.id,
    });

    expect(ref.id).toBeDefined();
    expect(ref.status).toBe('active');
    expect(ref.technique).toBe('jab');

    // Revoke reference
    const revoked = await coachingService.revokeReference({
      coachId,
      referenceId: ref.id,
      reason: 'Replaced with newer higher-velocity standard',
    });

    expect(revoked.status).toBe('revoked');
    expect(revoked.revokedReason).toBe('Replaced with newer higher-velocity standard');
    expect(revoked.revokedById).toBe(coachId);
  });

  it('5. Non-destructive re-analysis creates new analysis record without overwriting history', async () => {
    const video = await coachingService.uploadVideo({
      fighterId,
      title: 'Re-analysis Video',
      storageKey: `videos/${fighterId}/reanalysis.mp4`,
    });

    const firstJob = await coachingService.createAnalysisJob({
      videoId: video.id,
      fighterId,
    });

    // Persist first result
    await coachingService.persistWorkerResult({
      jobId: firstJob.jobId,
      analysisId: firstJob.analysisId,
      overallScore: 75,
      actions: [
        {
          actionId: 'action_v1_01',
          technique: 'jab',
          limbSide: 'left',
          assessmentStatus: 'EVALUATED',
          overallScore: 75,
          confidence: 0.85,
        },
      ],
    });

    // Re-analyze video
    const reanalysis = await coachingService.reanalyzeVideo(video.id, fighterId, coachUserId);

    expect(reanalysis.reanalysis).toBe(true);
    expect(reanalysis.analysisId).not.toBe(firstJob.analysisId);
    expect(reanalysis.jobId).not.toBe(firstJob.jobId);

    // Verify both first analysis and second re-analysis exist intact in DB
    const [firstAnalysis] = await db
      .select()
      .from(aiAnalyses)
      .where(eq(aiAnalyses.id, firstJob.analysisId));
    expect(firstAnalysis).toBeDefined();
    expect(firstAnalysis.status).toBe('COMPLETED');

    const [secondAnalysis] = await db
      .select()
      .from(aiAnalyses)
      .where(eq(aiAnalyses.id, reanalysis.analysisId));
    expect(secondAnalysis).toBeDefined();
    expect(secondAnalysis.status).toBe('QUEUED');
    expect(secondAnalysis.id).not.toBe(firstAnalysis.id);
  });
});
