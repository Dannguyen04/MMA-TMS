# AI upgrade — 2026-10-05

## 2026-10-06 — six-punch video scope: V6 recovered, 24 CV runs + 2 refits

User acceptance scope is six punch types on video with abstention. Reconciled
all 5,451 original annotation rows with the mirror. Original V4/V6/V10 skeletons
match byte-for-byte. V6 column 0 is explicit frame ID, allowing all 685 source
intervals to be recovered without guessing row offsets. Dataset now has 5,460
samples; old tensors/targets and all 18 original Adam labels are preserved.

Ran B0 auxiliary TCN and B1 stance-reflection augmentation over four source folds
and three seeds. Mean supported-class fold F1 is 0.5092 / 0.5048. B0 wins the
frozen rule; B1 greatly improves V4 but regresses elsewhere. Refit B0 for 26 epochs
and separately refit exploratory B1 for 16 epochs, retaining the original choice.
V9/V10 diagnostic six-class F1 is 0.5417 / 0.4491; neither is release eligible.

Implemented a local video trial with pose-quality, calibration and reflection
abstention, plus event metrics counting misses and extra predictions. Extracted
96 RGB/YOLO comparison cases from 48 source clips. Neither policy is reliable on
V10. On Adam video, B0 rejects all 19 event candidates; B1 accepts five and all
five fail source label/time matching. **The application objective is not met.**

22 tests passed; all 24 CV and both refit checkpoint roundtrips/source contracts
verified; historical checkpoint remains loadable. No active worker promotion.
See [scope, evidence, results and commands](./AI-SIX-PUNCH-VIDEO-20261006.md).

## 2026-10-06 — 36 source-group CV runs and final refit completed

Implemented and ran A0 baseline, A1 source sampler, A2 pose-noise augmentation,
and A3 auxiliary family/side supervision across three folds and three seeds.
Mean fold macro-F1: 0.4151 / 0.4102 / 0.4163 / 0.4187. A3 won the frozen CV rule;
its rear-hook mean fold F1 improved 0.1741 to 0.2767, with regressions elsewhere.
Refit A3 at fixed seed 20261006 for CV-median 34 epochs. V9/V10 diagnostic F1 is
0.4298 versus historical 0.5146; no evidence for promotion. No active model change.
22 related test cases passed; 36 CV checkpoint roundtrips, final loader/parity,
source hashes and historical checkpoint loading verified. Prepared 30 source-linked
out-of-fold review items without changing any labels. All 18 original Adam labels
remain intact. See [results and artifacts](./AI-GROUP-CV-RESULTS-20261006.md).

## 2026-10-06 — frozen-model error analysis and improvement proposal

Reproduced the selected checkpoint's reported metrics and analyzed every source.
V9 accuracy is 83.89%, V10 31.13%; V10 accounts for 104/128 diagnostic errors.
Calibration-selected filtering retains 64 V10 clips, only 23 correct. Of all 128
diagnostic errors, 86 cross punch families and 42 confuse side within a family.
V1 contributes 47.93% of global effective training weight; Adam 0.1722%.
No exact feature duplicates found; fighter independence remains unverified.
Prepared and checked three source-group development folds with all six classes
in every train/validation fold. These folds are proposed, not yet trained.
See [analysis and ordered experiments](./AI-IMPROVEMENT-PLAN-20261006.md).

## 2026-10-06 — full training completed with original Adam labels

Trained residual TCN on the frozen 4,775-sample dataset, with 3,681 training
samples including all 18 original Adam annotations. All three seeds ran 40 epochs;
validation selected seed 20261007, epoch 37 before calibration and diagnostics.
Selected validation accuracy / macro-F1: 0.9296 / 0.7743. Already-observed V9/V10
diagnostic accuracy / macro-F1: 0.5733 / 0.5146. Rear-hook diagnostic F1 is 0.1379.
Calibration-selected confidence filtering accepts 61% of diagnostic samples with
74.32% agreement, below the calibration precision target; no production promotion.
Numeric checkpoint reload verified; 16 targeted tests passed. Model remains research
only and does not replace the active worker. See [full results](./AI-TRAINING-RESULTS-20261006.md)
and [machine-readable evidence](../../../python-worker/benchmark_results/adam_source_training_20261006.json).

## 2026-10-06 — user selected original Adam labels

Original adam_gt.csv is now authoritative for all 18 Adam annotations in the
temporary research dataset. AI/Gemini proposals are reference-only for Adam;
original intervals and overlapping endpoints are preserved. Built the new
`20261006_adam_source_v1` dataset with 4,775 samples: 4,754 mirror skeletons,
18 source-labelled Adam samples and 3 provisional heavybag AI samples.
Train count is 3,681; other splits stay unchanged. Six targeted tests passed
and all 18 loaded Adam targets/intervals match the pinned CSV. No model retraining
or coach certification was performed. This supersedes the earlier suggestion
to exclude four Adam uppercuts merely because the two AI reviews disagree.
See [label decision](./AI-ADAM-LABEL-DECISION.md).

## 2026-10-06 — Gemini cross-review completed on 9 priority tasks

Integrated an explicit offline/online Gemini review CLI with local key loading,
blind-to-prior-label prompts, custom 10 FPS video input and validated JSON output.
After a 503 and one user-authorized retry, Gemini 3.8 Flash reviewed all 9 Adam
priority tasks: 3 technique-label agreements, 4 lead/rear uppercut disagreements,
and 2 agreements that windows contain multiple actions. The successful response
reported 20,203 total tokens. No heavybag video was sent, no training labels
were changed and no coach approval was created. Four disputed training candidates
need further review before another supervised run. **12 targeted tests passed.**
See [integration and results](./AI-GEMINI-CROSS-REVIEW.md) and
[actual API evidence](../../../python-worker/benchmark_results/gemini_cross_review_20261006.json).

## 2026-10-06 — temporary dataset authorized and training exercised

User authorized temporary use. Built 4,768 research samples: 4,754 upstream
skeletons plus 14 pose-valid AI candidates (loss weight 0.25, train only).
One of 15 candidates was rejected for discontinuous pose. Train/validation/
calibration/observed-diagnostic counts are 3,674 / 199 / 595 / 300. Adam and
heavybag are now training sources in this experiment, not held-out evaluation.

Actually ran residual TCN for 3 CPU epochs; checkpoint roundtrip passed and
13 targeted tests passed. No calibration/test predictions or production model
promotion. The short run verifies execution, not an accuracy improvement.
Full heavybag processing encountered a 0.1 ms temporal-phase ordering error;
the dataset builder uses pose-only extraction and leaves that existing error
unresolved. See [temporary dataset and commands](./AI-TEMPORARY-DATASET.md)
and [measured evidence](../../../python-worker/benchmark_results/provisional_training_20261006.json).

## 2026-10-06 — AI visual triage; Adam annotation alignment concern

Reviewed sampled-frame evidence for all 67 local RGB tasks: 15 provisional
technique candidates, 14 transition fragments, 6 uncertain, 2 multi-action
windows and 30 outside solo-boxing scope. Seven AI candidates disagree with
upstream Adam labels. Unlabelled end-of-video windows visibly contain actions.
These observations require temporal relabelling; they do not establish that
the AI candidates are correct. Historical Adam scores against the 18 upstream
CSV labels must not be interpreted as verified recognition accuracy until
alignment is resolved. Original metrics are retained for traceability.

All reviews explicitly identify an AI actor and remain non-gold; no coach
approval or precise temporal boundaries were asserted. The 4,754 skeletons
still lack reviewable RGB in the pack. See [per-task review](./AI-DATASET-REVIEW-20261006.md)
and [67 machine-readable records](../../../python-worker/benchmark_results/ai_visual_review_20261006.json).

## Latest continuation — local coach review dataset

Built an immutable local pack with 4,754 upstream-labelled research skeletons,
7 existing videos and 67 video review tasks (18 source suggestions, 49 unlabelled
intervals). Six tasks retain overlapping source boundaries for review. Skeleton
RGB is unavailable in this pack; these are separate corpora, not 4,754 reviewable
video clips. Coach-confirmed and gold-eligible counts remain **0**.

Added an offline review interface with hidden source suggestions, editable timing,
review revisions and unverified JSON export. A localhost byte-range server fixes
seeking in fragmented MP4. **36 targeted tests passed**, plus browser playback,
late-video seeking and empty submission export checks. No coach identity or
approval was fabricated. See [dataset handoff](./AI-COACH-REVIEW-DATASET.md) and
[artifact hashes/counts](../../../python-worker/benchmark_results/coach_review_dataset_20261005.json).

## Latest continuation — temporal foundations and controlled architecture benchmark

Implemented the next research slice from the agreed YOLO-Pose design:

- Offline COCO-17 normalizer with pixel-aspect correction, hip/torso normalization,
  physical timestamps, missing-joint masks, velocity validity, root trajectory,
  source-frame provenance and conservative continuity/tracking checks.
- Numeric NPZ export and four-split dataset audit covering calibration leakage,
  fighter/session/video grouping, local pose checksums, reviewed labels, intervals,
  class support and declared annotation coverage. An empty template fails audit.
- Controlled comparison of legacy TCN, residual/dilated TCN and a small custom
  graph-temporal baseline: 3 seeds each, max 40 epochs, validation-only selection.
  Mean diagnostic macro-F1 on already-observed V9/V10: 0.330 / 0.519 / 0.341.
  Residual TCN leads validation (0.753 mean), but its diagnostic ECE is 0.253.
- Calibration-only abstention policy and checksum/source-verified numeric
  checkpoint loading. No fallback threshold is fabricated when calibration lacks
  sufficient precision/support. Public confidence remains null in research evaluation.
- Fresh Adam YOLO run processed 597 decoded frames; normalizer exported 596 after
  excluding one tracking-break frame. One wrist has only 52.35% usable confidence.
  Residual TCN oracle-boundary accuracy across seeds is 4/18, 3/18, 6/18. These
  results do not establish reliable video action classification or technique quality.

Full worker suite: **911 tests + 105 subtests passed**; subsequent checkpoint
source-verification checks: **8 targeted tests passed**, plus prediction parity on
18 actual Adam intervals. No application API/schema, active classifier, scoring
policy, production data or deployment was changed. ONNX export remains unverified;
the ONNX dependencies are not installed. Raw video/weights remain local and ignored.

The user confirmed that a coach-validated club dataset is not available yet.
Collection, annotation, fresh independent test and temporal/background labels are
the next external dependencies; code cannot certify those labels. A training
loader for the new timestamped manifest and a learned continuous-video detector
remain pending. Mirror benchmarks deliberately keep the historical feature
contract and do not validate the new normalizer's effect on recognition accuracy.

See [implementation and roadmap](./AI-TEMPORAL-IMPLEMENTATION.md),
[coach data protocol](./AI-DATA-COLLECTION-PROTOCOL.md),
[measured research report](./worker-reports/TEMPORAL_AI_RESEARCH_REPORT.md) and
[machine-readable evidence](../../../python-worker/benchmark_results/temporal_architecture_20261005.json).

## Current direction — evidence-first professional review

User approved keeping existing business rules and prioritizing AI evidence for
coaches/doctors over autonomous strike classification and scoring. Implemented a
first movement-evidence slice: declared exercise/protocol context, fail-closed
visibility/tracking/timing checks, timestamped review windows and recording guidance,
worker result/callback provenance, validated frontend contract and playback panel.

No new clinical authority or clearance behavior. Exercise assignment-to-job wiring,
window-level persisted correction, validated measurements and longitudinal comparison
remain pending. Backend was not edited in this turn due to its AGENTS.md restriction.
See [scope and verification](./AI-MOVEMENT-EVIDENCE-v1.md).

## Previous research / release status

Status: **production AI release blocked**. The user's target is reliable video
analysis, not server deployment. Latest measured evidence and verification are in
[docs/archive/ai/AI_RESEARCH_RESULTS.md](./AI_RESEARCH_RESULTS.md).

## Latest continuation — public-data experiment and output safety

- Acquired pinned public video/annotations and BoxingVI-mirror skeletons; 4,754 valid
  clips after schema/annotation quarantine. Trained a CPU TCN with separate source-video
  train/validation/calibration/test groups. No third-party training code was executed.
- Six-class accuracy 47.0%, macro F1 0.379 on 300 valid held-out-source clips;
  shadow event F1 0.552 at temporal IoU 0.1 on an external 18-punch video. Neither is
  production acceptance evidence; fighter independence and commercial rights remain unverified.
- Fresh full-video inference and a real worker-JSON/frontend mapping test completed.
  Classifier weights remain research-only and never replace the active worker model.
- Output policy now withholds **individual** scores, authoritative technique labels,
  findings and prescriptive advice too, even on quality-pass video. Callback uses the
  same guard. Timeline IDs and kinematic evidence remain reviewable. Unknown punches
  stay unclassified in the frontend; no elbow-angle relabeling to cross/hook.
- Docker packaging fixes include the missing Python pipeline package, local pose weights,
  non-root users and API workspace build context. Docker daemon is unavailable, so images
  were not built or claimed deployable. No production DB/cloud change was made.

The sections below describe the earlier sprint snapshot. Its statements about
untrained classifiers, 60-frame-only inference and retained individual rubric
outputs are superseded by this continuation; historical benchmark evidence is retained.

## Implemented

- Frozen diagnostic evidence manifest and SHA-256 verification; cached predictions are explicitly not an independent held-out set. The recorded runtime hash does not prove which runtime generated historical JSON.
- Reproducible punch replay with per-video FP/FN matches, timing and evidence, plus explicit non-promotable release status.
- Torso-normalized per-arm reach/velocity/elbow candidates, time-based NMS, overlap support and missing/cached/low-quality/ground/discontinuity gates. This is a heuristic shadow detector, not a trained classifier. Rotation/guard feature models and full identity validation remain future work.
- Removed automatic promotion based on the number of punch candidates. Active legacy outputs remain separate from `shadowEventDetection`.
- Worker uploads JSON, persists structured actions/findings, then calls DONE. Receipt locking and semantic SHA-256 reject conflicting retries and accept identical retries without duplicate assessments.
- API creates missing analyses against a real, uniquely matching active pose configuration. Migration 015 allows unknown confidence and enforces unique action IDs per analysis.
- Real frontend review/correction calls, raw worker identity mapping, append-only review history, target ownership checks, authorized readback and reviewed-action reference selection.
- Production AI job lists read the API. Unimplemented model registry mutations/retry/cancel fail explicitly; demo model descriptions are labeled. This does not implement a production model registry.
- Unknown detection/combination confidence remains null through the frontend; no substituted assessment confidence or zero probability. Session summary scores and prescriptive recommendations are withheld. Individual rubric evidence remains diagnostic, not calibrated technique accuracy.

## Reproduce local diagnostic benchmark

From `python-worker`:

```sh
python ai_upgrade_benchmark.py evaluate --manifest benchmark_results/ai_upgrade_manifest.json --output benchmark_results/ai_upgrade_report.json
```

Add `--require-release` to exit with code 2 while release evidence is missing. This is a fail-closed diagnostic command, not yet CI/CD promotion enforcement or a complete release evaluator. Do not regenerate the frozen manifest to conceal changed annotations or predictions.

Current punch-only comparison on cached poses:

| Detector | TP | FP | FN | Precision | Recall | F1 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Historical cached punch baseline | 9 | 10 | 33 | 0.4737 | 0.2143 | 0.2951 |
| Shadow torso peak detector | 34 | 70 | 8 | 0.3269 | 0.8095 | 0.4658 |

Recall/F1 improve on this development replay but precision worsens. Both VIDEO_DATA_002 and negative-no-regression gates fail. The broader historical mixed punch/kick F1 is a different denominator and must not be directly compared to punch-only F1. Keep shadow mode.

## Deployment prerequisites — not applied in this task

1. Back up a designated test database; ensure migrations 001–014 are applied. Review existing duplicate `(analysis_id, action_id)` rows; migration 015 deliberately fails instead of deleting evidence.
2. In `nestjs-api`, run `node run_sql.mjs --check`, then apply `node run_sql.mjs --apply-015` only to the approved target database.
3. Register exactly one active `algorithm_configs` row whose `yolo_model_name` matches the worker model (`yolov8n-pose`). No fabricated fallback config is created in the worker delivery path.
4. Configure worker/API shared `WORKER_SECRET_TOKEN`, API URL, Redis and Supabase storage credentials through existing environment configuration. Frontend API mode must use real authenticated sessions.
5. Deploy API before worker and frontend. Smoke-test upload, structured persistence, repeated identical delivery, conflicting delivery, coach correction/reload, unauthorized access and audit rows on that test environment.

No database migration, production deployment or external data upload was executed. Existing legacy coaching job/reanalysis endpoints and the manual Redis queue implementation are not comprehensively redesigned here; use the primary `/jobs` flow. Full BullMQ retry/lock compatibility requires separate integration verification.

## Verification

- 75 targeted Python tests passed, including mocked delivery success/failure ordering; no external connections in those tests.
- 63 frontend tests passed, including missing-confidence regressions and real review API adapters.
- 14 backend receipt, storage trust-boundary and authorization tests passed using mocked persistence; no live database transaction/locking test was run. The integration suite was updated for the new contract but not executed against an external database.
- Frontend typecheck and backend production typecheck passed. Full backend test typecheck has unrelated pre-existing errors in medical/training/OpenAPI tests.
- Fresh local inference succeeded on the first 60 frames of `validation_videos/vid_01_cross_heavybag.mp4`; zero events in this one-second sample. This verifies execution only, not accuracy or the full video corpus.
- Migration checksums verified without opening a database connection.

## Remaining phases / evidence required

Independent source/fighter-separated train/calibration/held-out data, consent and dual annotation/adjudication are absent. Original VIDEO_DATA_002/003/005 videos are also absent locally (cached results are available). Consequently, no technique model was trained, probabilities were not calibrated, coach agreement was not established, and no production registry/canary/rollback or full real end-to-end acceptance was claimed.

Remaining product work includes fully evidence-backed metrics in place of legacy frontend kinematic proxies, authoritative registry/metrics UI, CI release integration, richer hard negatives, event classifier/calibration, catalog approval and baseline comparability gates. The six-phase plan remains open beyond this first-sprint implementation.
