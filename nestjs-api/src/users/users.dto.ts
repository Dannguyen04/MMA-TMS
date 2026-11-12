import { createZodDto } from 'nestjs-zod';
import {
  createUserBodySchema,
  currentUserSchema,
  listUsersQuerySchema,
  publicUserListSchema,
  publicUserSchema,
  updateUserBodySchema,
  userIdParamsSchema,
} from './users.model.js';

export class UserIdParamsDto extends createZodDto(userIdParamsSchema) {}

export class CreateUserDto extends createZodDto(createUserBodySchema) {}

export class UpdateUserDto extends createZodDto(updateUserBodySchema) {}

export class PublicUserDto extends createZodDto(publicUserSchema) {}

export class CurrentUserDto extends createZodDto(currentUserSchema) {}

export class ListUsersQueryDto extends createZodDto(listUsersQuerySchema) {}

export class PublicUserListDto extends createZodDto(publicUserListSchema) {}
