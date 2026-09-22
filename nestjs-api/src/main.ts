import { NestFactory, Reflector } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { ApiExceptionFilter } from './shared/filters/api-exception.filter.js';
import { ApiResponseInterceptor } from './shared/interceptors/api-response.interceptor.js';
import { AppValidationPipe } from './shared/pipes/app-validation.pipe.js';
import { createOpenApiDocument } from './shared/utils/openapi.util.js';

/** FRONTEND_URL accepts a comma-separated list; the mobile app origin is always allowed. */
function configuredOrigins(): Set<string> {
  const frontendOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const mobileOrigin = process.env.MOBILE_APP_URL || 'http://localhost:8081';
  return new Set([...frontendOrigins, mobileOrigin]);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const allowedOrigins = configuredOrigins();

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      // Yêu cầu máy chủ và ứng dụng native không gửi Origin nên vẫn được phép.
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);

      return callback(
        new Error(`CORS policy không cho phép origin: ${origin}`),
        false,
      );
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(new AppValidationPipe());
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new ApiResponseInterceptor(app.get(Reflector)));

  const document = createOpenApiDocument(app);
  const swaggerOptions = {
    customSiteTitle: 'MMA-TMS API Documentation',
  };
  // setup() cũng phục vụ tài liệu JSON tại /api-docs-json và /docs-json.
  SwaggerModule.setup('api-docs', app, document, swaggerOptions);
  SwaggerModule.setup('docs', app, document, swaggerOptions);

  const port = process.env.PORT ?? 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`NestJS API running on http://localhost:${port}`);
  console.log(`Swagger UI available at http://localhost:${port}/docs`);
}

void bootstrap();
