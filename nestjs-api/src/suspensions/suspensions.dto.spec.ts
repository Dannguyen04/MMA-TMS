import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AdmissionAssignCoachDto } from '../fighter-admissions/fighter-admissions.dto.js';
import { AssignCoachDto } from '../fighters/fighters.dto.js';
import {
  AffectedPlanDto,
  AffectedSessionDto,
  ConflictProposalResponseDto,
  CreateSuspensionDto,
  CreateSuspensionResponseDto,
  GradedReturnDto,
  SuspensionResponseDto,
} from './suspensions.dto.js';

describe('Swagger response and request model names', () => {
  it('converts ConflictProposalResponseDto, AffectedSessionDto, AffectedPlanDto, CreateSuspensionResponseDto, and SuspensionResponseDto to JSON Schema without errors', () => {
    const conflictSchema = z.toJSONSchema(ConflictProposalResponseDto.schema);
    expect(conflictSchema.properties?.action).toMatchObject({
      enum: ['PENDING', 'CANCEL'],
    });
    expect(conflictSchema.properties?.toScheduledAt).toBeUndefined();
    expect(conflictSchema.properties?.toType).toBeUndefined();

    const body = {
      sessionId: '11111111-1111-4111-8111-111111111111',
      action: 'PENDING',
    };
    expect(ConflictProposalResponseDto.schema.parse(body)).toEqual(body);

    expect(() => z.toJSONSchema(AffectedSessionDto.schema)).not.toThrow();
    expect(() => z.toJSONSchema(AffectedPlanDto.schema)).not.toThrow();
    expect(() => z.toJSONSchema(GradedReturnDto.schema)).not.toThrow();
    const createReqSchema = z.toJSONSchema(CreateSuspensionDto.schema);
    expect(createReqSchema.properties?.maxTier).toBeDefined();
    const responseSchema = z.toJSONSchema(SuspensionResponseDto.schema);
    expect(responseSchema.properties?.maxAllowedTier).toBeDefined();
    expect(responseSchema.properties?.gradedReturn).toBeDefined();
    expect(() =>
      z.toJSONSchema(CreateSuspensionResponseDto.schema),
    ).not.toThrow();
  });

  it('gives admission assignment and fighter assignment separate OpenAPI names', () => {
    expect(AdmissionAssignCoachDto.name).not.toBe(AssignCoachDto.name);
    expect(() => z.toJSONSchema(AdmissionAssignCoachDto.schema)).not.toThrow();
    expect(() => z.toJSONSchema(AssignCoachDto.schema)).not.toThrow();
  });
});
