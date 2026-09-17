import { createZodDto } from 'nestjs-zod';
import {
  rolePermissionParamsSchema,
  rolePermissionResponseSchema,
  userPermissionParamsSchema,
  userPermissionResponseSchema,
} from './authorization.model.js';

export class UserPermissionParamsDto extends createZodDto(
  userPermissionParamsSchema,
) {}

export class RolePermissionParamsDto extends createZodDto(
  rolePermissionParamsSchema,
) {}

export class UserPermissionResponseDto extends createZodDto(
  userPermissionResponseSchema,
) {}

export class RolePermissionResponseDto extends createZodDto(
  rolePermissionResponseSchema,
) {}

