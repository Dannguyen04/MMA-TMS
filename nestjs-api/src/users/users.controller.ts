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
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiConflictEnvelope,
  ApiForbiddenEnvelope,
  ApiNotFoundEnvelope,
  ApiSuccessEnvelope,
  ApiUnauthorizedEnvelope,
  ApiValidationErrorEnvelope,
} from '../shared/decorators/api-envelope.decorator.js';
import {
  CurrentUser,
  RequirePermissions,
} from '../shared/decorators/auth.decorator.js';
import { ResponseMessage } from '../shared/decorators/response-message.decorator.js';
import { authenticationRequired } from '../shared/errors/access.error.js';
import {
  AccessTokenGuard,
  AuthorizationGuard,
} from '../shared/guards/auth.guard.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { appZodValidationPipe } from '../shared/pipes/zod-validation.pipe.js';
import {
  CreateUserDto,
  CurrentUserDto,
  InviteUserDto,
  ListUsersQueryDto,
  PublicUserDto,
  UpdateUserStatusDto,
  UpdateUserDto,
  UpdateOwnProfileDto,
  UserDirectoryPageDto,
  UserIdParamsDto,
} from './users.dto.js';
import { USER_PERMISSIONS } from './users.model.js';
import { UsersService } from './users.service.js';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@UsePipes(appZodValidationPipe)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequirePermissions({ allOf: [USER_PERMISSIONS.CREATE] })
  @ApiOperation({
    summary: 'Create user with role profile',
    description:
      'Creates a new identity and role profile; requires users.create',
  })
  @ResponseMessage('User created successfully')
  @HttpCode(HttpStatus.CREATED)
  @ApiSuccessEnvelope({
    status: HttpStatus.CREATED,
    message: 'User created successfully',
    model: PublicUserDto,
  })
  @ApiValidationErrorEnvelope('Invalid user payload')
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires users.create permission')
  @ApiConflictEnvelope(
    'USER_ALREADY_EXISTS',
    'A user already exists for this email',
  )
  async create(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Body() body: CreateUserDto,
  ) {
    return this.usersService.create(this.actor(actor), body.user, randomUUID());
  }

  @Post('invite')
  @RequirePermissions({ allOf: [USER_PERMISSIONS.CREATE] })
  @ApiOperation({
    summary: 'Invite user',
    description:
      'Creates an invited account and a private delivery outbox event without a caller-controlled password',
  })
  @ResponseMessage('User invitation created successfully')
  @HttpCode(HttpStatus.CREATED)
  @ApiSuccessEnvelope({
    status: HttpStatus.CREATED,
    message: 'User invitation created successfully',
    model: PublicUserDto,
  })
  @ApiValidationErrorEnvelope('Invalid invitation payload')
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires users.create permission')
  @ApiConflictEnvelope('EMAIL_TAKEN', 'A user already exists for this email')
  invite(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Body() body: InviteUserDto,
  ) {
    return this.usersService.invite(this.actor(actor), body, randomUUID());
  }

  @Get('me')
  @RequirePermissions({ allOf: [USER_PERMISSIONS.PROFILE_READ] })
  @ApiOperation({
    summary: 'Get current user profile',
    description:
      'Retrieves the currently authenticated user and profile; requires users.profile.read',
  })
  @ResponseMessage('Get current user successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Get current user successfully',
    model: CurrentUserDto,
  })
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires users.profile.read permission')
  @ApiNotFoundEnvelope('USER_NOT_FOUND', 'User not found')
  async findMe(@CurrentUser() actor: AuthenticatedUser | undefined) {
    const currentActor = this.actor(actor);
    return this.usersService.findMe(currentActor);
  }

  @Patch('me')
  @RequirePermissions({ allOf: [USER_PERMISSIONS.PROFILE_READ] })
  @ApiOperation({
    summary: 'Update current user display profile',
    description:
      'Updates only the authenticated account display name and phone number',
  })
  @ResponseMessage('Current user profile updated successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Current user profile updated successfully',
    model: PublicUserDto,
  })
  @ApiValidationErrorEnvelope('Invalid current user profile fields')
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires users.profile.read permission')
  @ApiNotFoundEnvelope('USER_NOT_FOUND', 'User not found')
  updateMe(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Body() body: UpdateOwnProfileDto,
  ) {
    return this.usersService.updateMe(this.actor(actor), body, randomUUID());
  }

  @Get()
  @RequirePermissions({ allOf: [USER_PERMISSIONS.READ] })
  @ApiOperation({
    summary: 'List users',
    description: 'Returns a filtered cursor-paginated user directory',
  })
  @ResponseMessage('Get users successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Get users successfully',
    model: UserDirectoryPageDto,
  })
  @ApiValidationErrorEnvelope('Invalid user directory filters')
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires users.read permission')
  list(@Query() query: ListUsersQueryDto) {
    return this.usersService.list(query);
  }

  @Get(':id')
  @RequirePermissions({ allOf: [USER_PERMISSIONS.READ] })
  @ApiOperation({
    summary: 'Get user by ID',
    description: 'Retrieves user details and profile by user ID',
  })
  @ResponseMessage('Get user successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Get user successfully',
    model: PublicUserDto,
  })
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires users.read permission')
  @ApiNotFoundEnvelope('USER_NOT_FOUND', 'User not found')
  async findOne(@Param() params: UserIdParamsDto) {
    return this.usersService.findOne(params.id);
  }

  @Patch(':id')
  @RequirePermissions({ allOf: [USER_PERMISSIONS.UPDATE] })
  @ApiOperation({
    summary: 'Update user profile',
    description: 'Updates role-specific profile fields of an existing user',
  })
  @ResponseMessage('User updated successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'User updated successfully',
    model: PublicUserDto,
  })
  @ApiValidationErrorEnvelope('Invalid profile update fields')
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires users.update permission')
  @ApiNotFoundEnvelope('USER_NOT_FOUND', 'User not found')
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

  @Patch(':id/status')
  @RequirePermissions({ allOf: [USER_PERMISSIONS.UPDATE] })
  @ApiOperation({
    summary: 'Update user account status',
    description:
      'Activates or suspends another account and revokes sessions when access is disabled',
  })
  @ResponseMessage('User status updated successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'User status updated successfully',
    model: PublicUserDto,
  })
  @ApiValidationErrorEnvelope('Invalid account status')
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires users.update permission')
  @ApiNotFoundEnvelope('USER_NOT_FOUND', 'User not found')
  @ApiConflictEnvelope(
    'OWN_ACCOUNT',
    'You cannot change the status of your own account',
  )
  async updateStatus(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: UserIdParamsDto,
    @Body() body: UpdateUserStatusDto,
  ) {
    return this.usersService.updateStatus(
      params.id,
      this.actor(actor),
      body.status,
      randomUUID(),
    );
  }

  @Post(':id/resend-invite')
  @RequirePermissions({ allOf: [USER_PERMISSIONS.UPDATE] })
  @ApiOperation({
    summary: 'Resend user invitation',
    description:
      'Invalidates prior invitation requests and persists another private outbox event',
  })
  @ResponseMessage('User invitation resent successfully')
  @HttpCode(HttpStatus.OK)
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'User invitation resent successfully',
    model: PublicUserDto,
  })
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires users.update permission')
  @ApiNotFoundEnvelope('USER_NOT_FOUND', 'User not found')
  @ApiConflictEnvelope(
    'NOT_INVITED',
    'Only invited accounts can receive another invitation',
  )
  resendInvite(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: UserIdParamsDto,
  ) {
    return this.usersService.resendInvite(
      params.id,
      this.actor(actor),
      randomUUID(),
    );
  }

  @Delete(':id')
  @RequirePermissions({ allOf: [USER_PERMISSIONS.DELETE] })
  @ApiOperation({
    summary: 'Soft delete user',
    description: 'Deactivates and soft deletes an application user account',
  })
  @ResponseMessage('User deleted successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'User deleted successfully',
  })
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires users.delete permission')
  @ApiNotFoundEnvelope('USER_NOT_FOUND', 'User not found')
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
