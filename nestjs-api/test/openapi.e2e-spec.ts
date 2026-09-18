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

  it('publishes ADMIN permission-assignment routes without catalogue CRUD', () => {
    const document = createOpenApiDocument(app);
    const assignmentRoutes = [
      '/authorization/users/{userId}/permissions/{permissionCode}',
      '/authorization/roles/{role}/permissions/{permissionCode}',
    ];

    for (const path of assignmentRoutes) {
      expect(document.paths[path]?.put).toMatchObject({
        security: [{ bearer: [] }],
        responses: {
          200: expect.any(Object),
          401: expect.any(Object),
          403: expect.any(Object),
          404: expect.any(Object),
          422: expect.any(Object),
        },
      });
      expect(document.paths[path]?.delete).toMatchObject({
        security: [{ bearer: [] }],
        responses: {
          200: expect.any(Object),
          401: expect.any(Object),
          403: expect.any(Object),
          404: expect.any(Object),
          422: expect.any(Object),
        },
      });
    }

    expect(document.paths['/permissions']).toBeUndefined();
    expect(document.paths['/permissions/{id}']).toBeUndefined();
  });

  it('requires the user permission override body in OpenAPI', () => {
    const operation =
      createOpenApiDocument(app).paths[
        '/authorization/users/{userId}/permissions/{permissionCode}'
      ]?.put;

    expect(operation?.requestBody).toMatchObject({ required: true });
    expect(JSON.stringify(operation?.requestBody)).toContain(
      'SetUserPermissionOverrideBodyDto',
    );
    expect(
      createOpenApiDocument(app).components?.schemas
        ?.SetUserPermissionOverrideBodyDto,
    ).toMatchObject({
      required: ['isGranted'],
      properties: { isGranted: { type: 'boolean' } },
      additionalProperties: false,
    });
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

  it('publishes every Training Management route with bearer security', () => {
    const document = createOpenApiDocument(app);
    const routes = {
      '/training-plans': ['get', 'post'],
      '/training-plans/{id}': ['get', 'patch'],
      '/training-plans/{id}/status': ['patch'],
      '/training-plans/{id}/exercises': ['get', 'post'],
      '/training-plans/{id}/exercises/{exerciseId}': ['patch', 'delete'],
      '/training-sessions': ['get', 'post'],
      '/training-sessions/{id}': ['get', 'patch'],
      '/training-sessions/{id}/status': ['patch'],
      '/exercises': ['get', 'post'],
      '/exercises/{id}': ['get', 'patch'],
    } as const;

    for (const [path, methods] of Object.entries(routes)) {
      for (const method of methods) {
        expect(document.paths[path]?.[method]).toMatchObject({
          security: [{ bearer: [] }],
        });
      }
    }
  });

  it('documents Training success and error contracts on stateful routes', () => {
    const document = createOpenApiDocument(app);

    expect(
      document.paths['/training-plans/{id}/status']?.patch?.responses,
    ).toMatchObject({
      200: expect.any(Object),
      401: expect.any(Object),
      403: expect.any(Object),
      404: expect.any(Object),
      409: expect.any(Object),
      422: expect.any(Object),
    });
    expect(
      document.paths['/training-sessions/{id}/status']?.patch?.responses,
    ).toMatchObject({
      200: expect.any(Object),
      400: expect.any(Object),
      401: expect.any(Object),
      403: expect.any(Object),
      404: expect.any(Object),
      409: expect.any(Object),
      422: expect.any(Object),
    });
    expect(document.paths['/training-plans']?.post?.responses).toMatchObject({
      201: expect.any(Object),
      400: expect.any(Object),
      401: expect.any(Object),
      403: expect.any(Object),
      409: expect.any(Object),
      422: expect.any(Object),
    });
  });

  it('keeps Training request and response schemas aligned with persistence names', () => {
    const schemas = createOpenApiDocument(app).components?.schemas;
    const exercise = schemas?.ExerciseResponseDto as {
      properties?: Record<string, unknown>;
    };
    const sessionUpdate = schemas?.UpdateSessionDto as {
      properties?: Record<string, unknown>;
    };
    const plan = schemas?.TrainingPlanResponseDto as {
      properties?: Record<string, unknown>;
    };

    expect(exercise.properties).toHaveProperty('name');
    expect(exercise.properties).toHaveProperty('targetMuscleGroups');
    expect(exercise.properties).toHaveProperty('thumbnailUrl');
    expect(exercise.properties).not.toHaveProperty('title');
    expect(sessionUpdate.properties).toHaveProperty('coachNotes');
    expect(sessionUpdate.properties).not.toHaveProperty('status');
    expect(sessionUpdate.properties).not.toHaveProperty('fighterId');
    expect(sessionUpdate.properties).not.toHaveProperty('coachId');
    expect(sessionUpdate.properties).not.toHaveProperty('planId');
    expect(plan.properties).toHaveProperty('milestones');
    expect(plan.properties).toHaveProperty('progress');
  });
});
