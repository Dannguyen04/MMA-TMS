import { Injectable } from '@nestjs/common';
import type {
  ListSessionTemplatesQuery,
  SessionTemplateEntity,
  SessionTemplateLocaleType,
  SessionTemplateResponse,
} from '../training.model.js';
import { SessionTemplateRepository } from './session-template.repo.js';

/** The template with its text in one language. */
export function resolveSessionTemplate(
  template: SessionTemplateEntity,
  locale: SessionTemplateLocaleType,
): SessionTemplateResponse {
  const text = template.translations[locale];
  return {
    id: template.id,
    code: template.code,
    category: template.category,
    sessionType: template.sessionType,
    plannedDurationMin: template.plannedDurationMin,
    targetRpe: template.targetRpe,
    name: text.name,
    purpose: text.purpose,
    rationale: text.rationale,
    steps: text.steps,
  };
}

@Injectable()
export class SessionTemplateService {
  constructor(private readonly repo: SessionTemplateRepository) {}

  async listTemplates(
    query: ListSessionTemplatesQuery,
  ): Promise<SessionTemplateResponse[]> {
    const templates = await this.repo.findActive();
    return templates.map((template) =>
      resolveSessionTemplate(template, query.locale),
    );
  }
}
