import { createZodDto } from 'nestjs-zod';
import { navigationBadgeCountsSchema } from './navigation.model.js';

export class NavigationBadgeCountsDto extends createZodDto(
  navigationBadgeCountsSchema,
) {}
