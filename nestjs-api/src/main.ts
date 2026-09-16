import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { SwaggerModule } from '@nestjs/swagger';
import { ApiExceptionFilter } from './shared/filters/api-exception.filter.js';
import { ApiResponseInterceptor } from './shared/interceptors/api-response.interceptor.js';
import { AppValidationPipe } from './shared/pipes/app-validation.pipe.js';
import { createOpenApiDocument } from './shared/utils/openapi.util.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((u) => u.trim())
    : ['http://localhost:3000'];

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Cho phép requests không có origin (như curl, mobile apps, server-to-server)
      if (!origin) return callback(null, true);

      // Cho phép nếu có trong danh sách allowedOrigins hoặc cho phép preview Vercel
      if (
        allowedOrigins.includes(origin) ||
        allowedOrigins.includes('*') ||
        origin.endsWith('.vercel.app') ||
        origin.includes('localhost')
      ) {
        return callback(null, true);
      }

      return callback(
        new Error(`CORS policy không cho phép origin: ${origin}`),
        false,
      );
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(new AppValidationPipe());
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new ApiResponseInterceptor(app.get(Reflector)));

  const port = process.env.PORT ?? 3001;

  const document = createOpenApiDocument(app);
  SwaggerModule.setup('docs', app, document);
  await app.listen(port);
  console.log(`🚀 NestJS API running on http://localhost:${port}`);
}
bootstrap();
