"""Public dataset ingestion for MMA-TMS.

This module deliberately keeps coarse public labels separate from coach-approved
technique labels. A clip labelled ``boxing`` or ``punch`` is useful for action
detection, but it must never silently become a jab, cross, or hook sample.
"""

from __future__ import annotations

from dataclasses import dataclass
import csv
import hashlib
import json
from pathlib import Path
import re
from typing import Any, Iterable, Mapping, Sequence


SPLITS = ("train", "val", "test")
TECHNIQUE_LABELS = frozenset({"jab", "cross", "hook", "round_kick"})


@dataclass(frozen=True)
class PublicClip:
    sample_id: str
    dataset_id: str
    video_path: str
    source_label: str
    canonical_label: str
    label_granularity: str
    group_id: str
    split: str
    source_video: str | None = None
    start_time: float | None = None
    end_time: float | None = None

    @property
    def eligible_for_technique_training(self) -> bool:
        return self.label_granularity == "technique" and self.canonical_label in TECHNIQUE_LABELS

    def to_dict(self) -> dict[str, Any]:
        return {
            "sampleId": self.sample_id,
            "datasetId": self.dataset_id,
            "videoPath": self.video_path,
            "sourceLabel": self.source_label,
            "canonicalLabel": self.canonical_label,
            "labelGranularity": self.label_granularity,
            "groupId": self.group_id,
            "split": self.split,
            "sourceVideo": self.source_video,
            "startTime": self.start_time,
            "endTime": self.end_time,
            "eligibleForTechniqueTraining": self.eligible_for_technique_training,
        }


def load_catalog(path: str | Path | None = None) -> dict[str, Any]:
    catalog_path = Path(path) if path else Path(__file__).resolve().parents[1] / "public_datasets.json"
    with catalog_path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    if payload.get("schemaVersion") != "1.0.0" or not isinstance(payload.get("datasets"), dict):
        raise ValueError("Unsupported public dataset catalog")
    return payload


def _stable_split(group_id: str, ratios: Sequence[int] = (80, 10, 10)) -> str:
    if len(ratios) != 3 or sum(ratios) != 100 or any(value < 0 for value in ratios):
        raise ValueError("split ratios must contain three non-negative integers summing to 100")
    bucket = int(hashlib.sha256(group_id.encode("utf-8")).hexdigest()[:8], 16) % 100
    if bucket < ratios[0]:
        return "train"
    if bucket < ratios[0] + ratios[1]:
        return "val"
    return "test"


def _sample_id(dataset_id: str, relative_path: str, source_label: str) -> str:
    digest = hashlib.sha256(f"{dataset_id}\0{relative_path}\0{source_label}".encode("utf-8")).hexdigest()[:20]
    return f"pub_{digest}"


def _ucf_group_id(filename: str) -> str:
    # v_BoxingPunchingBag_g03_c02.avi -> BoxingPunchingBag_g03
    match = re.match(r"^v_(.+?)_(g\d+)_c\d+", Path(filename).stem, flags=re.IGNORECASE)
    return f"ucf101:{match.group(1)}:{match.group(2).lower()}" if match else f"ucf101:{Path(filename).stem}"


def _kth_group_id(filename: str) -> str:
    # person01_boxing_d1_uncomp.avi -> person01
    match = re.match(r"^(person\d+)_", Path(filename).stem, flags=re.IGNORECASE)
    return f"kth:{match.group(1).lower()}" if match else f"kth:{Path(filename).stem}"


def _resolve_label(source_label: str, labels: Mapping[str, Any]) -> tuple[str, str] | None:
    normalized = source_label.strip()
    entry = labels.get(normalized) or labels.get(normalized.lower())
    if not entry:
        return None
    return str(entry["canonical"]), str(entry["granularity"])


def _iter_folder_rows(root: Path, dataset_id: str, spec: Mapping[str, Any]) -> Iterable[dict[str, Any]]:
    extensions = {str(value).lower() for value in spec.get("acceptedExtensions", [])}
    for path in sorted(item for item in root.rglob("*") if item.is_file() and item.suffix.lower() in extensions):
        relative = path.relative_to(root).as_posix()
        if dataset_id == "ucf101":
            match = re.match(r"^v_(.+?)_g\d+_c\d+", path.stem, flags=re.IGNORECASE)
            source_label = match.group(1) if match else path.parent.name
            group_id = _ucf_group_id(path.name)
        elif dataset_id == "kth_boxing":
            parts = path.stem.lower().split("_")
            source_label = next((part for part in parts if part in spec["labels"]), path.parent.name.lower())
            group_id = _kth_group_id(path.name)
        else:
            source_label = path.parent.name
            group_id = f"{dataset_id}:{path.stem}"
        yield {"video_path": str(path.resolve()), "relative": relative, "label": source_label, "group_id": group_id}


def _iter_csv_rows(root: Path, metadata_path: Path, dataset_id: str) -> Iterable[dict[str, Any]]:
    with metadata_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        required = {"file_name", "label"}
        if not reader.fieldnames or not required.issubset(set(reader.fieldnames)):
            raise ValueError(f"metadata CSV requires columns {sorted(required)}")
        for row in reader:
            relative = str(row["file_name"]).replace("\\", "/")
            source_video = (row.get("source_video") or "").strip() or None
            athlete = (row.get("athlete_id") or row.get("fighter_id") or "").strip()
            group_key = athlete or source_video or Path(relative).stem
            yield {
                "video_path": str((root / relative).resolve()),
                "relative": relative,
                "label": str(row["label"]),
                "group_id": f"{dataset_id}:{group_key}",
                "source_video": source_video,
                "start_time": _optional_float(row.get("start_time")),
                "end_time": _optional_float(row.get("end_time")),
            }


def _optional_float(value: Any) -> float | None:
    if value in (None, ""):
        return None
    return float(value)


def build_manifest(
    dataset_id: str,
    root: str | Path,
    metadata: str | Path | None = None,
    catalog_path: str | Path | None = None,
    split_ratios: Sequence[int] = (80, 10, 10),
    require_files: bool = True,
) -> dict[str, Any]:
    catalog = load_catalog(catalog_path)
    try:
        spec = catalog["datasets"][dataset_id]
    except KeyError as exc:
        raise ValueError(f"Unknown dataset '{dataset_id}'") from exc

    root_path = Path(root).resolve()
    if not root_path.is_dir():
        raise ValueError(f"Dataset root does not exist: {root_path}")

    adapter = spec["adapter"]
    if adapter == "metadata_csv":
        metadata_path = Path(metadata).resolve() if metadata else root_path / "metadata.csv"
        if not metadata_path.is_file():
            raise ValueError(f"Metadata file does not exist: {metadata_path}")
        rows = _iter_csv_rows(root_path, metadata_path, dataset_id)
    else:
        rows = _iter_folder_rows(root_path, dataset_id, spec)

    samples: list[PublicClip] = []
    skipped_unknown_labels: dict[str, int] = {}
    missing_files: list[str] = []
    for row in rows:
        resolved = _resolve_label(row["label"], spec["labels"])
        if not resolved:
            label = str(row["label"])
            skipped_unknown_labels[label] = skipped_unknown_labels.get(label, 0) + 1
            continue
        video_path = Path(row["video_path"])
        if require_files and not video_path.is_file():
            missing_files.append(str(video_path))
            continue
        canonical, granularity = resolved
        group_id = str(row["group_id"])
        samples.append(PublicClip(
            sample_id=_sample_id(dataset_id, row["relative"], str(row["label"])),
            dataset_id=dataset_id,
            video_path=str(video_path),
            source_label=str(row["label"]),
            canonical_label=canonical,
            label_granularity=granularity,
            group_id=group_id,
            split=_stable_split(group_id, split_ratios),
            source_video=row.get("source_video"),
            start_time=row.get("start_time"),
            end_time=row.get("end_time"),
        ))

    group_splits: dict[str, set[str]] = {}
    for sample in samples:
        group_splits.setdefault(sample.group_id, set()).add(sample.split)
    leaking_groups = sorted(group for group, splits in group_splits.items() if len(splits) > 1)
    counts = {split: sum(sample.split == split for sample in samples) for split in SPLITS}
    label_counts: dict[str, int] = {}
    for sample in samples:
        label_counts[sample.canonical_label] = label_counts.get(sample.canonical_label, 0) + 1

    manifest_core = {
        "schemaVersion": "1.0.0",
        "datasetId": dataset_id,
        "displayName": spec["displayName"],
        "homepage": spec["homepage"],
        "usage": spec["usage"],
        "licenseStatus": spec["licenseStatus"],
        "splitPolicy": "deterministic_group_hash",
        "splitRatios": list(split_ratios),
        "counts": counts,
        "labelCounts": label_counts,
        "techniqueTrainingCount": sum(sample.eligible_for_technique_training for sample in samples),
        "coarseDetectionCount": sum(sample.label_granularity == "coarse_positive" for sample in samples),
        "hardNegativeCount": sum(sample.label_granularity in {"negative", "hard_negative"} for sample in samples),
        "skippedUnknownLabels": skipped_unknown_labels,
        "missingFileCount": len(missing_files),
        "missingFilesPreview": missing_files[:20],
        "leakageAudit": {"passed": not leaking_groups, "overlappingGroupIds": leaking_groups},
        "samples": [sample.to_dict() for sample in samples],
    }
    digest_payload = json.dumps(manifest_core, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    manifest_core["manifestSha256"] = hashlib.sha256(digest_payload.encode("utf-8")).hexdigest()
    return manifest_core


def write_manifest(manifest: Mapping[str, Any], output_path: str | Path) -> Path:
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8") as handle:
        json.dump(dict(manifest), handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    return output
