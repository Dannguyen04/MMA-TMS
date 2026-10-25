export const SUSPENSION_PERMISSIONS = {
  READ: 'suspension:read',
  CREATE: 'suspension:create',
  CLEAR: 'suspension:clear',
} as const;

export const SUSPENSION_RESPONSE_MESSAGES = {
  LIST: 'Get suspensions successfully',
  CREATE: 'Create suspension successfully',
  CLEAR: 'Clear suspension successfully',
} as const;
