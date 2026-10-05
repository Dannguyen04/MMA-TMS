"use client";

import { useEffect, useId, useState } from 'react';
import { z } from 'zod';
import { Field, Select } from '@/components/ui/form';
import { assignedExercisesSchema } from '@/lib/domain/movement-review';
import type { DetailsState } from './upload-wizard-state';

export function ExerciseContextFields({ details, onChange }: { details: DetailsState; onChange: (patch: Partial<DetailsState>) => void }) {
    const id = useId();
    const [loaded, setLoaded] = useState<{ sessionId: string; exercises: z.infer<typeof assignedExercisesSchema> } | null>(null);
    const [error, setError] = useState('');
    const validSession = z.string().uuid().safeParse(details.sessionId).success;
    useEffect(() => {
        if (!validSession) return;
        const controller = new AbortController();
        fetch(`/api/ai-jobs/exercises?sessionId=${encodeURIComponent(details.sessionId)}`, { cache: 'no-store', signal: controller.signal })
            .then(async response => { if (!response.ok) throw new Error(); return assignedExercisesSchema.parse(await response.json()); })
            .then(exercises => { if (!controller.signal.aborted) { setLoaded({ sessionId: details.sessionId, exercises }); setError(''); } })
            .catch(() => { if (!controller.signal.aborted) setError('Assigned exercises could not be loaded. Re-select the session to retry, or continue without an exercise link.'); });
        return () => controller.abort();
    }, [details.sessionId, validSession]);
    const exercises = loaded?.sessionId === details.sessionId ? loaded.exercises : [];
    return <div className="grid gap-4 md:grid-cols-2">
        <Field label="Assigned exercise" htmlFor={`${id}-exercise`} optional hint="Links the recording to an assigned exercise; does not verify its execution." error={validSession ? error : undefined}>
            <Select id={`${id}-exercise`} value={details.sessionExerciseId ?? ''} disabled={!validSession || !exercises.length}
                onChange={e => onChange({ sessionExerciseId: e.target.value })}>
                <option value="">{validSession ? 'No exercise selected' : 'Choose a saved training session first'}</option>
                {exercises.map(exercise => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}
            </Select>
        </Field>
        <Field label="Visibility protocol" htmlFor={`${id}-protocol`} hint="Selects which joints must remain visible. Not a clinical measurement protocol.">
            <Select id={`${id}-protocol`} value={details.evidenceProtocol ?? 'whole_body_v1'}
                onChange={e => onChange({ evidenceProtocol: e.target.value as DetailsState['evidenceProtocol'] })}>
                <option value="whole_body_v1">Whole body</option><option value="upper_body_v1">Upper body</option><option value="lower_body_v1">Lower body</option>
            </Select>
        </Field>
    </div>;
}
