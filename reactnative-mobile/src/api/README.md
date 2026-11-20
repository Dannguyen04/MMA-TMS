# src/api: gọi backend NestJS

Mỗi thư mục ứng với một nghiệp vụ. Hàm trong các thư mục nghiệp vụ đều gọi `apiFetch` (`core/client.ts`), và `apiFetch` gửi request bằng axios (`core/http.ts`).

Fight Camp không nằm ở đây. API của nó ở `src/features/fight-camp/api.ts`.

| Thư mục | File | Endpoint Nest | Ghi chú |
|---|---|---|---|
| `core/` | `http.ts` | | Axios instance: baseURL, timeout 90 giây, gắn token |
| | `client.ts` | `/auth/refresh` | `apiFetch`: refresh token, retry khi 401, bóc `{ success, data }` |
| | `config.ts`, `dev-api-host.ts` | | `API_BASE_URL` lấy từ `EXPO_PUBLIC_API_URL` |
| | `tokens.ts` | | Lưu phiên (SecureStore) |
| | `errors.ts` | | `ApiError` (status và code) |
| | `query.ts` | | `withQuery`: chỉ dựng query string, không gọi mạng |
| | `system.ts` | `/health` | |
| `auth/` | `auth.ts` | `/auth`, `/users` | Đăng nhập, quên mật khẩu, lấy thông tin bản thân |
| | `users.ts` | `/users` | Quản lý người dùng (admin) |
| | `role-contracts.ts` | | Quyền mặc định theo vai trò (hằng số, không gọi mạng) |
| `admissions/` | `admissions.ts` | `/fighter-admissions` | Hồ sơ tuyển võ sĩ |
| `admin/` | `admin.ts` | | `adminApi`: gom các API khác cho màn admin |
| `coach/` | `coach.ts`, `coach-nav.ts` | | `coachApi`, `coachNavApi`: gom API võ sĩ, y tế, video cho HLV |
| | `coach-today.ts` | `/coach`, `/readiness` | Màn "Hôm nay" của HLV |
| `doctor/` | `doctor-ro.ts` | | `doctorRoApi`: dữ liệu chỉ đọc cho bác sĩ |
| | `schedule.ts` | `/doctor/schedule` | Lịch bác sĩ |
| `fighters/` | `fighters.ts` | `/fighters` | Hồ sơ võ sĩ, số đo cơ thể, HLV phụ trách |
| | `bouts.ts` | | `boutsApi`: trận của võ sĩ |
| `medical/` | `medical.ts` | `/fighters`, `/doctors` | Khám, chấn thương, giấy phép thi đấu |
| | `one-tap.ts` | nhiều endpoint | Thao tác ghi 1 chạm (xác nhận, yêu cầu khám…) |
| `training/` | `training.ts` | `/training-plans`, `/training-sessions`, `/exercises` | Giáo án, buổi tập, bài tập |
| `video/` | `media.ts` | `/videos`, `/jobs` | Tải và phát video |
| | `video-ai.ts`, `evidence.ts` | `/jobs`, `/movement-evidence`, `/coaching` | Kết quả AI phân tích video |
| `notifications/` | `notifications.ts` | `/notifications` | Thông báo |

`types.ts` chứa kiểu dữ liệu dùng chung. `index.ts` gom export cho `import { ... } from "@/api"`.

## Mock

`xxx.mock.ts` nằm cạnh file thật. `admin`, `coach`, `doctor-ro` và `bouts` chỉ dùng mock khi biến `EXPO_PUBLIC_*_MOCK=true` (ví dụ `EXPO_PUBLIC_COACH_MOCK`). Bản build bình thường luôn gọi API thật.
