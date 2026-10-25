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

export const SESSION_TYPES = [
  'SHADOW_BOXING',
  'PAD_WORK',
  'HEAVY_BAG',
  'SPARRING',
  'GRAPPLING',
  'STRENGTH_CONDITIONING',
  'RECOVERY',
  'PHYSICAL_THERAPY',
] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export const SUSPENSION_REASONS = [
  'KO',
  'TKO',
  'DQ',
  'MANDATORY_REST',
  'MEDICAL',
  'OTHER',
] as const;
export type SuspensionReason = (typeof SUSPENSION_REASONS)[number];

