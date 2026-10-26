import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ConflictProposalResponseDto } from './suspensions.dto.js';
import { AdmissionAssignCoachDto } from '../fighter-admissions/fighter-admissions.dto.js';
import { AssignCoachDto } from '../fighters/fighters.dto.js';

describe('Swagger response and request model names', () => {
  it('documents the serialized scheduled date without exposing Date to JSON Schema', () => {
    const schema = z.toJSONSchema(ConflictProposalResponseDto.schema);
    expect(schema.properties?.toScheduledAt).toMatchObject({ type: 'string', format: 'date-time' });
    const date = new Date('2026-10-27T10:30:00.000Z');
    const body = JSON.parse(JSON.stringify({ sessionId: '11111111-1111-4111-8111-111111111111', action: 'RESCHEDULE', toScheduledAt: date }));
    expect(ConflictProposalResponseDto.schema.parse(body).toScheduledAt).toBe(date.toISOString());
  });
  it('gives admission assignment and fighter assignment separate OpenAPI names', () => {
    expect(AdmissionAssignCoachDto.name).not.toBe(AssignCoachDto.name);
    expect(() => z.toJSONSchema(AdmissionAssignCoachDto.schema)).not.toThrow();
    expect(() => z.toJSONSchema(AssignCoachDto.schema)).not.toThrow();
  });
});
