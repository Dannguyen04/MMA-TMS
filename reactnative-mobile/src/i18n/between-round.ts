import type { RoundInstruction } from "@/api/fight-camp";
import { pendingVi } from "./pending-vi";

/** Vietnamese only (project decision 31/10). Owner-decided words (e.g. "Fight Camp", kept) live in pending-vi.ts. */
export const betweenRound = {
  current: (n: number) => `Ghi hiệp ${n}`, next: (n: number) => `Hiệp ${n}: làm gì`,
  compact: "Hai chiến thuật, một quan sát, tự chấm hiệp.", more: "Ghi thêm", less: "Ẩn phần ghi thêm", focus: "Trọng tâm",
  focusLimit: "Chiến thuật võ sĩ ưu tiên dùng ở hiệp sau. Chọn tối đa 2.", addedAt: (n: number) => `Thêm ở hiệp ${n}`,
  suggested: "Lời dặn đề xuất", picked: (n: number) => `đã chọn ${n}/3`, instructionLimit: "Chọn tối đa 3, gồm lời dặn tự do",
  noSuggestions: "Lưu hiệp đầu để nhận đề xuất từ diễn biến trận.",
  dropped: "Chiến thuật này đang được khuyến nghị tạm bỏ.",
  add: "Thêm chiến thuật", added: "Chiến thuật mới", basis: "Quan sát căn cứ (tối đa 3)",
  remove: "Bỏ chiến thuật mới", custom: "Lời dặn tự do", optional: "Tuỳ chọn, tối đa 140 ký tự",
  extras: "Chiến thuật mới cho hiệp sau", hideExtras: "Ẩn chiến thuật mới", final: "Hiệp cuối — chỉ lưu diễn biến hiệp.",
  save: (n: number, edit: boolean) => `${edit ? "Lưu lại" : "Chốt"} hiệp ${n}`,
  saved: (n: number) => `Đã lưu hiệp ${n}`, savedSummary: (n: number, score: string) => `Hiệp ${n} · ${score} · Mở lại`,
  selfScore: "HLV tự chấm", win: "Thắng", loss: "Thua", close: "Sát nút", unscored: "Chưa chấm",
  effective: "Hiệu quả", ineffective: "Không hiệu quả", unused: "Chưa dùng", seen: "Có thấy", unseen: "Không thấy",
  scoreTactics: "Chiến thuật trong hiệp", observation: "Quan sát chính", otherTactics: "Chiến thuật khác", otherObservations: "Quan sát khác",
  noTactics: "Chưa có chiến thuật được lập cho trận.", noObservations: "Chưa có quan sát về đối thủ.",
  note: "Ghi chú nhanh trong hiệp", draft: "Nháp giữ trong trận này; chốt hiệp để lưu.",
  knockdowns: "Số lần bị đánh ngã", decrease: "Giảm một", increase: "Tăng một", stunned: "Choáng", bleeding: "Chảy máu", fatigued: "Mệt", yes: "Có", no: "Không",
  saveFailed: "Chưa lưu được hiệp", loadFailed: "Không tải được dữ liệu", retry: "Tải lại",
  invalid: "Kế hoạch chưa hợp lệ. Kiểm tra các mục đã chọn.", limitError: "Tối đa 2 trọng tâm, 2 chiến thuật mới và 3 lời dặn.",
  textError: "Chiến thuật và lời dặn tự do cần từ 1 đến 140 ký tự.", unknown: "Chiến thuật hoặc quan sát không còn hợp lệ. Tải lại trận trước khi lưu.",
  finalError: "Hiệp cuối không có kế hoạch hiệp sau.", usedLater: "Chiến thuật đã được dùng ở hiệp sau; giữ lại khi sửa kế hoạch.",
  selected: "Đã chọn", notSelected: "Chọn", noFocus: "Chưa có chiến thuật để chọn trọng tâm.",
  roundTabs: "Chọn hiệp để ghi", roundTab: (n: number) => `Hiệp ${n}`, roundTabSaved: (n: number) => `Hiệp ${n}, đã ghi`,
  customLocked: "Đã chọn đủ 3 lời dặn. Bỏ chọn một lời dặn để viết lời dặn tự do.",
  unknownTactic: "chiến thuật không còn trong hồ sơ trận",
};

export function instructionText(instruction: RoundInstruction, tactics: readonly { id: string; text: string }[]): string {
  // Never show a raw tactic id: fall back to a readable phrase when the tactic is gone.
  const tactic = tactics.find(t => t.id === instruction.tacticId)?.text ?? betweenRound.unknownTactic;
  const text: Record<RoundInstruction["code"], string> = {
    SAFETY_CHECK: "Kiểm tra võ sĩ trước khi cho đánh tiếp", STOP_TACTIC: `Bỏ: ${tactic}`, USE_TACTIC: `Dùng: ${tactic}`,
    RECHECK_OPPONENT: `Xem lại đối thủ: ${tactic}`, MUST_WIN_ROUND: "Cần thắng hiệp sau", HARD_TO_WIN_ON_POINTS: "Khó thắng bằng điểm", CUSTOM: instruction.text ?? "",
  };
  return text[instruction.code] ?? pendingVi.unknownInstruction;
}
