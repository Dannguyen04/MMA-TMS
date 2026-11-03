# T-046 · Nhúng video YouTube vào màn phân tích đối thủ, bấm quan sát là tua tới đúng mốc

| | |
| --- | --- |
| **Trạng thái** | READY (29/10) |
| **Người nhận** | Hoàng Anh |
| **Nhánh** | `feat/T-046-embedded-youtube`, tạo từ `feat/T-033-opponent-analysis-ui` (màn phân tích đối thủ chưa có trên `fight-camp`) |
| **Nguồn** | Chủ dự án đề xuất 29/10: "nhúng video từ link YouTube để HLV dễ xem". [T-033](./T-033-opponent-analysis-ui.md) |
| **Phụ thuộc** | T-033 (IN REVIEW). Không cần backend, không migration, không tốn hạn mức Gemini |

## 1. Bối cảnh

Trên nhánh T-033, mỗi quan sát có `evidenceUrl` (link YouTube) và `evidenceTime` (`mm:ss`). Màn hình hiện một link mở YouTube ở tab mới, đúng mốc thời gian (`videoUrlAt` trong `nextjs-frontend/src/lib/domain/opponent-video-suggestions.ts`; link hiện ở `opponent-analysis-view.tsx` quanh dòng 420). Gợi ý quan sát từ AI cũng trả về link và mốc `time`. Muốn xem lại, HLV phải rời màn hình, rồi quay lại để đối chiếu quan sát.

## 2. Phạm vi

1. **Component mới** `nextjs-frontend/src/components/video/youtube-player.tsx`: nhận `url` và `startSeconds`, render `<iframe>` tới `https://www.youtube-nocookie.com/embed/<videoId>?start=<giây>&rel=0`. Tỉ lệ 16:9, rộng 100 % khung chứa, `loading="lazy"`, `allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"`, `allowFullScreen`, `title` theo ngôn ngữ. **Không** dùng YouTube IFrame API (không tải script ngoài); tua bằng cách đổi `src`.
2. **Hàm thuần** trong `opponent-video-suggestions.ts`: `youtubeVideoId(url)` đọc được 4 dạng mà `isSupportedVideoUrl` chấp nhận (`watch?v=`, `youtu.be/`, `shorts/`, `m.youtube.com`), sai dạng thì trả `null`; `embedUrl(url, time?)` dùng lại `timeToSeconds`. Có unit test.
3. **Màn phân tích đối thủ** (`opponent-analysis-view.tsx`):
   - Có ít nhất một quan sát có link YouTube hợp lệ thì hiện **một** khung video ở đầu khối quan sát (máy tính: cột bên phải, cố định khi cuộn; điện thoại: phía trên danh sách).
   - Mỗi quan sát có link và mốc thời gian thì có nút **"Xem ở {mm:ss}"**. Bấm thì khung video chuyển sang video đó, tua đúng mốc, và không rời trang. Link "mở YouTube" giữ lại, làm đường dự phòng.
   - Nhiều quan sát dùng các video khác nhau thì khung đổi video theo quan sát được bấm.
   - Gợi ý quan sát từ AI (T-033) cũng có nút "Xem ở {mm:ss}" để HLV kiểm tra trước khi bấm "Dùng".
4. Từ điển `bout-analysis.vi.ts`, `bout-analysis.en.ts`: các câu mới.

## 3. Ngoài phạm vi

Thẻ góc đài (bản in), màn ghi hiệp, báo cáo trận (làm sau ở T-047 hoặc T-041 bằng chính component này), video không phải YouTube, tải video lên.

## 4. Tiêu chí nghiệm thu

1. `youtubeVideoId` và `embedUrl` có unit test cho 4 dạng link, link có sẵn `t=`, mốc `h:mm:ss`, và link sai.
2. Demo mode, trận `bout-weighed-in`: bấm "Xem ở 01:23" thì khung video phát từ 83 s, trang không chuyển.
3. Không quan sát nào có link hợp lệ thì không render khung video, không có iframe rỗng.
4. Không thêm script ngoài, không thêm thư viện. CSP vẫn giữ `frame-ancestors 'none'` (`src/proxy.ts`); nếu sau này thêm `frame-src` thì phải cho phép `https://www.youtube-nocookie.com`.
5. 1280 px và 390 px: không cuộn ngang, video giữ tỉ lệ 16:9. Có ảnh chụp màn hình trong handover.
6. `pnpm --filter nextjs-frontend lint`, `typecheck`, `test` không thêm lỗi so với nhánh gốc.
