import { vi } from "vitest";

import type { PlatformFeature } from "@/lib/services/platform-features";

/**
 * Stand-in for `@/lib/services/platform-features` in adapter tests, so each adapter can be tested as it will run once
 * the backend offers its feature. Every feature is on; a test turns one off with `mockReturnValue(false)`.
 *
 * vi.mock("./platform-features", () => import("@/test/platform-features-mock"));
 */
export const platformFeatureAvailable = vi.fn<(feature: PlatformFeature) => boolean>(() => true);

export const PLATFORM_FEATURE_UNAVAILABLE_MESSAGE = "This isn't available yet.";
