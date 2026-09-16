import { type ArgumentMetadata, ValidationPipe } from '@nestjs/common';
import { isZodDto } from 'nestjs-zod/dto';
import validationOptions from '../utils/validationOptions.js';

export class AppValidationPipe extends ValidationPipe {
  constructor() {
    super(validationOptions);
  }

  override async transform(
    value: unknown,
    metadata: ArgumentMetadata,
  ): Promise<unknown> {
    if (isZodDto(metadata.metatype)) return value;

    return super.transform(value, metadata);
  }
}
