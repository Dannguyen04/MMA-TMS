import { Easing } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { motion } from "@/theme/motion";

/**
 * Redesign step 15: peer tabs cross-fade in 160 ms (as the fighter Stack does), eased out.
 * Reduced motion switches instantly. Spread into a Tabs `screenOptions`.
 */
export function useTabFade() {
  const reduced = useReducedMotion();
  return reduced
    ? { animation: "none" as const }
    : {
        animation: "fade" as const,
        transitionSpec: { animation: "timing" as const, config: { duration: 160, easing: Easing.bezier(...motion.easeOut) } },
      };
}
