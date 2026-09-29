import { SetMetadata } from '@nestjs/common';

export const SKIP_RESPONSE_ENVELOPE = Symbol('SKIP_RESPONSE_ENVELOPE');

/**
 * Leaves the handler's output unwrapped by the global success envelope. Only
 * for responses that are not JSON documents (for example a Server-Sent Events
 * stream); errors raised before the response starts still use the error
 * envelope.
 */
export const SkipResponseEnvelope = () =>
  SetMetadata(SKIP_RESPONSE_ENVELOPE, true);
