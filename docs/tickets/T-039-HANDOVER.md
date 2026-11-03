# T-039 Handover

- Nhánh: feat/T-039-live-video-eval    Commit: 0997d2d
- Trạng thái: IN REVIEW

## Thay đổi
- `python-worker/scripts/eval/live_round_feasibility.mjs`: Script Node ESM độc lập đo tính khả thi của việc gửi video hiệp đấu (V6, V10) qua Gemini API trong vòng 40 giây (thời gian nghỉ giữa hiệp). Hỗ trợ 4 cấu hình L1..L4 (YouTube URL và Files API), cấu trúc structured output theo đúng yêu cầu, xử lý tải nhãn từ GitHub fallback, chạy `--dry-run` không cần API key và kiểm tra chặt chẽ lỗi thiếu key.

## Đối chiếu tiêu chí nghiệm thu
| Tiêu chí (theo ticket) | Đáp ứng ở đâu (file:dòng, test nào) |
| --- | --- |
| 1. `--dry-run` chạy được trên máy không có key, liệt kê đủ 4 cấu hình × 2 ca × 3 lần (L4 là `SKIPPED_NO_LOCAL_FILE`), in đúng số nhãn V6 = 85, V10 = 39 | `python-worker/scripts/eval/live_round_feasibility.mjs:308-372`, lệnh `node python-worker/scripts/eval/live_round_feasibility.mjs --dry-run <outDir>` |
| 2. Thiếu `GEMINI_API_KEY` mà không có `--dry-run` thì thoát mã khác 0 và câu báo rõ ràng, không gọi mạng | `python-worker/scripts/eval/live_round_feasibility.mjs:29-34`, lệnh `node python-worker/scripts/eval/live_round_feasibility.mjs <outDir>` trả về mã 1 và báo lỗi |
| 3. Script không ghi gì vào repo ngoài chính nó, không đọc `.env`, không in key | `python-worker/scripts/eval/live_round_feasibility.mjs`, kết quả và nhãn tải về ghi vào `<outDir>` bên ngoài repo |
| 4. Không thêm dependency vào bất kỳ `package.json` nào | Chỉ dùng module chuẩn của Node (`fs`, `path`, `url`) và `globalThis.fetch` |

## Lệnh đã chạy
```powershell
# 1. Kiểm tra trường hợp thiếu key (không có --dry-run)
node python-worker/scripts/eval/live_round_feasibility.mjs "$env:TEMP\t039-eval"
LỖI: Biến môi trường GEMINI_API_KEY chưa được đặt. Vui lòng đặt GEMINI_API_KEY hoặc sử dụng cờ --dry-run.
# Exit code: 1

# 2. Kiểm tra --dry-run
node python-worker/scripts/eval/live_round_feasibility.mjs --dry-run "$env:TEMP\t039-eval"
1. THÔNG TIN NHÃN DỮ LIỆU:
  - Ca V6 (V6 (trận thật, 2 võ sĩ)): khung [36500, 38000) -> 85 nhãn (kỳ vọng: 85, nguồn: tải từ GitHub về: C:\Users\DAN\AppData\Local\Temp\t039-eval\labels\V6.csv)
  - Ca V10 (V10 (trận thật, 2 võ sĩ)): khung [4000, 5500) -> 39 nhãn (kỳ vọng: 39, nguồn: tải từ GitHub về: C:\Users\DAN\AppData\Local\Temp\t039-eval\labels\V10.csv)

2. KẾ HOẠCH CÁC LẦN GỌI (4 cấu hình × 2 ca × 3 lần = 24 lần gọi):
STT Ca   Cấu hình  Lần  Độ dài  FPS  Offset (s)          Nhãn  Trạng thái              Nguồn
------------------------------------------------------------------------------------------------------------------------
1   V6   L1        1/3  30.0s   1    1522.35s - 1552.35s 31    READY                   https://www.youtube.com/watch?v=cQW-h8yGbRc
2   V6   L1        2/3  30.0s   1    1522.35s - 1552.35s 31    READY                   https://www.youtube.com/watch?v=cQW-h8yGbRc
3   V6   L1        3/3  30.0s   1    1522.35s - 1552.35s 31    READY                   https://www.youtube.com/watch?v=cQW-h8yGbRc
4   V6   L2        1/3  62.6s   1    1522.35s - 1584.92s 85    READY                   https://www.youtube.com/watch?v=cQW-h8yGbRc
5   V6   L2        2/3  62.6s   1    1522.35s - 1584.92s 85    READY                   https://www.youtube.com/watch?v=cQW-h8yGbRc
6   V6   L2        3/3  62.6s   1    1522.35s - 1584.92s 85    READY                   https://www.youtube.com/watch?v=cQW-h8yGbRc
7   V6   L3        1/3  62.6s   5    1522.35s - 1584.92s 85    READY                   https://www.youtube.com/watch?v=cQW-h8yGbRc
8   V6   L3        2/3  62.6s   5    1522.35s - 1584.92s 85    READY                   https://www.youtube.com/watch?v=cQW-h8yGbRc
9   V6   L3        3/3  62.6s   5    1522.35s - 1584.92s 85    READY                   https://www.youtube.com/watch?v=cQW-h8yGbRc
10  V6   L4        1/3  62.6s   1    1522.35s - 1584.92s 85    SKIPPED_NO_LOCAL_FILE   D:\test\ai-worktrees\T-039\python-worker\test_results\external\boxingvi_original_20261006\rgb\cQW-h8yGbRc.mp4
11  V6   L4        2/3  62.6s   1    1522.35s - 1584.92s 85    SKIPPED_NO_LOCAL_FILE   D:\test\ai-worktrees\T-039\python-worker\test_results\external\boxingvi_original_20261006\rgb\cQW-h8yGbRc.mp4
12  V6   L4        3/3  62.6s   1    1522.35s - 1584.92s 85    SKIPPED_NO_LOCAL_FILE   D:\test\ai-worktrees\T-039\python-worker\test_results\external\boxingvi_original_20261006\rgb\cQW-h8yGbRc.mp4
13  V10  L1        1/3  30.0s   1    160.00s - 190.00s   17    READY                   https://www.youtube.com/watch?v=OfZFdwW322E
14  V10  L1        2/3  30.0s   1    160.00s - 190.00s   17    READY                   https://www.youtube.com/watch?v=OfZFdwW322E
15  V10  L1        3/3  30.0s   1    160.00s - 190.00s   17    READY                   https://www.youtube.com/watch?v=OfZFdwW322E
16  V10  L2        1/3  60.0s   1    160.00s - 220.00s   39    READY                   https://www.youtube.com/watch?v=OfZFdwW322E
17  V10  L2        2/3  60.0s   1    160.00s - 220.00s   39    READY                   https://www.youtube.com/watch?v=OfZFdwW322E
18  V10  L2        3/3  60.0s   1    160.00s - 220.00s   39    READY                   https://www.youtube.com/watch?v=OfZFdwW322E
19  V10  L3        1/3  60.0s   5    160.00s - 220.00s   39    READY                   https://www.youtube.com/watch?v=OfZFdwW322E
20  V10  L3        2/3  60.0s   5    160.00s - 220.00s   39    READY                   https://www.youtube.com/watch?v=OfZFdwW322E
21  V10  L3        3/3  60.0s   5    160.00s - 220.00s   39    READY                   https://www.youtube.com/watch?v=OfZFdwW322E
22  V10  L4        1/3  60.0s   1    160.00s - 220.00s   39    SKIPPED_NO_LOCAL_FILE   D:\test\ai-worktrees\T-039\python-worker\test_results\external\boxingvi_original_20261006\rgb\OfZFdwW322E.mp4
23  V10  L4        2/3  60.0s   1    160.00s - 220.00s   39    SKIPPED_NO_LOCAL_FILE   D:\test\ai-worktrees\T-039\python-worker\test_results\external\boxingvi_original_20261006\rgb\OfZFdwW322E.mp4
24  V10  L4        3/3  60.0s   1    160.00s - 220.00s   39    SKIPPED_NO_LOCAL_FILE   D:\test\ai-worktrees\T-039\python-worker\test_results\external\boxingvi_original_20261006\rgb\OfZFdwW322E.mp4
------------------------------------------------------------------------------------------------------------------------

3. TỔNG KẾT DRY-RUN:
  - Tổng số ca: 2 (V6, V10)
  - Số nhãn V6 trong [36500, 38000): 85 (khớp T-022)
  - Số nhãn V10 trong [4000, 5500): 39 (khớp T-022)
  - Tổng số lần gọi dự kiến: 24 (18 READY, 6 SKIPPED_NO_LOCAL_FILE)
  - Chế độ --dry-run: Hoàn thành kiểm tra kế hoạch, không gọi Gemini API.
# Exit code: 0
```

## Lệch so với ticket
Không có

## Câu hỏi / việc còn mở
Không có
