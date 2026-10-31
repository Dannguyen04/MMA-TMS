# T-032 - Sửa lỗi DTO Backend và tạo JSON Schema

## Người phụ trách

- Backend: Ken
- Người bàn giao: Phong
- Ngày: 2026-10-27

## Bối cảnh

Sau khi merge `fight-camp` vào `feat/mobile-platform` và khôi phục các thay
đổi local, Backend gặp lỗi khi khởi động ứng dụng:

```text
Error: Date cannot be represented in JSON Schema
    at .../zod/v4/core/to-json-schema.js
    at .../nestjs-zod/...
```

Ngoài ra, hai luồng assignment cùng expose class DTO tên `AssignCoachDto`, có
thể gây trùng tên model khi `nestjs-zod` tạo metadata OpenAPI.

## Phạm vi file

- `nestjs-api/src/fighter-admissions/fighter-admissions.controller.ts`
- `nestjs-api/src/fighter-admissions/fighter-admissions.dto.ts`
- `nestjs-api/src/suspensions/suspensions.dto.ts`
- `nestjs-api/src/suspensions/suspensions.dto.spec.ts`

## Vấn đề 1 - Trùng tên DTO OpenAPI

### Nguyên nhân

Luồng fighter-admissions và luồng fighters đều có DTO tên `AssignCoachDto`.
Khi sinh metadata OpenAPI, hai DTO có thể bị trùng tên.

### Cách xử lý

Đổi tên DTO chỉ dành cho fighter-admissions:

```ts
AssignCoachDto -> AdmissionAssignCoachDto
```

Đồng thời cập nhật `FighterAdmissionsAdminController` để sử dụng
`AdmissionAssignCoachDto`.

DTO của luồng fighters vẫn giữ tên `AssignCoachDto`.

## Vấn đề 2 - `z.date()` không thể biểu diễn trong JSON Schema

### Nguyên nhân

Trong `conflictProposalResponseSchema` có trường:

```ts
toScheduledAt: z.union([z.date(), isoDateTimeSchema]).optional()
```

`z.date()` dùng được khi parse ở runtime/domain, nhưng Zod 4 không thể chuyển
trực tiếp kiểu `Date` sang JSON Schema. `createZodDto()` đưa schema này vào
`nestjs-zod`, khiến ứng dụng crash trong lúc bootstrap và tạo metadata
OpenAPI.

### Cách xử lý

Giữ nguyên domain schema, nhưng override schema ở HTTP DTO bằng chuỗi ISO
datetime tương thích JSON Schema:

```ts
import { z } from 'zod';

export class ConflictProposalResponseDto extends createZodDto(
  conflictProposalResponseSchema.extend({
    toScheduledAt: z.iso.datetime({ offset: true }).optional(),
  }),
) {}
```

Hành vi API sau khi sửa:

- OpenAPI mô tả `toScheduledAt` là `string` với format `date-time`.
- Payload HTTP sử dụng chuỗi ISO datetime.
- Domain model vẫn có thể xử lý giá trị `Date` nội bộ.

Không revert DTO về `conflictProposalResponseSchema` nguyên bản, nếu không lỗi
`Date cannot be represented in JSON Schema` sẽ xuất hiện lại.

## Test cần có

File:

```text
nestjs-api/src/suspensions/suspensions.dto.spec.ts
```

Test phải xác nhận:

1. `ConflictProposalResponseDto` chuyển được sang JSON Schema.
2. `toScheduledAt` có kiểu `string` và format `date-time`.
3. Giá trị `Date` sau khi serialize thành ISO string được DTO chấp nhận.
4. `AdmissionAssignCoachDto` và `AssignCoachDto` có tên OpenAPI khác nhau.

## Kiểm tra đã thực hiện

```powershell
pnpm --dir nestjs-api test -- src/suspensions/suspensions.dto.spec.ts
pnpm --dir nestjs-api build
```

Kết quả:

```text
Test Files  1 passed
Tests       2 passed
Backend build: passed
```

## Tiêu chí hoàn thành

- [ ] Ken review bốn file trong phạm vi ticket.
- [ ] Backend khởi động không còn lỗi `Date cannot be represented in JSON Schema`.
- [ ] Hai DTO assignment có tên OpenAPI riêng biệt.
- [ ] Regression test chạy pass.
- [ ] Build `nestjs-api` chạy pass.
- [ ] Commit thay đổi Backend và thông báo lại branch/commit cho team.
