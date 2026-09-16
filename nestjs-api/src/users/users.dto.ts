import { createZodDto } from 'nestjs-zod';
import {
  createUserBodySchema,
  updateUserBodySchema,
  userIdParamsSchema,
} from './users.model.js';

export class UserIdParamsDto extends createZodDto(userIdParamsSchema) {}

export class CreateUserDto extends createZodDto(createUserBodySchema) {}

export class UpdateUserDto extends createZodDto(updateUserBodySchema) {}
