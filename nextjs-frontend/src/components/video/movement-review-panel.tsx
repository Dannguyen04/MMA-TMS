"use client";

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import type { MovementEvidence } from '@/lib/domain/movement-evidence';
import { movementReviewInputSchema, movementReviewSavedSchema, movementReviewStateSchema, type MovementReviewState } from '@/lib/domain/movement-review';
import { formatTimestamp } from '@/lib/format';

async function loadReviewState(jobId: string, signal?: AbortSignal): Promise<MovementReviewState> {
    const response = await fetch(`/api/ai-jobs/${jobId}/reviews`, { cache: 'no-store', signal });
    if (!response.ok) throw new Error('Review history is unavailable. Check access or retry.');
    return movementReviewStateSchema.parse(await response.json());
}

/** Shared footage observations only. Clinical findings belong in the medical dossier. */
export function MovementReviewPanel({ jobId, report }: { jobId: string; report: MovementEvidence }) {
    const id = useId();
    const [state, setState] = useState<MovementReviewState | null>(null);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const [windowId, setWindowId] = useState(report.windows[0]?.id ?? '');
    const [decision, setDecision] = useState<'confirmed' | 'corrected' | 'rejected'>('confirmed');
    // Keep the same request ID on transport retries; changed content gets a new ID.
    const pending = useRef<{ signature: string; requestId: string } | null>(null);
    const show = useCallback((loaded: MovementReviewState) => { setState(loaded); setError(''); }, []);
    const refresh = useCallback(async () => show(await loadReviewState(jobId)), [jobId, show]);
    useEffect(() => {
        const controller = new AbortController();
        loadReviewState(jobId, controller.signal).then(
            loaded => { if (!controller.signal.aborted) show(loaded); },
            e => { if (!controller.signal.aborted) setError(e.message); },
        );
        return () => controller.abort();
    }, [jobId, show]);
    const window = report.windows.find(w => w.id === windowId);
    const history = state?.reviews.filter(r => r.windowId === windowId) ?? [];
    const revision = Math.max(0, ...history.filter(r => r.reviewerId === state?.reviewerId).map(r => r.revision));

    async function submit(form: HTMLFormElement) {
        if (!state?.canReview || !window || busy) return;
        const data = new FormData(form);
        const content = { windowId, expectedRevision: revision, decision, notes: String(data.get('notes') ?? ''),
            ...(decision === 'corrected' ? { startMs: Number(data.get('startMs')), endMs: Number(data.get('endMs')) } : {}) };
        const signature = JSON.stringify(content);
        if (pending.current?.signature !== signature) pending.current = { signature, requestId: crypto.randomUUID() };
        const parsed = movementReviewInputSchema.safeParse({ ...content, requestId: pending.current.requestId });
        if (!parsed.success) { setError('Enter an observation and, for a narrowed interval, valid start/end times.'); return; }
        setBusy(true); setError(''); setMessage('');
        try {
            const response = await fetch(`/api/ai-jobs/${jobId}/reviews`, { method: 'POST', cache: 'no-store',
                headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.data) });
            if (!response.ok) {
                if (response.status === 409) {
                    await refresh(); pending.current = null;
                    throw new Error('Review state changed. Inspect the refreshed history before submitting again.');
                }
                throw new Error('Review was not saved. Check your access and interval, then retry.');
            }
            movementReviewSavedSchema.parse(await response.json());
            pending.current = null;
            setMessage('Review saved. The original AI evidence is unchanged.');
            await refresh();
            form.reset();
        } catch (e) { setError(e instanceof Error ? e.message : 'Review could not be saved.'); }
        finally { setBusy(false); }
    }

    return <section className="space-y-3 border-t border-border pt-3" aria-label="Human evidence review">
        <h3 className="text-sm font-semibold">Human evidence review</h3>
        <p className="text-xs text-fg-muted">Shared with the fighter and authorized staff. Record visible observations only; do not enter diagnoses or private clinical notes here. Confirmation means useful footage, not correct technique or fitness to train.</p>
        {state?.context?.exerciseName && <p className="text-xs">Assigned exercise: {state.context.exerciseName} (assignment link verified, execution not verified)</p>}
        {error && <p role="alert" className="text-xs text-danger-fg">{error}</p>}
        {message && <p role="status" className="text-xs">{message}</p>}
        <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => refresh().catch(e => setError(e.message))}>Reload review history</Button>
        {report.windows.length > 0 && <Field label="Evidence window" htmlFor={`${id}-window`}>
            <Select id={`${id}-window`} value={windowId} disabled={busy} onChange={e => { setWindowId(e.target.value); setMessage(''); }}>
                {report.windows.map(w => <option key={w.id} value={w.id}>{formatTimestamp(w.startMs)} – {formatTimestamp(w.endMs)}</option>)}
            </Select>
        </Field>}
        <ul className="space-y-2 text-xs">
            {history.map(r => <li key={r.id} className="rounded border border-border p-2">
                <p>{r.reviewerRole} · {r.reviewerId === state?.reviewerId ? 'You' : r.reviewerId} · revision {r.revision} · {r.decision}</p>
                <time dateTime={r.createdAt}>{r.createdAt}</time>
                {r.startMs != null && r.endMs != null && <p>Selected interval: {formatTimestamp(r.startMs)} – {formatTimestamp(r.endMs)}</p>}
                <p className="whitespace-pre-wrap">{r.notes}</p>
            </li>)}
        </ul>
        {state && !history.length && <p className="text-xs text-fg-muted">No saved observations for this window.</p>}
        {state?.canReview && window && <form key={windowId} className="space-y-3" onSubmit={e => { e.preventDefault(); void submit(e.currentTarget); }}>
            <fieldset disabled={busy} className="space-y-3">
                <Field label="Footage decision" htmlFor={`${id}-decision`}>
                    <Select id={`${id}-decision`} value={decision} onChange={e => setDecision(e.target.value as typeof decision)}>
                        <option value="confirmed">Useful footage</option><option value="corrected">Narrow the interval</option><option value="rejected">Not useful for review</option>
                    </Select>
                </Field>
                {decision === 'corrected' && <div className="grid grid-cols-2 gap-2">
                    <Field label="Start (ms)" htmlFor={`${id}-start`}><Input id={`${id}-start`} name="startMs" type="number" step="any" min={window.startMs} max={window.endMs} defaultValue={window.startMs} required /></Field>
                    <Field label="End (ms)" htmlFor={`${id}-end`}><Input id={`${id}-end`} name="endMs" type="number" step="any" min={window.startMs} max={window.endMs} defaultValue={window.endMs} required /></Field>
                </div>}
                <Field label="Visible observation" htmlFor={`${id}-notes`} required>
                    <Textarea id={`${id}-notes`} name="notes" required maxLength={2000} rows={3} />
                </Field>
                <Button type="submit" size="sm" disabled={busy}>{busy ? 'Saving…' : `Save review revision ${revision + 1}`}</Button>
            </fieldset>
        </form>}
    </section>;
}
