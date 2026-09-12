'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { uploadVideo } from '@/lib/supabase';
import { api, pollJobStatus, type AnalysisJob } from '@/lib/api';

type UploadStage = 'idle' | 'uploading' | 'queued' | 'processing' | 'done' | 'error';

const STAGE_LABELS: Record<UploadStage, string> = {
  idle: 'Chọn file video',
  uploading: 'Đang upload...',
  queued: 'Đã xếp hàng — chờ Worker',
  processing: 'Worker đang phân tích...',
  done: 'Phân tích xong!',
  error: 'Có lỗi xảy ra',
};

export default function AnalysisPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<UploadStage>('idle');
  const [uploadPct, setUploadPct] = useState(0);
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('video/')) { setError('Chỉ chấp nhận file video (MP4, MOV, ...)'); return; }
    if (f.size > 500 * 1024 * 1024) { setError('File tối đa 500MB'); return; }
    setFile(f);
    setError('');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) { setFile(f); setError(''); }
  };

  const handleSubmit = async () => {
    if (!file) return;
    setError('');
    try {
      // 1. Upload video lên Supabase Storage
      setStage('uploading');
      const videoUrl = await uploadVideo(file, setUploadPct);

      // 2. Gửi URL cho NestJS → tạo job
      setStage('queued');
      const { jobId } = await api.createJob(videoUrl);

      // 3. Poll cho đến khi xong
      setStage('processing');
      const finalJob = await pollJobStatus(jobId, (j) => setJob(j));
      setJob(finalJob);

      if (finalJob.status === 'DONE') {
        setStage('done');
        // Chuyển đến trang kết quả
        setTimeout(() => router.push(`/analysis/${jobId}`), 1000);
      } else {
        setStage('error');
        setError('Worker báo lỗi — vui lòng thử lại');
      }
    } catch (e: any) {
      setStage('error');
      setError(e.message ?? 'Lỗi không xác định');
    }
  };

  const isBusy = ['uploading', 'queued', 'processing'].includes(stage);
  const stageColor = stage === 'done' ? 'text-green-400' : stage === 'error' ? 'text-red-400' : 'text-blue-400';

  return (
    <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xl">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/" className="text-gray-500 hover:text-white transition text-sm">← Trang chủ</Link>
          <span className="text-gray-700">/</span>
          <span className="text-white font-semibold">Upload Video</span>
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">🎬 Phân tích Video</h1>
        <p className="text-gray-400 text-sm mb-8">Upload video MP4 — AI sẽ phân tích từng cú đá với YOLOv8-Pose</p>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => !isBusy && fileRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer
            ${ file ? 'border-blue-500/60 bg-blue-500/5' : 'border-gray-700 hover:border-gray-500 bg-gray-900'}
            ${ isBusy ? 'pointer-events-none opacity-70' : '' }`}
        >
          <input ref={fileRef} type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
          {file ? (
            <div>
              <div className="text-4xl mb-2">🎥</div>
              <p className="text-white font-medium">{file.name}</p>
              <p className="text-gray-500 text-sm mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
          ) : (
            <div>
              <div className="text-4xl mb-2">📂</div>
              <p className="text-gray-300">Kéo thả hoặc click để chọn video</p>
              <p className="text-gray-600 text-sm mt-1">MP4, MOV — tối đa 500MB</p>
            </div>
          )}
        </div>

        {/* Upload progress */}
        {stage === 'uploading' && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Đang upload</span>
              <span>{uploadPct}%</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 transition-all rounded-full" style={{ width: `${uploadPct}%` }} />
            </div>
          </div>
        )}

        {/* Status */}
        {stage !== 'idle' && (
          <div className={`mt-4 text-sm font-medium ${stageColor}`}>
            {stage === 'processing' && <span className="animate-pulse">⏳ </span>}
            {STAGE_LABELS[stage]}
            {job && <span className="text-gray-500 ml-2">({job.status})</span>}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!file || isBusy}
          className="mt-6 w-full py-3 rounded-xl font-semibold text-white transition-all
            bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
        >
          {isBusy ? 'Đang xử lý...' : 'Bắt đầu phân tích'}
        </button>
      </div>
    </main>
  );
}
