/** Licence (giấy phép) wording shared by the fighter, coach and doctor pages. */
export const clearanceCopy = {
  scope: { training: "Tập luyện", competition: "Thi đấu" },
  notYet: (dm: string | null) => dm ? `Giấy phép có hiệu lực từ ${dm}.` : "Giấy phép chưa đến ngày có hiệu lực.",
  expired: "Giấy phép đã hết hạn.",
  expiredOn: (dm: string) => `Giấy phép đã hết hạn ngày ${dm}.`,
  missing: (dm: string | null) => `Chưa có giấy phép cho lần khám ${dm ?? "gần nhất"}.`,
  noExam: (scope: "training" | "competition") => `Chưa khám để ${scope === "training" ? "tập luyện" : "thi đấu"}.`,
  word: { notYet: "Chưa hiệu lực", expired: "Cần cấp lại", missing: "Chưa cấp", noExam: "Chưa khám" },
  until: (dm: string | null) => dm ? `đến ${dm}` : "không thời hạn",
  from: (dm: string | null) => dm ? `từ ${dm}` : "",
  range: (a: string | null, b: string | null) => a && b ? `${a} – ${b}` : a ? `từ ${a}` : b ? `đến ${b}` : "",
  endedOn: (dm: string | null) => dm ? `hết hạn ${dm}` : "",
  exam: (dm: string | null) => `lần khám ${dm ?? "gần nhất"}`,
  noEnd: "không thời hạn",
  older: "Lần khám trước",
  olderWord: "Không còn dùng",
  olderLine: "Không còn dùng vì đã có lần khám mới",
} as const;
