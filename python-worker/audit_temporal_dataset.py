"""Audit a labelled local temporal manifest before training; no external services."""
import argparse
import json
from pathlib import Path

from pipeline.temporal_dataset import audit_manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--minimum-class-support", type=int, default=30)
    args = parser.parse_args()
    report = audit_manifest(args.manifest, minimum_class_support=args.minimum_class_support)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("x", encoding="utf-8") as stream:
        json.dump(report, stream, indent=2, allow_nan=False)
    print(json.dumps({k: report[k] for k in ("sampleCount", "passesStructuralAudit", "readyForTrainingByDeclaredMetadata")}))
    raise SystemExit(0 if report["readyForTrainingByDeclaredMetadata"] else 2)
