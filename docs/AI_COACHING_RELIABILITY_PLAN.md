# AI Coaching Reliability Plan

## Product decision

The current pipeline is a development prototype and must not be represented as
reliable AI coaching. A successful job or a rendered result page proves delivery,
not coaching accuracy.

## Release gates

The product may use the label **Reliable AI Coaching** only when all gates pass on
an independently annotated, held-out evaluation set:

1. Strike-event detection: precision >= 0.90, recall >= 0.90, F1 >= 0.90.
2. Impact timing: median absolute error <= 100 ms and p95 <= 200 ms.
3. Technique classification: macro F1 >= 0.85 for each supported technique;
   unsupported or ambiguous actions must abstain.
4. Side classification: accuracy >= 0.95 where side is independently labelled.
5. Confidence calibration: ECE <= 0.05; no numeric confidence may be displayed
   when the underlying detector or classifier did not produce one.
6. Session scoring: no score when event coverage is unknown, analysis quality is
   blocked, or required evidence is missing. Degraded input must be clearly labelled
   and must not receive unqualified coaching language.
7. Coaching findings: each finding must point to a visible evidence interval and
   pass an independent coach review sample with >= 90% agreement.
8. Regression: every supported camera/view/lighting/body-shape stratum must pass;
   aggregate performance cannot hide a failing subgroup.

## Current measured baseline

For `VIDEO_DATA_002.mp4`, the source hash matches the repository annotation:

- Ground-truth punches: 16
- Detected punches: 4
- True positives: 4
- False positives: 0
- False negatives: 12
- Precision: 1.00
- Recall: 0.25
- F1: 0.40

The expanded diagnostic benchmark currently reports overall F1 0.4054. The
annotations are provisional and single-reviewer, so they are suitable for diagnosis
but not for a production accuracy claim.

## Delivery sequence

### R1 — Honest product behavior

- Replace `100% tracking quality` with separate measured pose coverage, evidence
  quality, detection coverage, and calibration state.
- Do not turn assessment confidence into detection/classification confidence.
- Mark `SHADOW_NOT_VALIDATED`, null confidence, unknown stance, or degraded quality
  explicitly in the UI.
- Suppress session scores and prescriptive coaching when evidence gates fail.

### R2 — Event detector v2

- Separate strike candidate detection from technique scoring.
- Detect velocity/reach peaks per arm and perform temporal non-maximum suppression.
- Support overlapping cycles and a new strike before full return-to-guard.
- Group detected events into combinations only after event detection.
- Tune thresholds on training data only; never tune against held-out release clips.

### R3 — Valid classification and scoring

- Classify jab/cross/hook only after event boundaries are stable.
- Require stance/side evidence or abstain.
- Calibrate probabilities on a dedicated calibration split.
- Compute session score only from evaluated actions with known coverage; publish the
  coverage next to the score.

### R4 — Independent validation

- Build a versioned corpus with two independent combat-sport annotators and an
  adjudication pass.
- Include single strikes, fast combinations, occlusion, bag motion, multiple people,
  camera angles, lighting conditions, body shapes, stances, and non-strike negatives.
- Freeze manifests and hashes, run release gates in CI, and block deployment on any
  failed gate or material subgroup regression.

## VIDEO_DATA_002 regression target

Before detector v2 is accepted, this clip must produce at least 14/16 matched punch
events, no more than one false positive, and p95 impact error <= 200 ms. It remains a
development regression fixture and cannot also serve as held-out proof.
