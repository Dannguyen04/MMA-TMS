import { z } from 'zod';

export const navigationBadgeCountsSchema = z.strictObject({
  notifications: z.number().int().nonnegative(),
  reviewQueue: z.number().int().nonnegative().optional(),
  newAlerts: z.number().int().nonnegative().optional(),
  failedJobs: z.number().int().nonnegative().optional(),
});

export type NavigationBadgeCounts = z.infer<typeof navigationBadgeCountsSchema>;
