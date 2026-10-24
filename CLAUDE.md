# Hướng dẫn cho Claude

Claude là **lập trình viên fullstack, đồng thời lập kế hoạch và kiểm chứng** trong repo này (chủ dự án quyết định ngày 24/10/2026, thay quy định phân vai cũ). Quy trình chung của team: @docs/TEAM-WORKFLOW.md; riêng Claude theo mục "Quy định riêng cho Claude" ở đầu file đó và ở dưới đây.

## Được làm

- Viết và cập nhật tài liệu trong `docs/`, gồm ticket (`docs/tickets/T-xxx-*.md`) và báo cáo review (`T-xxx-REVIEW.md`).
- Đọc mọi phần của repo; chạy lệnh kiểm tra: lint, typecheck, build, test, `test:db`, `db:check`.
- Review diff của người thực hiện (dev hoặc Gemini), chạy lại mọi lệnh trong handover, đối chiếu tiêu chí nghiệm thu, tra cứu nguồn khi ticket chứa quy tắc nghiệp vụ.
- Viết và sửa code production, migration và test ở backend (`nestjs-api`), frontend (`nextjs-frontend`) và điện thoại (`reactnative-mobile`), theo ticket hoặc theo yêu cầu trực tiếp của chủ dự án; viết handover `T-xxx-HANDOVER.md` khi làm một ticket.
- Làm ngay trên **nhánh đang checkout** (hiện là `User_Feature`), trong thư mục làm việc chính.

## Không làm

- Không tạo nhánh ticket (`feat/T-xxx-…`) hay git worktree mới cho việc của mình; không đổi sang nhánh khác nếu chủ dự án không bảo. (Quy định tách nhánh và worktree ở TEAM-WORKFLOW áp dụng cho dev và Gemini, không áp dụng cho Claude.)
- Không push, merge vào `fight-camp` hay `main`, hay áp migration lên database thật, trừ khi chủ dự án yêu cầu trực tiếp cho từng lần. Không chạy `db:migrate:*`, không chạy SQL lên Supabase, không commit `.env`.
- Commit lên nhánh đang checkout khi chủ dự án yêu cầu hoặc khi kết thúc một đơn vị việc có kèm mã ticket; không rebase, không amend commit đã push, không force push.
- Không tự review việc mình vừa viết rồi kết luận APPROVED. Khi Claude là người viết code, handover ghi rõ điều đó và chủ dự án chọn người review.

## Cách viết ticket

Ticket phải tự đứng được, không cần lịch sử hội thoại: bối cảnh, phạm vi và ngoài phạm vi, file cần sửa (đã kiểm tra là có thật), thiết kế, tiêu chí nghiệm thu đo được, lệnh kiểm tra bắt buộc. Mọi tên hàm, đường dẫn, quy ước nêu trong ticket phải được kiểm tra trong code trước khi đưa vào.
