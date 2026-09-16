import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { createOpenApiDocument } from '../src/shared/utils/openapi.util.js';

describe('OpenAPI document (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
  });

  afterAll(async () => {
    await app.close();
  });

  it('generates a cleaned OpenAPI 3 document for the registered routes', () => {
    const document = createOpenApiDocument(app);

    expect(document.openapi).toMatch(/^3\./);
    expect(document.paths['/fighters']?.get).toMatchObject({
      tags: ['Fighters'],
      security: [{ bearer: [] }],
      responses: { 200: expect.any(Object) },
    });
    expect(document.paths['/users/{id}']).toMatchObject({
      get: expect.any(Object),
      patch: expect.any(Object),
      delete: expect.any(Object),
    });
    expect(document.paths['/users/me']?.get).toMatchObject({
      tags: ['Users'],
      security: [{ bearer: [] }],
      responses: { 200: expect.any(Object), 403: expect.any(Object) },
    });
    expect(Object.keys(document.paths)).not.toContain('/permissions');
  });

  it('represents response date-times without OpenAPI 3.1-only null types', () => {
    const document = createOpenApiDocument(app);
    const schemas = document.components?.schemas;

    expect(schemas?.PublicFighterDto).toMatchObject({
      properties: {
        createdAt: { type: 'string', format: 'date-time' },
      },
    });
    expect(schemas?.PublicUserDto).toMatchObject({
      properties: {
        deletedAt: {
          type: 'string',
          format: 'date-time',
          nullable: true,
        },
      },
    });
    expect(JSON.stringify(document)).not.toContain('"type":"null"');
  });

  it('uses the registration-specific response contract', () => {
    const document = createOpenApiDocument(app);
    const registerResponse =
      document.paths['/auth/register']?.post?.responses?.[201];
    const serializedResponse = JSON.stringify(registerResponse);

    expect(serializedResponse).toContain('RegisterResponseDto');
    expect(serializedResponse).not.toContain('AuthResponseDto');
    expect(document.components?.schemas?.RegisterResponseDto).toMatchObject({
      required: ['user', 'session', 'confirmationRequired'],
    });
  });

  it('documents data for successful legacy endpoints without response DTOs', () => {
    const document = createOpenApiDocument(app);
    const healthResponse = document.paths['/health']?.get?.responses?.[200];

    expect(JSON.stringify(healthResponse)).toContain('"data"');
  });
});
