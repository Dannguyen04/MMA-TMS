import { authenticationRequired } from '../shared/errors/access.error.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';

export function requireActor(
  actor: AuthenticatedUser | undefined,
): AuthenticatedUser {
  if (!actor) throw authenticationRequired();
  return actor;
}
