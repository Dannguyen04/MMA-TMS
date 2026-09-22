import { createZodDto } from 'nestjs-zod';
import {
  createUserBodySchema,
  currentUserSchema,
  inviteUserBodySchema,
  listUsersQuerySchema,
  publicUserSchema,
  updateUserStatusBodySchema,
  updateUserBodySchema,
  updateOwnProfileBodySchema,
  userDirectoryPageSchema,
  userIdParamsSchema,
} from './users.model.js';

export class UserIdParamsDto extends createZodDto(userIdParamsSchema) {}

export class CreateUserDto extends createZodDto(createUserBodySchema) {}

export class UpdateUserDto extends createZodDto(updateUserBodySchema) {}

export class UpdateOwnProfileDto extends createZodDto(
  updateOwnProfileBodySchema,
) {}

export class PublicUserDto extends createZodDto(publicUserSchema) {}

export class CurrentUserDto extends createZodDto(currentUserSchema) {}

export class ListUsersQueryDto extends createZodDto(listUsersQuerySchema) {}

export class UpdateUserStatusDto extends createZodDto(
  updateUserStatusBodySchema,
) {}

export class UserDirectoryPageDto extends createZodDto(
  userDirectoryPageSchema,
) {}

export class InviteUserDto extends createZodDto(inviteUserBodySchema) {}
