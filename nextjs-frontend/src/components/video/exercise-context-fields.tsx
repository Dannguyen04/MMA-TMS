"use client";

import { useEffect, useId, useState } from 'react';
import { z } from 'zod';
import { useT } from '@/components/i18n/locale-provider';
import { Field, Select } from '@/components/ui/form';
import { assignedExercisesSchema } from '@/lib/domain/movement-review';
import type { DetailsState } from './upload-wizard-state';

export function ExerciseContextFields({ details, onChange }: { details: DetailsState; onChange: (patch: Partial<DetailsState>) => void }) {
    const id = useId();
    const t = useT();
    const loadFailed = t('screens.video.upload.exercisesFailed');
    const [loaded, setLoaded] = useState<{ sessionId: string; exercises: z.infer<typeof assignedExercisesSchema> } | null>(null);
    const [error, setError] = useState('');
    const validSession = z.string().uuid().safeParse(details.sessionId).success;
    useEffect(() => {
        if (!validSession) return;
        const controller = new AbortController();
        fetch(`/api/ai-jobs/exercises?sessionId=${encodeURIComponent(details.sessionId)}`, { cache: 'no-store', signal: controller.signal })
            .then(async response => { if (!response.ok) throw new Error(); return assignedExercisesSchema.parse(await response.json()); })
            .then(exercises => { if (!controller.signal.aborted) { setLoaded({ sessionId: details.sessionId, exercises }); setError(''); } })
            .catch(() => { if (!controller.signal.aborted) setError(loadFailed); });
        return () => controller.abort();
    }, [details.sessionId, validSession, loadFailed]);
    const exercises = loaded?.sessionId === details.sessionId ? loaded.exercises : [];
    return <div className="grid gap-4 md:grid-cols-2">
        <Field label={t('screens.video.upload.exercise')} htmlFor={`${id}-exercise`} optional hint={t('screens.video.upload.exerciseHint')} error={validSession ? error : undefined}>
            <Select id={`${id}-exercise`} value={details.sessionExerciseId ?? ''} disabled={!validSession || !exercises.length}
                onChange={e => onChange({ sessionExerciseId: e.target.value })}>
                <option value="">{validSession ? t('screens.video.upload.noExercise') : t('screens.video.upload.sessionFirst')}</option>
                {exercises.map(exercise => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}
            </Select>
        </Field>
        <Field label={t('screens.video.upload.protocol')} htmlFor={`${id}-protocol`} hint={t('screens.video.upload.protocolHint')}>
            <Select id={`${id}-protocol`} value={details.evidenceProtocol ?? 'whole_body_v1'}
                onChange={e => onChange({ evidenceProtocol: e.target.value as DetailsState['evidenceProtocol'] })}>
                <option value="whole_body_v1">{t('screens.video.evidence.protocol.whole_body_v1')}</option>
                <option value="upper_body_v1">{t('screens.video.evidence.protocol.upper_body_v1')}</option>
                <option value="lower_body_v1">{t('screens.video.evidence.protocol.lower_body_v1')}</option>
            </Select>
        </Field>
    </div>;
}
