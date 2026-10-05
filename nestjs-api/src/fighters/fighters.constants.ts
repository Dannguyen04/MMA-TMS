/**
 * Inbox texts of the training Coach assignment trigger (T1). An ended
 * assignment carries only a minimal reminder: the Coach no longer has access
 * to the Fighter's data.
 */
export const COACH_ASSIGNMENT_NOTIFICATION_TEXT = {
  STARTED_COACH: {
    title: 'New Fighter assigned',
    message:
      'You were assigned as training Coach for a Fighter. The Fighter appears in your roster from the assignment start.',
  },
  STARTED_FIGHTER: {
    title: 'Training Coach assigned',
    message: 'A training Coach was assigned to you.',
  },
  ENDED_COACH: {
    title: 'Fighter assignment ended',
    message: 'One of your training Fighter assignments was ended.',
  },
  ENDED_FIGHTER: {
    title: 'Training Coach assignment ended',
    message: 'One of your training Coach assignments was ended.',
  },
} as const;
