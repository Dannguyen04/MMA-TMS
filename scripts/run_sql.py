import psycopg2
import os
import sys

db_url = "postgresql://postgres:MartialArt%40123@db.wskisxkpbhisnqfpjqrm.supabase.co:5432/postgres"

def run_sql_file(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        sql = f.read()
    
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cursor = conn.cursor()
    try:
        cursor.execute(sql)
        print(f"Thực thi thành công: {filename}")
    except Exception as e:
        print(f"Lỗi khi chạy {filename}: {e}")
    finally:
        conn.close()

if __name__ == '__main__':
    run_sql_file(r'd:\test\ai\setup-buckets.sql')
    run_sql_file(r'd:\test\ai\nestjs-api\migrations\001_create_analysis_jobs.sql')

