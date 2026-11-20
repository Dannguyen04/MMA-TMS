# Kiến trúc app mobile (reactnative-mobile)

Expo SDK 57, React Native, Expo Router. Mỗi vai trò (võ sĩ, HLV, bác sĩ, admin) có một nhóm route riêng. App gọi NestJS API (`nestjs-api`) qua một lớp HTTP duy nhất dùng axios.

## Đi một vòng: từ màn hình tới API

```
src/app/(coach)/fight-camp/bout.tsx              1. Route: file 1 dòng, chỉ re-export màn hình
  → src/features/fight-camp/screens/...          2. Màn hình: state, ghép component, gọi campApi
    → src/features/fight-camp/api.ts             3. API của tính năng: campApi.detail(id) ...
      → src/api/core/client.ts  apiFetch()       4. Refresh sớm, retry khi 401, bóc { success, data }
        → src/api/core/http.ts  axios instance   5. baseURL, timeout, gắn token Bearer
          → src/api/core/config.ts API_BASE_URL  6. Lấy từ EXPO_PUBLIC_API_URL
```

Khi bị hỏi "chức năng X gọi API nào", hãy đi ngược chuỗi trên: route → màn hình → `xxxApi.method` → endpoint.

## Thư mục `src/`

| Thư mục | Vai trò |
|---|---|
| `app/` | Route Expo Router. Mỗi file là một URL; phần lớn chỉ có 1 dòng `export { X as default } from "@/..."`. Layout của từng vai trò: `app/(role)/_layout.tsx`. |
| `features/<tên>/` | Một tính năng gói trọn: `api.ts`, `screens/`, `components/`, `logic/`, `state/`, `i18n/`, `README.md` (sơ đồ chức năng → file → API). Hiện đã có **fight-camp**. |
| `screens/<vai trò>/` | Màn hình chưa chuyển sang `features/` (admin, coach, doctor, fighter, media, medical, admissions…). |
| `shared/ui/` | Giao diện dùng chung cho mọi vai trò: `camp-ui` (CampShell, thẻ, nút, WeightPlot), `camp-lit` (tab, hiệu ứng sáng), `camp-motion`, `camp-columns`, `tab-fire`. |
| `components/` | Component dùng chung khác: tab bar, bàn phím, 3D cơ thể, lịch tuần, biểu đồ… |
| `api/` | Gọi backend, chia theo nghiệp vụ: `core/` (lớp HTTP axios: http, client, config, tokens, errors, query), `auth/`, `admissions/`, `admin/`, `coach/`, `doctor/`, `fighters/` (võ sĩ, trận), `medical/` (y tế, thao tác 1 chạm), `training/` (giáo án), `video/` (media, evidence, video-ai), `notifications/`. `types.ts` là kiểu dữ liệu chung, `index.ts` gom export. File `*.mock.ts` là dữ liệu giả cho test, nằm cạnh file API của nó. |
| `session/` | Đăng nhập, phiên, chặn route theo vai trò (`role-gate.tsx`, `session-context.tsx`). |
| `i18n/` | Chữ tiếng Việt của các màn hình chưa chuyển. |
| `theme/` | Màu, chữ, khoảng cách, chuyển động (`motion.ts`), giao diện sáng/tối. |
| `utils/` | Hàm nhỏ: ngày giờ VN, nhập cân nặng, log dev. |

Alias `@/` trỏ vào `src/` (tsconfig.json và jest.config.js).

## Lớp HTTP (axios)

| File | Làm gì |
|---|---|
| `src/api/core/config.ts` | `API_BASE_URL`: lấy `EXPO_PUBLIC_API_URL` (shell > `.env.local` > `.env`, được nhúng vào bundle lúc build), sau đó tới `app.json` `extra`, cuối cùng là mặc định `http://localhost:3001`. Bản dev tự đổi localhost thành IP LAN / `10.0.2.2` (`core/dev-api-host.ts`). Bản release giữ nguyên giá trị. |
| `src/api/core/http.ts` | `http = axios.create(...)`: baseURL, timeout 90 giây (upload không giới hạn), interceptor gắn `Authorization: Bearer <accessToken>` và Content-Type. |
| `src/api/core/client.ts` | `apiFetch<T>(path, options)`: hàm duy nhất các file API gọi. Nó refresh token sớm khi còn dưới 60 giây, gặp 401 thì refresh một lần rồi thử lại, lỗi mạng thì ném `ApiError(0, "NETWORK_ERROR")`, và bóc `{ success: true, data }` ra `data`. `refreshSession()` chỉ chạy một lần cho mọi request đang chờ. |
| `src/api/core/tokens.ts` | Lưu phiên trong SecureStore (và bộ nhớ RAM). |
| `src/api/core/errors.ts` | `ApiError` với `status` và `code` lấy từ body lỗi của Nest. |
| `src/api/core/query.ts` | `withQuery(path, obj)` dựng query string. |

`xxxApi.yyy(...)` là hàm **gọi** endpoint. `withQuery` chỉ **dựng URL**, nó không gửi request nào.

Có ba chỗ dùng `fetch` trực tiếp mà không qua axios, và đều là có chủ ý:

- `api/video/media.ts`: HEAD để kiểm tra video stream.
- `screens/media/video-upload.tsx`: đọc file cục bộ trên máy.
- `screens/admin/overview/admin-overview-v2-screen.tsx`.

## Thêm hoặc chuyển một tính năng

1. Tạo `src/features/<tên>/` với các thư mục như của fight-camp, chỉ tạo thư mục nào thật sự cần.
2. Chuyển file bằng `git mv`, sửa import về dạng `@/features/<tên>/...`, và nhớ sửa cả `jest.mock("...")` trong test.
3. Code dùng chung cho nhiều vai trò thì để ở `shared/`, không để trong tính năng.
4. Viết `README.md` cho tính năng: bảng route → màn hình và bảng chức năng → file:dòng → API.
5. Chạy gate: `npx tsc --noEmit -p .` (hiện có 19 lỗi cũ, không được tăng) và `npx jest`.
