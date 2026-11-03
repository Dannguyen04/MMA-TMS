import { useCallback } from "react";

import { listBouts, getWeightTrack, pickActiveBout, type Bout, type WeightTrack } from "@/api/bouts";
import { useLoad } from "@/screens/fighter/use-load";
import { mockBoutsApi } from "@/api/bouts.mock";
import { useSession } from "@/session/session-context";

export type BoutsData = {
  bouts: Bout[];
  active: Bout | null;
  /** Đường cân của trận `active` (null khi không có trận). */
  track: WeightTrack | null;
};

/** Tải danh sách trận + đường cân của trận đang hoạt động (dùng cho trang chủ, trang trận, ghi cân). */
export function useBouts(selectedId?: string | null) {
  const { user, isDemo, gate } = useSession();
  const load = useCallback(async (): Promise<BoutsData> => {
    const bouts = await (isDemo ? mockBoutsApi.listBouts() : listBouts());
    const picked = selectedId ? bouts.find((bout) => bout.id === selectedId) : undefined;
    const active = picked ?? pickActiveBout(bouts);
    const track = active ? await (isDemo ? mockBoutsApi.getWeightTrack(active.id) : getWeightTrack(active.id)) : null;
    return { bouts, active, track };
  }, [selectedId, isDemo, user?.id]);
  return useLoad<BoutsData>(gate === "fighter", `bouts:${user?.id}:${isDemo}:${selectedId ?? "auto"}`, load, { keepOnError: true });
}
