import { Stack } from "expo-router";

import { AiVideoDetailRoute } from "@/screens/video-ai/ai-video-detail-screen";

/** Chi tiết video mở bằng query (chi-tiet?id=...&job=...&focus=...), chỉ đọc. */
export default function CoachVideoDetailQueryRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AiVideoDetailRoute />
    </>
  );
}
