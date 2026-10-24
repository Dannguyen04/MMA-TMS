# Backend: hướng dẫn cho Claude

Từ 2026-10-24, Claude **được viết code production, migration và test** ở backend, ngoài việc lập kế hoạch, viết ticket, review và chạy kiểm tra, và làm ngay trên nhánh đang checkout (không tách nhánh, không worktree): xem [CLAUDE.md gốc](../CLAUDE.md) và [quy trình team](../docs/TEAM-WORKFLOW.md). Quy ước backend mà ticket, code và review đối chiếu nằm ở [nestjs-api/AGENTS.md](AGENTS.md); khi Claude viết code thì áp dụng chính các quy ước đó.

## Danh mục review backend

- Diff đúng phạm vi ticket; không đụng khu vực đóng băng.
- Quy ước module, guard, permission, phạm vi theo bản ghi, audit context, envelope, mã lỗi.
- Migration: preflight ledger, advisory lock, `migration_history`, checksum, `migration-files.mjs`, `run_sql.mjs`, script `package.json`, README migrations, ca trong `test-migrations.mjs`; khớp với `src/database/schema.ts`.
- Hàm nghiệp vụ thuần có test; test bao phủ các ca trong tiêu chí nghiệm thu của ticket.
- Chạy lại: `pnpm --filter nestjs-api lint`, `build`, `test`, `test:db`, `db:check`. Không chạy `db:migrate:*`.
