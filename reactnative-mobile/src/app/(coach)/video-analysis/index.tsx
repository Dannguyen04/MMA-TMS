import { Stack } from "expo-router";

import { CoachVideosScreen } from "@/screens/coach/nav/coach-videos-screen";

/** Tab Video: Thư viện video của võ sĩ phụ trách (GET /videos). */
export default function CoachVideoLibraryRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <CoachVideosScreen />
    </>
  );
}
