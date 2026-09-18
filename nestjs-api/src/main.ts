import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

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

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Cấu hình Swagger API Documentation UI
  const config = new DocumentBuilder()
    .setTitle('MMA-TMS Backend API Documentation')
    .setDescription(
      'Tài liệu Swagger UI tương tác cho hệ thống phân tích kỹ thuật võ thuật MMA-TMS: Quản lý Video Analysis Jobs, Python Worker Callback & Anomaly Detection Alerts.',
    )
    .setVersion('1.0')
    .addApiKey(
      { type: 'apiKey', name: 'x-worker-secret', in: 'header', description: 'Secret key dùng cho Python Worker callback' },
      'x-worker-secret',
    )
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    customSiteTitle: 'MMA-TMS API Documentation',
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 NestJS API running on http://localhost:${port}`);
  console.log(`📚 Swagger UI API Docs available at http://localhost:${port}/api-docs`);
}
bootstrap();

