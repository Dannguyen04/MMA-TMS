import type { enFigure3d } from "./figure3d.en";

/**
 * Vietnamese dictionary for the 3D figures.
 * Matches all keys and placeholders of `enFigure3d`.
 */
export const viFigure3d = {
    "figure3d.view.group": "Hướng nhìn",
    "figure3d.view.front": "Mặt trước",
    "figure3d.view.back": "Mặt sau",
    "figure3d.dragHint": "Kéo để xoay",
    "figure3d.rescan": "Quét lại cơ thể",
    "figure3d.credit": "Mô hình 3D: {author}, CC BY 4.0",
    "figure3d.bodyAria": "Bản đồ cơ thể 3D. {summary}",
    "figure3d.bodyAria.none": "Chưa đánh dấu vùng nào.",
    "figure3d.profile.aria": "Hình của {name}, dựng theo hồ sơ: {facts}",
    "figure3d.profile.height": "Chiều cao",
    "figure3d.profile.reach": "Sải tay",
    "figure3d.profile.weight": "Cân nặng",
    "figure3d.profile.notRecorded": "chưa ghi",
    "figure3d.profile.classLimit": "Giới hạn {weightClass}: {limit} kg",
    "figure3d.profile.over": "vượt {kg} kg",
    "figure3d.profile.under": "dưới {kg} kg",
    "figure3d.profile.atLimit": "đúng giới hạn",
    "figure3d.profile.openInjuries": "Chấn thương đang mở sáng lên trên cơ thể.",
} satisfies Record<keyof typeof enFigure3d, string>;
