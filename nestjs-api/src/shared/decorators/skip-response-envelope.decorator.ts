import { SetMetadata } from '@nestjs/common';

export const SKIP_RESPONSE_ENVELOPE = Symbol('SKIP_RESPONSE_ENVELOPE');

// Only for non-JSON responses such as SSE; errors thrown before the response
// starts still use the error envelope.
export const SkipResponseEnvelope = () =>
  SetMetadata(SKIP_RESPONSE_ENVELOPE, true);
