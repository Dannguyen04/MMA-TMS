"""Build a leakage-safe MMA-TMS manifest from an acquired public dataset."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from pipeline.public_dataset import build_manifest, load_catalog, write_manifest


def main() -> int:
    parser = argparse.ArgumentParser(description="Prepare a public video dataset for MMA-TMS")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("catalog", help="Show supported datasets and their usage constraints")

    prepare = subparsers.add_parser("prepare", help="Scan files and write a normalized manifest")
    prepare.add_argument("--dataset", required=True, choices=sorted(load_catalog()["datasets"]))
    prepare.add_argument("--root", required=True, help="Local dataset directory")
    prepare.add_argument("--metadata", help="CSV metadata path for metadata-based datasets")
    prepare.add_argument("--output", required=True, help="Output JSON manifest")
    prepare.add_argument("--allow-missing-files", action="store_true", help="Keep metadata usable before videos are acquired")

    args = parser.parse_args()
    if args.command == "catalog":
        catalog = load_catalog()
        print(json.dumps(catalog, ensure_ascii=False, indent=2))
        return 0

    manifest = build_manifest(
        dataset_id=args.dataset,
        root=args.root,
        metadata=args.metadata,
        require_files=not args.allow_missing_files,
    )
    output = write_manifest(manifest, args.output)
    print(f"Manifest: {output}")
    print(f"Samples: {sum(manifest['counts'].values())} | splits={manifest['counts']}")
    print(
        "Training roles: "
        f"technique={manifest['techniqueTrainingCount']}, "
        f"coarse_detection={manifest['coarseDetectionCount']}, "
        f"negative={manifest['hardNegativeCount']}"
    )
    if manifest["missingFileCount"]:
        print(f"Missing files skipped: {manifest['missingFileCount']}")
    if not manifest["leakageAudit"]["passed"]:
        raise RuntimeError("Group leakage detected; manifest was not accepted")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
