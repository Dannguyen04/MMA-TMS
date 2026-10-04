import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  type OpenAPIObject,
  SwaggerModule,
} from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { ConfigService } from '@nestjs/config';

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = app.get(ConfigService);
  const options = new DocumentBuilder()
    .setTitle('MMA-TMS API')
    .setDescription('MMA Training & Movement Analysis System API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .addGlobalParameters({
      in: 'header',
      required: false,
      name: config.get<string>('APP_HEADER_LANGUAGE', 'x-custom-lang'),
      schema: {
        example: 'en',
      },
    })
    .build();

  const document = SwaggerModule.createDocument(app, options);
  return cleanupOpenApiDoc(document, { version: '3.0' });
}
