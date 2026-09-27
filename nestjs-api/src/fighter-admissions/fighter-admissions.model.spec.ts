import {
  activationResponseSchema,
  applicantApplicationSchema,
  applicationIdParamsSchema,
  assignCoachBodySchema,
  listApplicationsQuerySchema,
  recoveryEmailStatusSchema,
  staffApplicationSchema,
  submitApplicationBodySchema,
  submitAssessmentBodySchema,
  submitDecisionBodySchema,
} from './fighter-admissions.model.js';

describe('fighter-admissions Zod contracts', () => {
  const validAppId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const validCoachId = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
  const validGuestId = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';

  // ── submitApplicationBodySchema ───────────────────────────────────────────
  describe('submitApplicationBodySchema', () => {
    const validPayload = {
      firstName: 'Nguyen',
      lastName: 'Van A',
      dateOfBirth: '1995-05-20',
      weightClass: 'LIGHTWEIGHT',
      nationality: 'Vietnam',
      contactPhone: '+84987654321',
      trainingBackground: '3 years Muay Thai',
      competitionBackground: '5 amateur bouts',
      motivation: 'Aspire to become professional champion',
    };

    it('parses valid application payload', () => {
      const parsed = submitApplicationBodySchema.parse(validPayload);
      expect(parsed.firstName).toBe('Nguyen');
      expect(parsed.weightClass).toBe('LIGHTWEIGHT');
    });

    it('rejects payload with email injected (email is taken from session)', () => {
      expect(
        submitApplicationBodySchema.safeParse({
          ...validPayload,
          email: 'injected@example.com',
        }).success,
      ).toBe(false);
    });

    it('rejects invalid weight class', () => {
      expect(
        submitApplicationBodySchema.safeParse({
          ...validPayload,
          weightClass: 'SUPER_HEAVYWEIGHT',
        }).success,
      ).toBe(false);
    });

    it('rejects invalid date format', () => {
      expect(
        submitApplicationBodySchema.safeParse({
          ...validPayload,
          dateOfBirth: '20-05-1995',
        }).success,
      ).toBe(false);
    });

    it('allows omitting optional background fields', () => {
      const minimal = {
        firstName: 'Nguyen',
        lastName: 'Van B',
        dateOfBirth: '1998-10-15',
        weightClass: 'FEATHERWEIGHT',
      };
      expect(submitApplicationBodySchema.safeParse(minimal).success).toBe(true);
    });
  });

  // ── applicationIdParamsSchema ─────────────────────────────────────────────
  describe('applicationIdParamsSchema', () => {
    it('accepts valid UUID', () => {
      expect(
        applicationIdParamsSchema.parse({ id: validAppId }),
      ).toEqual({ id: validAppId });
    });

    it('rejects non-UUID string', () => {
      expect(
        applicationIdParamsSchema.safeParse({ id: 'not-a-uuid' }).success,
      ).toBe(false);
    });
  });

  // ── assignCoachBodySchema ─────────────────────────────────────────────────
  describe('assignCoachBodySchema', () => {
    it('accepts valid coach assignment with optional reason', () => {
      expect(
        assignCoachBodySchema.parse({
          coachId: validCoachId,
          reassignmentReason: 'Coach reallocated',
        }),
      ).toEqual({
        coachId: validCoachId,
        reassignmentReason: 'Coach reallocated',
      });
    });

    it('accepts valid coach assignment without reason', () => {
      expect(
        assignCoachBodySchema.parse({ coachId: validCoachId }),
      ).toEqual({ coachId: validCoachId });
    });

    it('rejects unknown properties', () => {
      expect(
        assignCoachBodySchema.safeParse({
          coachId: validCoachId,
          extraField: 'unknown',
        }).success,
      ).toBe(false);
    });
  });

  // ── submitAssessmentBodySchema ────────────────────────────────────────────
  describe('submitAssessmentBodySchema', () => {
    const validAssessment = {
      conclusion: 'PASS' as const,
      summary: 'Strong stand-up striking and cardio endurance.',
      criteria: [
        {
          criterionName: 'Striking accuracy',
          method: 'Heavy bag & pad work',
          observation: 'Accurate combinations, fast guard return',
          value: 8.5,
          unit: 'score/10',
          note: 'Ready for pro sparring',
        },
      ],
    };

    it('parses valid PASS assessment', () => {
      expect(submitAssessmentBodySchema.parse(validAssessment)).toEqual(
        validAssessment,
      );
    });

    it('parses valid FAIL assessment', () => {
      const fail = { ...validAssessment, conclusion: 'FAIL' as const };
      expect(submitAssessmentBodySchema.parse(fail).conclusion).toBe('FAIL');
    });

    it('rejects empty criteria list (min 1)', () => {
      expect(
        submitAssessmentBodySchema.safeParse({
          ...validAssessment,
          criteria: [],
        }).success,
      ).toBe(false);
    });

    it('rejects invalid conclusion', () => {
      expect(
        submitAssessmentBodySchema.safeParse({
          ...validAssessment,
          conclusion: 'MAYBE',
        }).success,
      ).toBe(false);
    });
  });

  // ── submitDecisionBodySchema ──────────────────────────────────────────────
  describe('submitDecisionBodySchema', () => {
    it('parses APPROVED decision with reason', () => {
      expect(
        submitDecisionBodySchema.parse({
          decision: 'APPROVED',
          reason: 'Meets all technical and fitness thresholds',
        }),
      ).toEqual({
        decision: 'APPROVED',
        reason: 'Meets all technical and fitness thresholds',
      });
    });

    it('parses REJECTED decision with reason', () => {
      expect(
        submitDecisionBodySchema.parse({
          decision: 'REJECTED',
          reason: 'Medical clearance not provided',
        }),
      ).toEqual({
        decision: 'REJECTED',
        reason: 'Medical clearance not provided',
      });
    });

    it('rejects empty or missing reason', () => {
      expect(
        submitDecisionBodySchema.safeParse({
          decision: 'APPROVED',
          reason: '   ',
        }).success,
      ).toBe(false);
    });
  });

  // ── listApplicationsQuerySchema ───────────────────────────────────────────
  describe('listApplicationsQuerySchema', () => {
    it('coerces and defaults pagination parameters', () => {
      const parsed = listApplicationsQuerySchema.parse({});
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(20);
    });

    it('accepts valid status filter', () => {
      const parsed = listApplicationsQuerySchema.parse({
        page: '2',
        limit: '50',
        status: 'SUBMITTED',
      });
      expect(parsed.page).toBe(2);
      expect(parsed.limit).toBe(50);
      expect(parsed.status).toBe('SUBMITTED');
    });

    it('rejects limit exceeding maximum 100', () => {
      expect(
        listApplicationsQuerySchema.safeParse({ limit: 150 }).success,
      ).toBe(false);
    });
  });

  // ── applicantApplicationSchema ────────────────────────────────────────────
  describe('applicantApplicationSchema', () => {
    const validApplicantView = {
      id: validAppId,
      status: 'SUBMITTED' as const,
      submittedAt: '2026-09-01T10:00:00.000Z',
      applicant: {
        email: 'applicant@example.com',
        firstName: 'An',
        lastName: 'Nguyen',
        dateOfBirth: '2000-01-01',
        weightClass: 'LIGHTWEIGHT' as const,
        nationality: 'VN',
        contactPhone: null,
        trainingBackground: null,
        competitionBackground: null,
        motivation: null,
      },
      assessment: null,
      decision: null,
      activation: null,
    };

    it('parses valid applicant view with null outcomes', () => {
      expect(applicantApplicationSchema.parse(validApplicantView)).toEqual(
        validApplicantView,
      );
    });

    it('parses applicant view with populated outcomes', () => {
      const populated = {
        ...validApplicantView,
        status: 'ACTIVATED' as const,
        assessment: {
          conclusion: 'PASS' as const,
          assessedAt: '2026-09-02T10:00:00.000Z',
        },
        decision: {
          decision: 'APPROVED' as const,
          decidedAt: '2026-09-03T10:00:00.000Z',
        },
        activation: {
          status: 'COMPLETED' as const,
        },
      };
      expect(applicantApplicationSchema.parse(populated)).toMatchObject({
        status: 'ACTIVATED',
        assessment: { conclusion: 'PASS' },
        decision: { decision: 'APPROVED' },
        activation: { status: 'COMPLETED' },
      });
    });
  });

  // ── staffApplicationSchema ────────────────────────────────────────────────
  describe('staffApplicationSchema', () => {
    it('parses staff view showing both applicant snapshot email and accountEmail', () => {
      const staffView = {
        id: validAppId,
        guestUserId: validGuestId,
        status: 'APPROVED' as const,
        submittedAt: '2026-09-01T10:00:00.000Z',
        applicant: {
          email: 'snapshot@example.com',
          firstName: 'An',
          lastName: 'Nguyen',
          dateOfBirth: '2000-01-01',
          weightClass: 'LIGHTWEIGHT' as const,
          nationality: null,
          contactPhone: null,
          trainingBackground: null,
          competitionBackground: null,
          motivation: null,
        },
        accountEmail: 'updated_account@example.com',
        currentAssignment: {
          id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
          coachId: validCoachId,
          assignedById: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
          startsAt: '2026-09-01T11:00:00.000Z',
          endsAt: null,
          endedById: null,
          endReason: null,
        },
        assignmentHistory: [],
        assessment: null,
        decision: null,
        activation: {
          status: 'PENDING' as const,
          recoveryAttempts: 1,
          attemptedAt: '2026-09-03T11:00:00.000Z',
          acceptedAt: '2026-09-03T11:00:01.000Z',
          completedAt: null,
        },
      };

      const parsed = staffApplicationSchema.parse(staffView);
      expect(parsed.applicant.email).toBe('snapshot@example.com');
      expect(parsed.accountEmail).toBe('updated_account@example.com');
      expect(parsed.activation?.recoveryAttempts).toBe(1);
    });
  });

  // ── activationResponseSchema ──────────────────────────────────────────────
  describe('activationResponseSchema', () => {
    it('parses valid activation response', () => {
      const res = {
        applicationId: validAppId,
        status: 'COMPLETED' as const,
        role: 'FIGHTER' as const,
        alreadyActive: false,
      };
      expect(activationResponseSchema.parse(res)).toEqual(res);
    });

    it('rejects role other than FIGHTER', () => {
      expect(
        activationResponseSchema.safeParse({
          applicationId: validAppId,
          status: 'COMPLETED',
          role: 'ADMIN',
          alreadyActive: false,
        }).success,
      ).toBe(false);
    });
  });

  // ── recoveryEmailStatusSchema ─────────────────────────────────────────────
  describe('recoveryEmailStatusSchema', () => {
    it('parses valid recovery email status', () => {
      const res = {
        applicationId: validAppId,
        accepted: true,
        recoveryAttempts: 2,
        attemptedAt: '2026-09-03T12:00:00.000Z',
      };
      expect(recoveryEmailStatusSchema.parse(res)).toEqual(res);
    });
  });
});
