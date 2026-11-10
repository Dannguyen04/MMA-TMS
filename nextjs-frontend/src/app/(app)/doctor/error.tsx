"use client";

import { RotateCcw } from "lucide-react";
import { useEffect } from "react";

import { ErrorBox } from "@/components/doctor/ui";

export default function DoctorError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
    useEffect(() => {
        console.error(error);
    }, [error]);
    return (
        <div className="yt-page">
            <ErrorBox
                title="Không tải được dữ liệu"
                action={
                    <button type="button" className="yt-btn" data-v="primary" onClick={() => retry()}>
                        <RotateCcw aria-hidden />
                        Thử lại
                    </button>
                }
            >
                Máy chủ y tế không phản hồi hoặc trả lỗi. Hãy thử lại; nếu vẫn lỗi, báo cho quản trị viên.
                {error.digest && <span className="yt-muted"> Mã tham chiếu: {error.digest}</span>}
            </ErrorBox>
        </div>
    );
}
