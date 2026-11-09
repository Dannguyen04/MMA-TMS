"use client";

import { RotateCcw } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

export default function DoctorError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
    useEffect(() => {
        console.error(error);
    }, [error]);
    return (
        <div className="flex flex-col gap-6">
            <ErrorState
                title="Không tải được dữ liệu"
                description={
                    <>
                        Máy chủ y tế không phản hồi hoặc trả lỗi. Hãy thử lại; nếu vẫn lỗi, báo cho quản trị viên.
                        {error.digest && <span className="mt-2 block text-xs text-fg-subtle">Mã tham chiếu: {error.digest}</span>}
                    </>
                }
                action={
                    <Button type="button" onClick={() => retry()}>
                        <RotateCcw aria-hidden />
                        Thử lại
                    </Button>
                }
            />
        </div>
    );
}
