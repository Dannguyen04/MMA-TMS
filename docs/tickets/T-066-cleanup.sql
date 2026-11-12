-- T-066 bước 0: dọn dữ liệu thử trên Supabase trước khi chạy seed demo.
-- Ken chạy tay trong Supabase SQL editor. Claude không chạy.
-- Chỉ XOÁ MỀM (đặt deleted_at), không DELETE dòng nào. Khôi phục: chạy lại với deleted_at = NULL cho cùng danh sách id.
-- Danh sách id lấy bằng GET qua API ngày 12/11/2026. Nếu số dòng cập nhật khác số mong đợi, khối DO báo lỗi và ROLLBACK toàn bộ.
-- Giữ lại: trận CAMP "Lotus Fight Night 14" (Aigerim); mọi tài khoản không phải @test.invalid.

BEGIN;

DO $$
DECLARE n int;
BEGIN
  -- 1. 14 trận thử ("ASD", "asdasd", "TEST API … xoá sau demo", "UAT … xoa sau demo", "LEage", "Lotus", "MMA").
  UPDATE bouts SET deleted_at = now(), updated_at = now()
  WHERE deleted_at IS NULL AND id IN (
    '5f291216-7dfb-45db-be05-8953af01ace4', 'ef8d403f-572e-4b32-a04c-2dfbc6aeec4e',
    '7e62c95e-778b-4ccb-89e3-442604f4a10d', 'e5587d50-f06d-4eef-aa5b-fcc383ac5a9b',
    'd5c4472d-0524-47d6-8a93-5a0313ea350b', 'd2d90164-64df-4f12-8197-15ff548e7c43',
    'ee1adf19-78b5-4ff8-8834-8872b5e5ed19', '3b18d8cf-9206-47ba-b599-f589ddad6ba9',
    '47c7850d-cdac-493b-a92f-66b189d71511', '7f8752fe-20d7-40ed-9e6f-c7fa1762c881',
    '0b915224-b226-4508-81b9-d818c8af5cf4', 'ecde8c16-f6ec-4382-a94e-10e61c88e86c',
    '927b5268-e2a0-456b-965e-ffc283244b4f', 'a2597f9e-f08b-4b28-acc4-3a171312e028');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 14 THEN RAISE EXCEPTION 'bouts: mong 14, thực tế %', n; END IF;

  -- 2. 10 đình chỉ thử (Anh 3, Kenji 5 KO trùng, Aigerim 2).
  UPDATE suspensions SET deleted_at = now(), updated_at = now()
  WHERE deleted_at IS NULL AND id IN (
    '17b187b8-ef60-484e-9215-bb9d86474dc7', 'ad57d4ec-e75a-4a8b-ac69-5c502ba14b49',
    'd079a07e-5feb-409e-9bcf-d9e66326751a', '352c7ccf-eaea-493c-9e1e-5616ac00f273',
    '9fab4bca-b3bb-4dcd-9aac-fa9850f3d435', 'ae05848c-412f-4817-8412-aed7fba848a9',
    'd4c7e477-d941-4e36-9786-75a08b6a8de7', 'ea671f76-329f-4031-8769-4233566f7774',
    '05dfbcbd-05e4-497f-aac9-f6babcc88107', 'bfca3abd-ee2c-4ad6-89a7-2ea16002c32e');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 10 THEN RAISE EXCEPTION 'suspensions: mong 10, thực tế %', n; END IF;

  -- 3. 44 tài khoản @test.invalid (30 HLV, 14 võ sĩ), sinh từ test e2e chạy vào Supabase.
  --    Làm giống UsersRepository.softDelete: tắt hồ sơ vai trò rồi tắt user.
  UPDATE coaches SET is_active = false, deleted_at = now(), updated_at = now()
  WHERE deleted_at IS NULL AND user_id IN (SELECT id FROM users WHERE email LIKE '%@test.invalid' AND deleted_at IS NULL);
  UPDATE fighters SET is_active = false, deleted_at = now(), updated_at = now()
  WHERE deleted_at IS NULL AND user_id IN (SELECT id FROM users WHERE email LIKE '%@test.invalid' AND deleted_at IS NULL);
  UPDATE users SET is_active = false, deleted_at = now(), updated_at = now()
  WHERE deleted_at IS NULL AND email LIKE '%@test.invalid';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 44 THEN RAISE EXCEPTION 'users @test.invalid: mong 44, thực tế %', n; END IF;
END $$;

COMMIT;
