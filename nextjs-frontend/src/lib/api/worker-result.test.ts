    import { describe, expect, it } from "vitest";
import {
    actionSchema,
    analysisQualitySchema,
    anonymizedSampleSchema,
    coachingPlanSchema,
    datasetExportResultSchema,
    datasetManifestSchema,
    materializedActionViewSchema,
    parseWorkerResult,
    reviewAuditRecordSchema,
    sessionInsightsSchema,
    shadowClassificationSchema,
    standardFindingSchema,
    workerResultSchema,
} from "./worker-result";

describe("Worker Result Schema & Tasks 9-17 Extensions", () => {
    it("successfully parses minimal legacy worker result (backward compatibility)", () => {
        const legacyJson = {
            schemaVersion: "1.0.0",
            meta: {
                fps: 30,
                totalFrames: 100,
                durationMs: 3333.3,
            },
            frames: [],
            kicks: [],
        };
        const parsed = parseWorkerResult(legacyJson);
        expect(parsed).not.toBeNull();
        expect(parsed?.meta.fps).toBe(30);
        expect(parsed?.analysisQuality).toBeUndefined();
        expect(parsed?.sessionInsights).toBeUndefined();
        expect(parsed?.coachingPlan).toBeUndefined();
    });

    it("successfully validates Task 9-12 extended payload", () => {
        const extendedPayload = {
            schemaVersion: "1.0.0",
            meta: {
                fps: 30,
                totalFrames: 60,
                durationMs: 2000,
                imgWidth: 1280,
                imgHeight: 720,
            },
            frames: [],
            kicks: [],
            punches: [],
            analysisQuality: {
                status: "pass",
                reasonCodes: [],
                metrics: {
                    fps: 30,
                    durationMs: 2000,
                    totalFrames: 60,
                    missingFrameRatio: 0,
                    meanKeypointConfidence: 0.88,
                    upperBodyCoverage: 0.95,
                    lowerBodyCoverage: 0.90,
                    maxSimultaneousPersons: 1,
                    targetTrackRatio: 1.0,
                    imgWidth: 1280,
                    imgHeight: 720,
                },
                qualityVersion: "1.0.0",
                evaluatorVersion: "1.0.0",
                evaluatedAt: "2026-09-17T00:00:00Z",
                adjustedEvidenceLevel: "observed",
                recommendation: "proceed_full_analysis",
            },
            sessionInsights: {
                status: "completed",
                totalActions: 1,
                familyDistribution: { punch: 1 },
                techniqueDistribution: { cross: 1 },
                sideDistribution: { right: 1 },
                statusDistribution: { needs_improvement: 1 },
                coverageSummary: {
                    totalDetectedActions: 1,
                    assessedActionsCount: 1,
                    insufficientEvidenceCount: 0,
                    insufficientEvidenceRate: 0,
                    unknownTechniqueCount: 0,
                    unknownTechniqueRate: 0,
                    degradedQualityCount: 0,
                    degradedQualityRate: 0,
                },
                priorityFindings: [
                    {
                        rank: 1,
                        code: "TECH_PUNCH_GUARD_DROPPED",
                        title: "Hạ thấp tay thủ đối diện",
                        description: "Tay thủ hạ thấp",
                        severity: "critical",
                        frequency: 1,
                        priorityScore: 4.8,
                        affectedActionIds: ["act_1"],
                        representativeFrame: 25,
                        representativeTimeMs: 833.3,
                        primaryRecommendation: "Giữ găng sát cằm",
                    },
                ],
                sessionVersion: "1.0.0",
            },
            coachingPlan: {
                sessionStatus: "completed",
                recommendations: [
                    {
                        priorityRank: 1,
                        errorCode: "TECH_PUNCH_GUARD_DROPPED",
                        drill: {
                            drillId: "drill_guard_tennis_ball",
                            title: "Phone-to-Ear & Tennis Ball Guard Drill",
                            errorCode: "TECH_PUNCH_GUARD_DROPPED",
                            targetTechnique: "all_punches",
                            objective: "Găm chặt tay thủ đối diện bảo vệ hàm.",
                            instructions: ["Kẹp bóng tennis vào cằm", "Đấm 20 lần"],
                            safetyNote: "Giữ cổ thẳng",
                            applicability: "Mọi cấp độ",
                            contraindications: "Không áp dụng khi chóng mặt",
                            recommendedReps: "3 hiệp x 20 lần",
                            catalogVersion: "1.0.0",
                        },
                        athleteCue: "[Ưu tiên 1] Giữ găng sát cằm",
                        coachNotes: {
                            representativeFrame: 25,
                            severity: "critical",
                        },
                    },
                ],
                catalogVersion: "1.0.0",
                engineVersion: "1.0.0",
            },
        };

        const parsed = parseWorkerResult(extendedPayload);
        expect(parsed).not.toBeNull();
        expect(parsed?.analysisQuality?.status).toBe("pass");
        expect(parsed?.sessionInsights?.priorityFindings.length).toBe(1);
        expect(parsed?.coachingPlan?.recommendations.length).toBe(1);
    });

    it("handles coachingPlan recommendation with null drill (NO_APPROVED_DRILL abstention)", () => {
        const planWithNullDrill = {
            sessionStatus: "pass",
            recommendations: [
                {
                    priorityRank: 1,
                    errorCode: "TECH_UNKNOWN_CODE",
                    drill: null,
                    athleteCue: "[Ưu tiên 1] Lỗi kỹ thuật chưa có bài tập mẫu",
                    coachNotes: {
                        status: "NO_APPROVED_DRILL",
                        reason: "Unrecognized error code",
                    },
                },
            ],
            catalogVersion: "1.0.0",
            engineVersion: "1.0.0",
        };
        const parsed = coachingPlanSchema.safeParse(planWithNullDrill);
        expect(parsed.success).toBe(true);
        if (parsed.success) {
            expect(parsed.data.recommendations[0].drill).toBeNull();
            expect(parsed.data.recommendations[0].coachNotes.status).toBe("NO_APPROVED_DRILL");
        }
    });

    it("validates Task 10 StandardFinding schema", () => {
        const findingPayload = {
            id: "finding_001",
            code: "TECH_PUNCH_GUARD_DROPPED",
            errorCode: "TECH_PUNCH_GUARD_DROPPED",
            title: "Hạ thấp tay thủ",
            description: "Tay thủ hạ thấp dưới cằm khi ra đòn",
            category: "technique",
            scope: "action",
            severity: "critical",
            confidence: 0.92,
            evidenceLevel: "observed",
            evidenceRefs: [
                {
                    frameIdx: 15,
                    timeMs: 500.0,
                    metricName: "oppositeHandY",
                    metricValue: 0.65,
                    thresholdValue: 0.50,
                    operator: ">",
                    unit: "normalized_y",
                },
            ],
            provenance: {
                rubricId: "rubric_lead_jab_v3",
                criterionId: "guard_retention",
                rubricVersion: "3.0.0",
            },
            recommendation: "Kẹp bóng tennis vào cằm khi đấm",
            actionId: "act_101",
            legacyFindingId: "legacy_f_1",
            frameIdx: 15,
            timeMs: 500.0,
            metricName: "oppositeHandY",
            metricValue: 0.65,
        };
        const parsed = standardFindingSchema.safeParse(findingPayload);
        expect(parsed.success).toBe(true);
        if (parsed.success) {
            expect(parsed.data.code).toBe("TECH_PUNCH_GUARD_DROPPED");
            expect(parsed.data.evidenceRefs.length).toBe(1);
        }
    });

    it("validates Task 13 ReviewAuditRecord and MaterializedActionView schemas", () => {
        const auditRecord = {
            recordId: "audit_rec_1",
            actionId: "act_001",
            targetField: "technique",
            reviewAction: "correct",
            aiOriginalValue: "jab",
            correctedValue: "cross",
            reviewerId: "coach_dan",
            reviewerRole: "head_coach",
            reason: "Athlete threw rear cross with pivot",
            timestamp: "2026-09-17T02:00:00Z",
            idempotencyToken: "tok_001",
            version: "1.0.0",
        };
        const parsedAudit = reviewAuditRecordSchema.safeParse(auditRecord);
        expect(parsedAudit.success).toBe(true);

        const materializedView = {
            actionId: "act_001",
            aiOriginal: {
                id: "act_001",
                technique: "jab",
            },
            effectiveTechnique: "cross",
            effectiveAttackingSide: "right",
            effectiveLimbRole: "rear",
            effectivePhases: { startFrame: 0, endFrame: 30 },
            effectiveFindings: [],
            reviewStatus: "coach_corrected",
            auditTrail: [auditRecord],
            updatedAt: "2026-09-17T02:00:00Z",
        };
        const parsedView = materializedActionViewSchema.safeParse(materializedView);
        expect(parsedView.success).toBe(true);
        if (parsedView.success) {
            expect(parsedView.data.reviewStatus).toBe("coach_corrected");
            expect(parsedView.data.auditTrail.length).toBe(1);
        }
    });

    it("validates Task 14 DatasetManifest and DatasetExportResult schemas", () => {
        const sample = {
            sampleId: "s_abc123",
            athleteHash: "ath_hash_89",
            split: "train",
            technique: "cross",
            attackingSide: "right",
            limbRole: "rear",
            phases: { startFrame: 0, impactFrame: 15, endFrame: 30 },
            metrics: { peakSpeed: 12.5 },
            reviewStatus: "coach_approved",
            auditHash: "hash_audit_1",
            provenanceSource: "coach_review_v1",
        };
        const parsedSample = anonymizedSampleSchema.safeParse(sample);
        expect(parsedSample.success).toBe(true);

        const exportResult = {
            manifest: {
                datasetId: "ds_mma_2026",
                schemaVersion: "1.0.0",
                exportTimestamp: "2026-09-17T02:00:00Z",
                policy: "coach_approved_or_corrected",
                totalSamples: 1,
                splitDistribution: { train: 1 },
                techniqueDistribution: { cross: 1 },
                isGoldReady: false,
                status: "NOT_GOLD_READY",
                contentHash: "content_hash_1",
                datasetHash: "dataset_hash_1",
                notes: "Insufficient samples (<500)",
            },
            samples: [sample],
        };
        const parsedExport = datasetExportResultSchema.safeParse(exportResult);
        expect(parsedExport.success).toBe(true);
        if (parsedExport.success) {
            expect(parsedExport.data.manifest.status).toBe("NOT_GOLD_READY");
            expect(parsedExport.data.samples.length).toBe(1);
        }
    });

    it("validates ActionSchema with ShadowClassification including validationStatus", () => {
        const actionPayload = {
            id: "act_shadow_1",
            sourceActionId: "punch_1",
            family: "punch",
            technique: "jab",
            attackingSide: "left",
            limbRole: "lead",
            stance: "orthodox",
            confidence: {
                detection: 0.95,
                classification: 0.90,
                assessment: 0.85,
            },
            phases: {
                startFrame: 0,
                impactFrame: 15,
                endFrame: 30,
                startTimeMs: 0,
                impactTimeMs: 500,
                endTimeMs: 1000,
                impactType: "peak_extension_proxy",
            },
            metrics: {
                peakSpeed: { value: 8.5, unit: "m/s" },
            },
            assessment: {
                score: 88,
                grade: "good",
                status: "good",
            },
            review: {
                status: "ai_generated",
            },
            shadowClassification: {
                status: "abstained",
                candidate: null,
                confidence: null,
                reasonCodes: ["AMBIGUOUS_STANCE"],
                classifierId: "shadow_punch_classifier",
                classifierVersion: "1.0.0",
                configVersion: "1.0.0",
                featureVersion: "1.0.0",
                stanceSource: "classifier_input",
                evidenceLevel: "derived_proxy",
                validationStatus: "SHADOW_NOT_VALIDATED",
            },
        };
        const parsed = actionSchema.safeParse(actionPayload);
        expect(parsed.success).toBe(true);
        if (parsed.success) {
            expect(parsed.data.shadowClassification?.validationStatus).toBe("SHADOW_NOT_VALIDATED");
        }
    });

    it("strictly rejects invalid closed enums in reviewAuditRecordSchema", () => {
        const baseAudit = {
            recordId: "rec_1",
            actionId: "act_1",
            targetField: "technique",
            reviewAction: "accept",
            aiOriginalValue: "jab",
            correctedValue: null,
            reviewerId: "coach_1",
            reviewerRole: "coach",
            reason: "accurate",
            timestamp: "2026-09-17T00:00:00Z",
            idempotencyToken: "tok_1",
            version: "1.0.0",
        };

        // Valid singular phase and finding
        expect(reviewAuditRecordSchema.safeParse({ ...baseAudit, targetField: "phase" }).success).toBe(true);
        expect(reviewAuditRecordSchema.safeParse({ ...baseAudit, targetField: "finding" }).success).toBe(true);

        // Invalid plural or arbitrary strings rejected
        expect(reviewAuditRecordSchema.safeParse({ ...baseAudit, targetField: "phases" }).success).toBe(false);
        expect(reviewAuditRecordSchema.safeParse({ ...baseAudit, targetField: "findings" }).success).toBe(false);
        expect(reviewAuditRecordSchema.safeParse({ ...baseAudit, targetField: "invalid_field" }).success).toBe(false);

        // Invalid review action rejected
        expect(reviewAuditRecordSchema.safeParse({ ...baseAudit, reviewAction: "invalid_action" }).success).toBe(false);

        // Invalid reviewer role rejected
        expect(reviewAuditRecordSchema.safeParse({ ...baseAudit, reviewerRole: "unauthorized_role" }).success).toBe(false);
    });

    it("strictly rejects invalid closed enums in shadow classification and quality schemas", () => {
        expect(shadowClassificationSchema.safeParse({
            status: "arbitrary_status",
            candidate: null,
            reasonCodes: [],
            classifierId: "c1",
            classifierVersion: "1.0",
            configVersion: "1.0",
            featureVersion: "1.0",
            stanceSource: "s1",
            evidenceLevel: "observed",
        }).success).toBe(false);

        expect(analysisQualitySchema.safeParse({
            status: "arbitrary_quality",
            reasonCodes: [],
            metrics: {
                fps: 30,
                durationMs: 1000,
                totalFrames: 30,
                missingFrameRatio: 0,
                meanKeypointConfidence: 0.9,
                upperBodyCoverage: 0.9,
                lowerBodyCoverage: 0.9,
            },
            qualityVersion: "1.0",
            evaluatorVersion: "1.0",
            evaluatedAt: "2026-09-17T00:00:00Z",
            adjustedEvidenceLevel: "observed",
            recommendation: "ok",
        }).success).toBe(false);
    });

    it("strictly rejects invalid closed enums in reviewAuditRecordSchema", () => {
        const baseAudit = {
            recordId: "rec_1",
            actionId: "act_1",
            targetField: "technique",
            reviewAction: "accept",
            aiOriginalValue: "jab",
            correctedValue: null,
            reviewerId: "coach_1",
            reviewerRole: "coach",
            reason: "Looks good",
            timestamp: "2026-09-17T00:00:00Z",
            idempotencyToken: "tok_1",
            version: "1.0.0",
        };

        expect(reviewAuditRecordSchema.safeParse(baseAudit).success).toBe(true);
        expect(reviewAuditRecordSchema.safeParse({ ...baseAudit, reviewerRole: "head_coach" }).success).toBe(true);
        expect(reviewAuditRecordSchema.safeParse({ ...baseAudit, reviewerRole: "expert_reviewer" }).success).toBe(true);

        expect(reviewAuditRecordSchema.safeParse({ ...baseAudit, targetField: "invalid_field" }).success).toBe(false);
        expect(reviewAuditRecordSchema.safeParse({ ...baseAudit, reviewAction: "invalid_action" }).success).toBe(false);
        expect(reviewAuditRecordSchema.safeParse({ ...baseAudit, reviewerRole: "unauthorized_role" }).success).toBe(false);
        expect(reviewAuditRecordSchema.safeParse({ ...baseAudit, reviewerRole: "athlete" }).success).toBe(false);
    });

    it("strictly rejects open strings in validationStatus", () => {
        const baseShadow = {
            status: "abstained",
            candidate: null,
            confidence: null,
            reasonCodes: ["AMBIGUOUS_STANCE"],
            classifierId: "shadow_punch_classifier",
            classifierVersion: "1.0.0",
            configVersion: "1.0.0",
            featureVersion: "1.0.0",
            stanceSource: "classifier_input",
            evidenceLevel: "derived_proxy",
            validationStatus: "SHADOW_NOT_VALIDATED",
        };

        expect(shadowClassificationSchema.safeParse(baseShadow).success).toBe(true);
        expect(shadowClassificationSchema.safeParse({ ...baseShadow, validationStatus: "VALIDATED" }).success).toBe(true);
        expect(shadowClassificationSchema.safeParse({ ...baseShadow, validationStatus: "REJECTED" }).success).toBe(true);
        expect(shadowClassificationSchema.safeParse({ ...baseShadow, validationStatus: "ANY_OPEN_STRING" }).success).toBe(false);
    });

    it("validates Task 14 DatasetManifest with backendAttestation and readinessGaps from real serialized Python fixture", () => {
        const pythonManifestFixture = {
            datasetId: "mma_gold_v1",
            schemaVersion: "1.0.0",
            exportTimestamp: "2026-09-17T10:00:00Z",
            policy: "coach_approved_or_corrected",
            totalSamples: 140,
            splitDistribution: { train: 98, val: 21, test: 21 },
            techniqueDistribution: { jab: 20, cross: 20, hook: 20, uppercut: 20, round_kick: 20, front_kick: 20, side_kick: 20 },
            isGoldReady: false,
            status: "NOT_GOLD_READY",
            contentHash: "abcdef1234567890",
            datasetHash: "1234567890abcdef",
            notes: "Readiness gaps: INSUFFICIENT_SAMPLE_COUNT, MISSING_BACKEND_ATTESTATION; status marked NOT_GOLD_READY.",
            backendAttestation: null,
            readinessGaps: ["INSUFFICIENT_SAMPLE_COUNT", "MISSING_BACKEND_ATTESTATION"],
        };

        const parsed = datasetManifestSchema.safeParse(pythonManifestFixture);
        expect(parsed.success).toBe(true);
        if (parsed.success) {
            expect(parsed.data.isGoldReady).toBe(false);
            expect(parsed.data.status).toBe("NOT_GOLD_READY");
            expect(parsed.data.readinessGaps).toEqual(["INSUFFICIENT_SAMPLE_COUNT", "MISSING_BACKEND_ATTESTATION"]);
        }
    });

    it("strictly validates ActionPayload on blocked quality", () => {
        const blockedAction = {
            id: "action_001",
            sourceActionId: "punch_1",
            family: "punch",
            technique: "unknown",
            attackingSide: "unknown",
            limbRole: "unknown",
            stance: "orthodox",
            confidence: {
                detection: 0.95,
                classification: null,
                assessment: null,
            },
            phases: {
                startFrame: 0,
                chamberFrame: null,
                launchFrame: null,
                peakFrame: null,
                impactFrame: null,
                endFrame: 15,
                startTimeMs: 0.0,
                chamberTimeMs: null,
                launchTimeMs: null,
                peakTimeMs: null,
                impactTimeMs: null,
                endTimeMs: 500.0,
                impactType: "unavailable",
            },
            metrics: {},
            assessment: {
                score: null,
                grade: "insufficient_evidence",
                status: "insufficient_evidence",
                primaryError: null,
                findings: [],
            },
            review: {
                status: "insufficient_evidence",
            },
            qualityStatus: "blocked",
            adjustedEvidenceLevel: "unavailable",
            reasonCodes: ["QUALITY_BLOCKED"],
            shadowClassification: {
                status: "abstained",
                candidate: null,
                confidence: null,
                reasonCodes: ["QUALITY_BLOCKED"],
                classifierId: "shadow_classifier",
                classifierVersion: "2.0.0",
                configVersion: "2.0.0",
                featureVersion: "2.0.0",
                stanceSource: "quality_blocked",
                evidenceLevel: "unavailable",
                validationStatus: "SHADOW_NOT_VALIDATED",
            },
        };

        const parsed = actionSchema.safeParse(blockedAction);
        expect(parsed.success).toBe(true);
        if (parsed.success) {
            expect(parsed.data.technique).toBe("unknown");
            expect(parsed.data.attackingSide).toBe("unknown");
            expect(parsed.data.limbRole).toBe("unknown");
            expect(parsed.data.qualityStatus).toBe("blocked");
            expect(parsed.data.adjustedEvidenceLevel).toBe("unavailable");
            expect(parsed.data.assessment.score).toBeNull();
            expect(parsed.data.shadowClassification?.reasonCodes).toEqual(["QUALITY_BLOCKED"]);
        }
    });

    it("validates Tasks 18-31 Advanced AI extension payload with full workerResultSchema", () => {

        const advancedPayload = {
            schemaVersion: "1.0.0",
            meta: {
                fps: 30,
                totalFrames: 120,
                durationMs: 4000,
                imgWidth: 1280,
                imgHeight: 720,
                processedAt: "2026-09-17T00:00:00Z",
            },
            frames: [],
            kicks: [],
            punches: [],
            actions: [],
            findings: [],
            advancedAI: {
                sessionId: "session_test_slice_1",
                sequences: [
                    {
                        sequenceId: "seq_1",
                        sequenceType: "combination",
                        actionIds: ["act_1", "act_2"],
                        techniques: ["jab", "cross"],
                        startFrame: 10,
                        endFrame: 54,
                        durationMs: 1466.7,
                        interActionGapMs: 200.0,
                        fluidityScore: 0.85,
                        validationStatus: "NOT_VALIDATED",
                    },
                ],
                shadowElbowKnee: [
                    {
                        eventId: "sh_ek_1",
                        family: "elbow",
                        startFrame: 60,
                        endFrame: 75,
                        peakFrame: 68,
                        measuredKinematics: {
                            elbowAngleAtPeak: 75.0,
                            peakVelocityNorm: 3.5,
                        },
                        attackingSide: "left",
                        validationStatus: "SHADOW_NOT_VALIDATED",
                        reasonCodes: ["HIGH_PEAK_VELOCITY_WITH_ACUTE_ELBOW_FLEXION"],
                    },
                ],
                shadowGrappling: [
                    {
                        segmentId: "sh_grp_1",
                        state: "clinch_like",
                        startFrame: 0,
                        endFrame: 120,
                        levelChangeDisplacementNorm: null,
                        proximityDistanceNorm: 0.25,
                        multiPersonAmbiguity: false,
                        validationStatus: "SHADOW_NOT_VALIDATED",
                        reasonCodes: ["HIGH_BOUNDING_BOX_INTERSECTION_OVER_UNION"],
                    },
                ],
                observableMovement: {
                    baseOfSupportRatio: 1.25,
                    stanceWidthRatio: 1.15,
                    guardDistanceRatio: 0.80,
                    postureSwayVelocity: 0.05,
                    recoveryDurationSec: 0.40,
                    evidenceConfidence: 0.90,
                    evidenceLevel: "derived_proxy",
                },
                activeLearningCandidates: [
                    {
                        candidateId: "al_cand_1",
                        videoId: "anon_123456",
                        actionId: "act_elbow_1",
                        technique: "lead_elbow",
                        reasons: ["low_confidence"],
                        priority: {
                            uncertaintyScore: 0.60,
                            diversityScore: 0.0,
                            disagreementScore: 0.0,
                            totalPriority: 0.30,
                        },
                        isConsentGranted: true,
                        isExportEligible: true,
                        payloadDigest: "digest_123",
                    },
                ],
                sessionComparison: {
                    comparisonId: "comp_1",
                    sessionAId: "session_test_slice_1",
                    sessionBId: "sesh_prev",
                    status: "compatible",
                    metricDeltas: {
                        totalActions: {
                            metricName: "totalActions",
                            sessionAValue: 3.0,
                            sessionBValue: 2.0,
                            deltaValue: 1.0,
                            deltaPercent: 50.0,
                        },
                    },
                    observedDifferences: ["totalActions increased by +50.00% (+1.00)"],
                    evidenceRefs: [],
                    comparisonVersion: "1.0.0",
                },
                ghostDifference: {
                    explanationId: "gh_diff_1",
                    referenceTechnique: "jab",
                    referenceStance: "orthodox",
                    athleteStance: "orthodox",
                    alignmentStatus: "aligned",
                    warpingDistanceNorm: 0.08,
                    dtwPathLength: 30,
                    timingDeltaSeconds: 0.05,
                    spatialDeviations: {
                        lead_wrist: 0.06,
                    },
                    primaryDeviationLimb: "lead_wrist",
                    deviationSeverity: "minor",
                    coachingSummary: "Good timing; slight deviation in lead_wrist.",
                },
                pipelineVersion: "2.0.0",
            },
        };

        const parsed = workerResultSchema.safeParse(advancedPayload);
        if (!parsed.success) {
            console.error("Zod Validation Errors:", JSON.stringify(parsed.error.format(), null, 2));
        }
        expect(parsed.success).toBe(true);

        if (parsed.success && parsed.data.advancedAI) {
            expect(parsed.data.advancedAI.sequences?.length).toBe(1);
            expect(parsed.data.advancedAI.shadowElbowKnee?.[0].family).toBe("elbow");
            expect(parsed.data.advancedAI.shadowGrappling?.[0].state).toBe("clinch_like");
            expect(parsed.data.advancedAI.observableMovement?.guardDistanceRatio).toBe(0.80);
            expect(parsed.data.advancedAI.activeLearningCandidates?.[0].isConsentGranted).toBe(true);
            expect(parsed.data.advancedAI.sessionComparison?.status).toBe("compatible");
            expect(parsed.data.advancedAI.ghostDifference?.alignmentStatus).toBe("aligned");
        }
    });
});
