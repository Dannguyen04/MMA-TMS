import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  CurrentUser,
  RequirePermissions,
  RequireRoles,
} from '../shared/decorators/auth.decorator.js';
import { ResponseMessage } from '../shared/decorators/response-message.decorator.js';
import { authenticationRequired } from '../shared/errors/access.error.js';
import {
  AccessTokenGuard,
  AuthorizationGuard,
} from '../shared/guards/auth.guard.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import { appZodValidationPipe } from '../shared/pipes/zod-validation.pipe.js';
import { CreateUserDto, UpdateUserDto, UserIdParamsDto } from './users.dto.js';
import { USER_PERMISSIONS } from './users.model.js';
import { UsersService } from './users.service.js';

@Controller('users')
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@RequireRoles(USER.ADMIN)
@UsePipes(appZodValidationPipe)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequirePermissions({ allOf: [USER_PERMISSIONS.CREATE] })
  @ResponseMessage('User created successfully')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Body() body: CreateUserDto,
  ) {
    return this.usersService.create(this.actor(actor), body.user, randomUUID());
  }

  @Get(':id')
  @RequirePermissions({ allOf: [USER_PERMISSIONS.READ] })
  @ResponseMessage('Get user successfully')
  async findOne(@Param() params: UserIdParamsDto) {
    return this.usersService.findOne(params.id);
  }

  @Patch(':id')
  @RequirePermissions({ allOf: [USER_PERMISSIONS.UPDATE] })
  @ResponseMessage('User updated successfully')
  async update(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: UserIdParamsDto,
    @Body() body: UpdateUserDto,
  ) {
    return this.usersService.update(
      params.id,
      this.actor(actor),
      body.user,
      randomUUID(),
    );
  }

  @Delete(':id')
  @RequirePermissions({ allOf: [USER_PERMISSIONS.DELETE] })
  @ResponseMessage('User deleted successfully')
  async remove(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: UserIdParamsDto,
  ) {
    return this.usersService.remove(params.id, this.actor(actor), randomUUID());
  }

  private actor(actor: AuthenticatedUser | undefined): AuthenticatedUser {
    if (!actor) throw authenticationRequired();
    return actor;
  }
}
