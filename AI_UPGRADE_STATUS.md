# AI upgrade — 2026-10-03

## Current direction — evidence-first professional review

User approved keeping existing business rules and prioritizing AI evidence for
coaches/doctors over autonomous strike classification and scoring. Implemented a
first movement-evidence slice: declared exercise/protocol context, fail-closed
visibility/tracking/timing checks, timestamped review windows and recording guidance,
worker result/callback provenance, validated frontend contract and playback panel.

No new clinical authority or clearance behavior. Exercise assignment-to-job wiring,
window-level persisted correction, validated measurements and longitudinal comparison
remain pending. Backend was not edited in this turn due to its AGENTS.md restriction.
See [scope and verification](docs/AI-MOVEMENT-EVIDENCE-v1.md).

## Previous research / release status

Status: **production AI release blocked**. The user's target is reliable video
analysis, not server deployment. Latest measured evidence and verification are in
[AI_RESEARCH_RESULTS.md](AI_RESEARCH_RESULTS.md).

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
