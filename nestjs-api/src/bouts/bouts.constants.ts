export const BOUT_PERMISSIONS = {
  RULESET_READ: 'ruleset:read',
  GET_ALL: 'bout:get_all',
  READ: 'bout:read',
  CREATE: 'bout:create',
  UPDATE: 'bout:update',
  RESULT: 'bout:result',
  REQUIREMENT: 'bout:requirement',
} as const;

export const BOUT_RESPONSE_MESSAGES = {
  RULESETS_LIST: 'Get competition rulesets successfully',
  LIST: 'Get bouts successfully',
  GET: 'Get bout successfully',
  CREATE: 'Create bout successfully',
  UPDATE: 'Update bout successfully',
  CAMP: 'Start bout camp successfully',
  FIGHT_WEEK: 'Enter fight week successfully',
  CANCEL: 'Cancel bout successfully',
  REQUIREMENT_CREATE: 'Add bout requirement successfully',
  REQUIREMENT_UPDATE: 'Update bout requirement successfully',
  REQUIREMENT_DELETE: 'Remove bout requirement successfully',
  WEIGHT_TRACK: 'Get bout weight track successfully',
  FEASIBILITY: 'Get bout weight feasibility successfully',
  WEIGH_IN: 'Record official weigh-in successfully',
  CATCHWEIGHT: 'Agree catchweight successfully',
  RESULT: 'Record bout result successfully',
} as const;
