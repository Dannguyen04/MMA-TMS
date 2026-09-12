import { Client } from 'pg';
import fs from 'fs';

async function run() {
  const client = new Client({
    host: 'aws-0-ap-northeast-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.wskisxkpbhisnqfpjqrm',
    password: 'MartialArt@123',
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('Đang kết nối...');
    await client.connect();
    console.log('✅ Kết nối thành công!');

    const res = await client.query('SELECT COUNT(*) FROM analysis_jobs;');
    console.log(
      '✅ Bảng analysis_jobs đã tồn tại! Số dòng:',
      res.rows[0].count,
    );
  } catch (e) {
    console.error('❌ Lỗi:', e);
  } finally {
    await client.end();
  }
}
run();
