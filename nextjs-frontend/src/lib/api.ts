const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface AnalysisJob {
  id: string;
  videoUrl: string;
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
  resultUrl?: string;
  score?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateJobResponse {
  jobId: string;
  status: string;
  message: string;
}

export const api = {
  async createJob(videoUrl: string, userId = 'anonymous'): Promise<CreateJobResponse> {
    const res = await fetch(`${API_URL}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl, userId }),
    });
    if (!res.ok) throw new Error(`Tạo job thất bại: ${res.statusText}`);
    return res.json();
  },

  async getJob(jobId: string): Promise<AnalysisJob> {
    const res = await fetch(`${API_URL}/jobs/${jobId}`);
    if (!res.ok) throw new Error(`Không tìm thấy job: ${jobId}`);
    return res.json();
  },

  async listJobs(userId?: string): Promise<AnalysisJob[]> {
    const url = userId
      ? `${API_URL}/jobs?userId=${encodeURIComponent(userId)}`
      : `${API_URL}/jobs`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Lỗi lấy danh sách jobs');
    return res.json();
  },
};

/** Poll job status until DONE or FAILED */
export async function pollJobStatus(
  jobId: string,
  onUpdate: (job: AnalysisJob) => void,
  intervalMs = 2000,
  timeoutMs = 300_000,
): Promise<AnalysisJob> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(async () => {
      try {
        const job = await api.getJob(jobId);
        onUpdate(job);
        if (job.status === 'DONE' || job.status === 'FAILED') {
          clearInterval(timer);
          resolve(job);
        }
        if (Date.now() - start > timeoutMs) {
          clearInterval(timer);
          reject(new Error('Timeout: job xử lý quá lâu'));
        }
      } catch (e) {
        clearInterval(timer);
        reject(e);
      }
    }, intervalMs);
  });
}
