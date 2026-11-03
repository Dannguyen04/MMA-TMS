"use client";

import { CalendarCheck, CircleCheck, RefreshCw, RotateCcw, TriangleAlert } from "lucide-react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { toFormData } from "@/components/ui/use-action-form";
import { useConfirmAction } from "@/components/ui/use-confirm-action";
import { updateInjuryAction } from "@/lib/actions/clinical";
import { IDLE } from "@/lib/actions/state";
import type { InjuryStatus } from "@/lib/domain/types";

type Transition = "recovering" | "resolved" | "reopen";

export interface InjuryStatusActionsProps {
    injuryId: string;
    fighterId: string;
    status: InjuryStatus;
    fighterName: string;
    /** False where resolved is final (the medical service): a recurrence is recorded as a new injury instead. */
    canReopen: boolean;
    /** Title of a recovery plan still in progress for this injury, if any. */
    openPlanTitle: string | null;
    /** Today's date, already formatted for display. */
    todayLabel: string;
}

const TARGET_STATUS: Record<Transition, InjuryStatus> = { recovering: "recovering", resolved: "resolved", reopen: "recovering" };

/** Moves an injury through active → recovering → resolved (or reopens it), each behind a confirmation. */
export function InjuryStatusActions({ injuryId, fighterId, status, fighterName, canReopen, openPlanTitle, todayLabel }: InjuryStatusActionsProps) {
    const toast = useToast();
    const transition = useConfirmAction((next: Transition) => updateInjuryAction(IDLE, toFormData({ injuryId, fighterId, status: TARGET_STATUS[next] })), {
        onSuccess: (state) => toast({ title: "Đã cập nhật chấn thương", description: state.message }),
    });

    const copy: Record<Transition, { title: string; description: string; confirmLabel: string }> = {
        recovering: {
            title: "Chuyển chấn thương sang đang phục hồi?",
            description: `${fighterName} ra khỏi giai đoạn cấp. Tình trạng sức khỏe được tính lại — thường là Phục hồi — và HLV vẫn chỉ thấy giấy phép.`,
            confirmLabel: "Chuyển sang đang phục hồi",
        },
        resolved: {
            title: "Đánh dấu chấn thương đã khỏi?",
            description: canReopen
                ? `Hồ sơ chấn thương sẽ được đóng. Tình trạng sức khỏe của ${fighterName} được tính lại từ giấy phép và các chấn thương đang mở khác; võ sĩ và HLV được thông báo. Giấy phép không thay đổi — hãy xem lại riêng.`
                : `Hồ sơ chấn thương được đóng hẳn: nếu tái phát, hãy ghi chấn thương mới. Giấy phép không thay đổi — hãy xem lại riêng.`,
            confirmLabel: "Đánh dấu đã khỏi",
        },
        reopen: {
            title: "Mở lại chấn thương này?",
            description: `Chấn thương quay về Đang phục hồi và ngày khỏi bị xóa. Tình trạng sức khỏe của ${fighterName} được tính lại.`,
            confirmLabel: "Mở lại chấn thương",
        },
    };

    const active = transition.payload ? copy[transition.payload] : null;

    return (
        <>
            {status === "active" && (
                <Button variant="secondary" onClick={() => transition.request("recovering")}>
                    <RefreshCw aria-hidden />
                    Chuyển sang đang phục hồi
                </Button>
            )}
            {status !== "resolved" && (
                <Button variant="secondary" onClick={() => transition.request("resolved")}>
                    <CircleCheck aria-hidden />
                    Đánh dấu đã khỏi
                </Button>
            )}
            {status === "resolved" && canReopen && (
                <Button variant="secondary" onClick={() => transition.request("reopen")}>
                    <RotateCcw aria-hidden />
                    Mở lại chấn thương
                </Button>
            )}

            <ConfirmDialog
                {...transition.dialogProps}
                title={active?.title ?? ""}
                description={active?.description ?? ""}
                confirmLabel={active?.confirmLabel ?? ""}
                tone="primary"
            >
                {transition.payload === "resolved" && (
                    <div className="flex flex-col gap-3">
                        <InlineNote icon={CalendarCheck}>
                            Ngày khỏi: <span className="font-medium text-fg">{todayLabel}</span> (hôm nay — ghi khi bạn xác nhận)
                        </InlineNote>
                        {openPlanTitle && (
                            <InlineNote icon={TriangleAlert} tone="warning">
                                Kế hoạch phục hồi “{openPlanTitle}” vẫn đang thực hiện và giữ mở cho đến khi hoàn tất giai đoạn cuối.
                            </InlineNote>
                        )}
                    </div>
                )}
            </ConfirmDialog>
        </>
    );
}
