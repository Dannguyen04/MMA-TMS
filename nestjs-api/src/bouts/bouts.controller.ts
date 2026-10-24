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
  Put,
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
import { BOUT_PERMISSIONS, BOUT_RESPONSE_MESSAGES } from './bouts.constants.js';
import {
  OpponentAnalysisDto, OpponentReviewDto, RoundInputDto, RoundParamsDto,
  PriorContextQueryDto, CornerCardResponseDto, RoundsResponseDto, RoundResponseDto,
  PriorContextResponseDto, AnalysisMutationResponseDto,
  BoutDetailResponseDto,
  BoutIdParamsDto,
  BoutListResponseDto,
  CancelBoutDto,
  CatchweightDto,
  CreateBoutDto,
  CreateRequirementDto,
  ListBoutsQueryDto,
  RecordResultDto,
  RemoveRequirementQueryDto,
  RequirementMutationResponseDto,
  RequirementParamsDto,
  RequirementRemovalResponseDto,
  RulesetResponseDto,
  StartCampDto,
  UpdateBoutDto,
  UpdateRequirementDto,
  WeighInDto,
  WeighInResponseDto,
  WeightTrackResponseDto,
} from './bouts.dto.js';
import { BoutsService } from './bouts.service.js';

@ApiTags('Bouts')
@ApiBearerAuth()
@Controller()
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@UsePipes(appZodValidationPipe)
export class BoutsController {
  constructor(private readonly boutsService: BoutsService) {}

  @Get('competition-rulesets')
  @RequirePermissions({ allOf: [BOUT_PERMISSIONS.RULESET_READ] })
  @ApiOperation({
    summary: 'List competition rulesets',
    description:
      'Lists rulesets that are not deleted, including the `verified` flag of each preset.',
  })
  @ResponseMessage(BOUT_RESPONSE_MESSAGES.RULESETS_LIST)
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: BOUT_RESPONSE_MESSAGES.RULESETS_LIST,
    model: RulesetResponseDto,
    isArray: true,
  })
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires ruleset:read')
  async listRulesets() {
    return this.boutsService.listRulesets();
  }

  @Get('bouts')
  @RequirePermissions({ allOf: [BOUT_PERMISSIONS.GET_ALL] })
  @ApiOperation({
    summary: 'List bouts',
    description:
      'Scope-aware list ordered by weighInAt ascending with cursor pagination. ' +
      'FIGHTER sees own bouts, COACH and DOCTOR assigned fighters, ADMIN all.',
  })
  @ResponseMessage(BOUT_RESPONSE_MESSAGES.LIST)
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: BOUT_RESPONSE_MESSAGES.LIST,
    model: BoutListResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires bout:get_all')
  async listBouts(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Query() query: ListBoutsQueryDto,
  ) {
    return this.boutsService.listBouts(this.requireActor(actor), query);
  }

  @Post('bouts')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ allOf: [BOUT_PERMISSIONS.CREATE] })
  @ApiOperation({
    summary: 'Create a bout',
    description:
      'Creates a SCHEDULED bout for an assigned fighter and generates the paperwork ' +
      'checklist from the ruleset (source = PRESET).',
  })
  @ResponseMessage(BOUT_RESPONSE_MESSAGES.CREATE)
  @ApiSuccessEnvelope({
    status: HttpStatus.CREATED,
    message: BOUT_RESPONSE_MESSAGES.CREATE,
    model: BoutDetailResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires bout:create and an assigned fighter')
  @ApiNotFoundEnvelope('RULESET_NOT_FOUND', 'Ruleset or fighter not found')
  async createBout(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Body() body: CreateBoutDto,
  ) {
    return this.boutsService.createBout(
      this.requireActor(actor),
      body,
      randomUUID(),
    );
  }


  @Get('bouts/prior-context')
  @RequirePermissions({ allOf: [BOUT_PERMISSIONS.GET_ALL] })
  @ApiOperation({ summary: 'Get prior bout context' })
  @ResponseMessage('Get prior bout context successfully')
  @ApiSuccessEnvelope({ status: HttpStatus.OK, message: 'Get prior bout context successfully', model: PriorContextResponseDto })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires bout permission and access to the fighter')
  @ApiNotFoundEnvelope('BOUT_NOT_FOUND', 'Bout not found')
  @ApiConflictEnvelope('BOUT_INVALID_TRANSITION', 'The bout status forbids this operation')
  async getPriorContext(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Query() query: PriorContextQueryDto,
  ) {
    return this.boutsService.getPriorContext(this.requireActor(actor), query);
  }

  @Put('bouts/:id/opponent-analysis')
  @RequirePermissions({ allOf: [BOUT_PERMISSIONS.UPDATE] })
  @ApiOperation({ summary: 'Save opponent analysis' })
  @ResponseMessage('Save opponent analysis successfully')
  @ApiSuccessEnvelope({ status: HttpStatus.OK, message: 'Save opponent analysis successfully', model: AnalysisMutationResponseDto })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires bout permission and access to the fighter')
  @ApiNotFoundEnvelope('BOUT_NOT_FOUND', 'Bout not found')
  @ApiConflictEnvelope('BOUT_INVALID_TRANSITION', 'The bout status forbids this operation')
  async putOpponentAnalysis(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: BoutIdParamsDto, @Body() body: OpponentAnalysisDto,
  ) {
    return this.boutsService.putOpponentAnalysis(this.requireActor(actor), params.id, body, randomUUID());
  }

  @Put('bouts/:id/opponent-analysis/review')
  @RequirePermissions({ allOf: [BOUT_PERMISSIONS.RESULT] })
  @ApiOperation({ summary: 'Review opponent tactics' })
  @ResponseMessage('Review opponent tactics successfully')
  @ApiSuccessEnvelope({ status: HttpStatus.OK, message: 'Review opponent tactics successfully', model: AnalysisMutationResponseDto })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires bout permission and access to the fighter')
  @ApiNotFoundEnvelope('BOUT_NOT_FOUND', 'Bout not found')
  @ApiConflictEnvelope('BOUT_INVALID_TRANSITION', 'The bout status forbids this operation')
  async putOpponentReview(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: BoutIdParamsDto, @Body() body: OpponentReviewDto,
  ) {
    return this.boutsService.putOpponentReview(this.requireActor(actor), params.id, body, randomUUID());
  }

  @Put('bouts/:id/rounds/:roundNo')
  @RequirePermissions({ allOf: [BOUT_PERMISSIONS.UPDATE] })
  @ApiOperation({ summary: 'Save a bout round' })
  @ResponseMessage('Save a bout round successfully')
  @ApiSuccessEnvelope({ status: HttpStatus.OK, message: 'Save a bout round successfully', model: RoundResponseDto })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires bout permission and access to the fighter')
  @ApiNotFoundEnvelope('BOUT_NOT_FOUND', 'Bout not found')
  @ApiConflictEnvelope('BOUT_INVALID_TRANSITION', 'The bout status forbids this operation')
  async putRound(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: RoundParamsDto, @Body() body: RoundInputDto,
  ) {
    return this.boutsService.putRound(this.requireActor(actor), params.id, params.roundNo, body, randomUUID());
  }

  @Get('bouts/:id/rounds')
  @RequirePermissions({ allOf: [BOUT_PERMISSIONS.READ] })
  @ApiOperation({ summary: 'Get round records and advice' })
  @ResponseMessage('Get round records and advice successfully')
  @ApiSuccessEnvelope({ status: HttpStatus.OK, message: 'Get round records and advice successfully', model: RoundsResponseDto })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires bout permission and access to the fighter')
  @ApiNotFoundEnvelope('BOUT_NOT_FOUND', 'Bout not found')
  @ApiConflictEnvelope('BOUT_INVALID_TRANSITION', 'The bout status forbids this operation')
  async getRounds(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: BoutIdParamsDto,
  ) {
    return this.boutsService.getRounds(this.requireActor(actor), params.id);
  }

  @Get('bouts/:id/corner-card')
  @RequirePermissions({ allOf: [BOUT_PERMISSIONS.READ] })
  @ApiOperation({ summary: 'Get corner card' })
  @ResponseMessage('Get corner card successfully')
  @ApiSuccessEnvelope({ status: HttpStatus.OK, message: 'Get corner card successfully', model: CornerCardResponseDto })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires bout permission and access to the fighter')
  @ApiNotFoundEnvelope('BOUT_NOT_FOUND', 'Bout not found')
  @ApiConflictEnvelope('BOUT_INVALID_TRANSITION', 'The bout status forbids this operation')
  async getCornerCard(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: BoutIdParamsDto,
  ) {
    return this.boutsService.getCornerCard(this.requireActor(actor), params.id);
  }

  @Get('bouts/:id')
  @RequirePermissions({ allOf: [BOUT_PERMISSIONS.READ] })
  @ApiOperation({
    summary: 'Get a bout',
    description:
      'Bout with requirements and computed values: daysToWeighIn, requirementsDueOn, gate1, canEnterFightWeek, weight.',
  })
  @ResponseMessage(BOUT_RESPONSE_MESSAGES.GET)
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: BOUT_RESPONSE_MESSAGES.GET,
    model: BoutDetailResponseDto,
  })
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires bout:read and access to the fighter')
  @ApiNotFoundEnvelope('BOUT_NOT_FOUND', 'Bout not found')
  async getBout(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: BoutIdParamsDto,
  ) {
    return this.boutsService.getBout(this.requireActor(actor), params.id);
  }

  @Patch('bouts/:id')
  @RequirePermissions({ allOf: [BOUT_PERMISSIONS.UPDATE] })
  @ApiOperation({
    summary: 'Update a bout',
    description:
      'Edits descriptive fields; dates, weight class and requirementsDueDays only while SCHEDULED, CAMP or FIGHT_WEEK.',
  })
  @ResponseMessage(BOUT_RESPONSE_MESSAGES.UPDATE)
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: BOUT_RESPONSE_MESSAGES.UPDATE,
    model: BoutDetailResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires bout:update and an assigned fighter')
  @ApiNotFoundEnvelope('BOUT_NOT_FOUND', 'Bout not found')
  @ApiConflictEnvelope('BOUT_INVALID_TRANSITION', 'The bout status forbids this change')
  async updateBout(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: BoutIdParamsDto,
    @Body() body: UpdateBoutDto,
  ) {
    return this.boutsService.updateBout(
      this.requireActor(actor),
      params.id,
      body,
      randomUUID(),
    );
  }

  @Post('bouts/:id/camp')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ allOf: [BOUT_PERMISSIONS.UPDATE] })
  @ApiOperation({
    summary: 'Start camp',
    description:
      'Attaches an existing fight_camp plan of the same fighter and moves SCHEDULED to CAMP.',
  })
  @ResponseMessage(BOUT_RESPONSE_MESSAGES.CAMP)
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: BOUT_RESPONSE_MESSAGES.CAMP,
    model: BoutDetailResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires bout:update and an assigned fighter')
  @ApiNotFoundEnvelope('BOUT_NOT_FOUND', 'Bout not found')
  @ApiConflictEnvelope(
    'BOUT_ACTIVE_EXISTS',
    'Invalid transition or the fighter already has an active bout',
  )
  async startCamp(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: BoutIdParamsDto,
    @Body() body: StartCampDto,
  ) {
    return this.boutsService.startCamp(
      this.requireActor(actor),
      params.id,
      body,
      randomUUID(),
    );
  }

  @Post('bouts/:id/fight-week')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ allOf: [BOUT_PERMISSIONS.UPDATE] })
  @ApiOperation({
    summary: 'Enter fight week',
    description:
      'Moves CAMP to FIGHT_WEEK when Gate 1 passes and the fight-week window has opened.',
  })
  @ResponseMessage(BOUT_RESPONSE_MESSAGES.FIGHT_WEEK)
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: BOUT_RESPONSE_MESSAGES.FIGHT_WEEK,
    model: BoutDetailResponseDto,
  })
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires bout:update and an assigned fighter')
  @ApiNotFoundEnvelope('BOUT_NOT_FOUND', 'Bout not found')
  @ApiConflictEnvelope(
    'BOUT_REQUIREMENTS_INCOMPLETE',
    'Gate 1 failed, too early, or invalid transition',
  )
  async enterFightWeek(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: BoutIdParamsDto,
  ) {
    return this.boutsService.enterFightWeek(
      this.requireActor(actor),
      params.id,
      randomUUID(),
    );
  }

  @Post('bouts/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ allOf: [BOUT_PERMISSIONS.UPDATE] })
  @ApiOperation({
    summary: 'Cancel a bout',
    description: 'Any status except COMPLETED and CANCELLED; a reason is required.',
  })
  @ResponseMessage(BOUT_RESPONSE_MESSAGES.CANCEL)
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: BOUT_RESPONSE_MESSAGES.CANCEL,
    model: BoutDetailResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires bout:update and an assigned fighter')
  @ApiNotFoundEnvelope('BOUT_NOT_FOUND', 'Bout not found')
  @ApiConflictEnvelope('BOUT_INVALID_TRANSITION', 'The bout is already final')
  async cancelBout(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: BoutIdParamsDto,
    @Body() body: CancelBoutDto,
  ) {
    return this.boutsService.cancelBout(
      this.requireActor(actor),
      params.id,
      body,
      randomUUID(),
    );
  }

  @Post('bouts/:id/requirements')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ allOf: [BOUT_PERMISSIONS.REQUIREMENT] })
  @ApiOperation({
    summary: 'Add a paperwork item',
    description: 'Adds a checklist item entered by the coach (source = COACH).',
  })
  @ResponseMessage(BOUT_RESPONSE_MESSAGES.REQUIREMENT_CREATE)
  @ApiSuccessEnvelope({
    status: HttpStatus.CREATED,
    message: BOUT_RESPONSE_MESSAGES.REQUIREMENT_CREATE,
    model: RequirementMutationResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires bout:requirement and an assigned fighter')
  @ApiNotFoundEnvelope('BOUT_NOT_FOUND', 'Bout not found')
  @ApiConflictEnvelope('BOUT_REQUIREMENT_EXISTS', 'The code already exists on this bout')
  async addRequirement(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: BoutIdParamsDto,
    @Body() body: CreateRequirementDto,
  ) {
    return this.boutsService.addRequirement(
      this.requireActor(actor),
      params.id,
      body,
      randomUUID(),
    );
  }

  @Patch('bouts/:id/requirements/:code')
  @RequirePermissions({ allOf: [BOUT_PERMISSIONS.REQUIREMENT] })
  @ApiOperation({
    summary: 'Update a paperwork item',
    description:
      'Changes status (MISSING, PROVIDED, REJECTED), dates, label or required flag. ' +
      'PROVIDED needs validUntil; REJECTED needs statusReason.',
  })
  @ResponseMessage(BOUT_RESPONSE_MESSAGES.REQUIREMENT_UPDATE)
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: BOUT_RESPONSE_MESSAGES.REQUIREMENT_UPDATE,
    model: RequirementMutationResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires bout:requirement and an assigned fighter')
  @ApiNotFoundEnvelope('BOUT_REQUIREMENT_NOT_FOUND', 'Bout or requirement not found')
  async updateRequirement(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: RequirementParamsDto,
    @Body() body: UpdateRequirementDto,
  ) {
    return this.boutsService.updateRequirement(
      this.requireActor(actor),
      params.id,
      params.code,
      body,
      randomUUID(),
    );
  }

  @Delete('bouts/:id/requirements/:code')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ allOf: [BOUT_PERMISSIONS.REQUIREMENT] })
  @ApiOperation({
    summary: 'Remove a paperwork item',
    description: 'Hard delete; the audit trigger records the removal.',
  })
  @ResponseMessage(BOUT_RESPONSE_MESSAGES.REQUIREMENT_DELETE)
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: BOUT_RESPONSE_MESSAGES.REQUIREMENT_DELETE,
    model: RequirementRemovalResponseDto,
  })
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires bout:requirement and an assigned fighter')
  @ApiNotFoundEnvelope('BOUT_REQUIREMENT_NOT_FOUND', 'Bout or requirement not found')
  @ApiConflictEnvelope(
    'BOUT_REQUIREMENTS_LOCKED',
    'Unlock reason required during fight week and weigh-in',
  )
  async removeRequirement(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: RequirementParamsDto,
    @Query() query?: RemoveRequirementQueryDto,
  ) {
    return this.boutsService.removeRequirement(
      this.requireActor(actor),
      params.id,
      params.code,
      randomUUID(),
      query?.unlockReason,
    );
  }

  @Get('bouts/:id/weight-track')
  @RequirePermissions({ allOf: [BOUT_PERMISSIONS.READ] })
  @ApiOperation({
    summary: 'Weight track of a bout',
    description:
      'Daily weight points since the camp start, the reference path and the ON_TRACK/ABOVE_TARGET/OVER_LIMIT/NOT_WEIGHED status.',
  })
  @ResponseMessage(BOUT_RESPONSE_MESSAGES.WEIGHT_TRACK)
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: BOUT_RESPONSE_MESSAGES.WEIGHT_TRACK,
    model: WeightTrackResponseDto,
  })
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires bout:read and access to the fighter')
  @ApiNotFoundEnvelope('BOUT_NOT_FOUND', 'Bout not found')
  async getWeightTrack(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: BoutIdParamsDto,
  ) {
    return this.boutsService.getWeightTrack(this.requireActor(actor), params.id);
  }


  @Post('bouts/:id/weigh-in')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ allOf: [BOUT_PERMISSIONS.UPDATE] })
  @ApiOperation({
    summary: 'Official weigh-in',
    description:
      'Records official weigh-in in FIGHT_WEEK. Passes to WEIGHED_IN on success, stays in FIGHT_WEEK on failure.',
  })
  @ResponseMessage(BOUT_RESPONSE_MESSAGES.WEIGH_IN)
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: BOUT_RESPONSE_MESSAGES.WEIGH_IN,
    model: WeighInResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires bout:update and an assigned fighter')
  @ApiNotFoundEnvelope('BOUT_NOT_FOUND', 'Bout not found')
  @ApiConflictEnvelope(
    'BOUT_INVALID_TRANSITION',
    'Invalid transition, too early, or concurrent update conflict',
  )
  async weighIn(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: BoutIdParamsDto,
    @Body() body: WeighInDto,
  ) {
    return this.boutsService.recordWeighIn(
      this.requireActor(actor),
      params.id,
      body,
      randomUUID(),
    );
  }

  @Post('bouts/:id/catchweight')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ allOf: [BOUT_PERMISSIONS.UPDATE] })
  @ApiOperation({
    summary: 'Agree catchweight',
    description:
      'Agrees a catchweight limit after a failed weigh-in, moving FIGHT_WEEK to WEIGHED_IN.',
  })
  @ResponseMessage(BOUT_RESPONSE_MESSAGES.CATCHWEIGHT)
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: BOUT_RESPONSE_MESSAGES.CATCHWEIGHT,
    model: BoutDetailResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires bout:update and an assigned fighter')
  @ApiNotFoundEnvelope('BOUT_NOT_FOUND', 'Bout not found')
  @ApiConflictEnvelope(
    'BOUT_WEIGH_IN_NOT_FAILED',
    'Weigh-in did not fail or concurrent update conflict',
  )
  async catchweight(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: BoutIdParamsDto,
    @Body() body: CatchweightDto,
  ) {
    return this.boutsService.recordCatchweight(
      this.requireActor(actor),
      params.id,
      body,
      randomUUID(),
    );
  }

  @Post('bouts/:id/result')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ allOf: [BOUT_PERMISSIONS.RESULT] })
  @ApiOperation({
    summary: 'Record bout result',
    description:
      'Records final result and method, moving WEIGHED_IN to COMPLETED.',
  })
  @ResponseMessage(BOUT_RESPONSE_MESSAGES.RESULT)
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: BOUT_RESPONSE_MESSAGES.RESULT,
    model: BoutDetailResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires bout:result and an assigned fighter')
  @ApiNotFoundEnvelope('BOUT_NOT_FOUND', 'Bout not found')
  @ApiConflictEnvelope(
    'BOUT_INVALID_TRANSITION',
    'Invalid transition, bout not started, or concurrent update conflict',
  )
  async recordResult(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: BoutIdParamsDto,
    @Body() body: RecordResultDto,
  ) {
    return this.boutsService.recordResult(
      this.requireActor(actor),
      params.id,
      body,
      randomUUID(),
    );
  }

  private requireActor(
    actor: AuthenticatedUser | undefined,
  ): AuthenticatedUser {
    if (!actor) throw authenticationRequired();
    return actor;
  }
}
