import "server-only";

import { z } from "zod";

import { isDemoAuthEnabled } from "@/lib/auth/constants";
import { readDemoUser } from "@/lib/auth/demo-session";
import { setSessionCookies } from "@/lib/auth/session-cookies";
import { sessionTokensSchema } from "@/lib/auth/session-tokens";
import { foldName } from "@/lib/query";
import { apiRequest, getMutableAccessToken, type ApiRequestOptions } from "./client";

const exchangeSchema = z.object({
    user: z.object({ id: z.string().uuid(), email: z.string().email(), role: z.string() }).passthrough(),
    session: sessionTokensSchema.extend({ tokenType: z.string() }),
});

const backendFighterSchema = z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
});

const fighterPageSchema = z.object({
    data: z.array(backendFighterSchema),
    total: z.number().int().nonnegative(),
    hasNextPage: z.boolean(),
});

type PipelineSession = z.output<typeof exchangeSchema>["session"];
const globalPipelineAuth = globalThis as typeof globalThis & {
    __mmaPipelineSessions?: Map<string, PipelineSession>;
    __mmaPipelineExchanges?: Map<string, Promise<PipelineSession>>;
};
const pipelineSessions = (globalPipelineAuth.__mmaPipelineSessions ??= new Map());
const pipelineExchanges = (globalPipelineAuth.__mmaPipelineExchanges ??= new Map());

const currentUserSchema = z.object({
    email: z.string().email(),
    profile: z.object({ id: z.string().uuid() }).passthrough().nullable(),
});

/**
 * Returns a real backend token for the AI pipeline. In local demo mode the
 * server exchanges the current demo identity; the shared secret never reaches
 * browser JavaScript. Production can only use the normal authenticated session.
 */
export async function getPipelineAccessToken(): Promise<string> {
    if (!isDemoAuthEnabled() || process.env.NODE_ENV === "production") return getMutableAccessToken();

    const secret = process.env.DEMO_SESSION_EXCHANGE_SECRET;
    const demoUser = await readDemoUser();
    if (!secret || !demoUser) throw new Error("The development AI session bridge is not configured.");

    const cached = pipelineSessions.get(demoUser.email);
    const now = Math.floor(Date.now() / 1000);
    if (cached && (cached.expiresAt ?? now + cached.expiresIn) - now > 30) return cached.accessToken;

    let pending = pipelineExchanges.get(demoUser.email);
    if (!pending) {
        pending = apiRequest("/auth/demo-session", exchangeSchema, {
            method: "POST",
            headers: { "x-demo-session-secret": secret },
            body: JSON.stringify({ email: demoUser.email }),
        }).then((exchange) => exchange.session);
        pipelineExchanges.set(demoUser.email, pending);
    }
    try {
        const session = await pending;
        pipelineSessions.set(demoUser.email, session);
        // Route Handlers may persist the session. Server Components cannot set
        // cookies, but can safely use the same server-cached development token.
        try {
            await setSessionCookies(session);
        } catch {
            // Expected during read-only Server Component rendering.
        }
        return session.accessToken;
    } finally {
        pipelineExchanges.delete(demoUser.email);
    }
}

/** Maps a demo fighter id to the matching scoped backend profile. */
export async function resolvePipelineFighterId(fighterId: string, accessToken: string): Promise<string> {
    if (z.string().uuid().safeParse(fighterId).success) return fighterId;
    if (!isDemoAuthEnabled()) throw new Error("The fighter id is invalid.");

    const { db } = await import("@/lib/mocks/db");
    const store = db();
    const demoFighter = store.fighters.find((fighter) => fighter.id === fighterId);
    if (!demoFighter) throw new Error("The demo fighter could not be mapped to the API.");
    const demoFighterUser = store.users.find((user) => user.id === demoFighter.userId);

    const currentUser = await apiRequest("/users/me", currentUserSchema, { accessToken });
    if (demoFighterUser?.email === currentUser.email && currentUser.profile) return currentUser.profile.id;

    // Query the already authorization-scoped roster and match locally. Database
    // search collation can treat Vietnamese diacritics differently, producing a
    // false empty result for names such as "Minh Trần".
    const page = await apiRequest("/fighters?page=1&limit=100", fighterPageSchema, {
        accessToken,
    });
    const wanted = foldName(demoFighter.name);
    const matches = page.data.filter((fighter) => foldName(`${fighter.firstName} ${fighter.lastName}`) === wanted);
    if (matches.length !== 1) throw new Error("The demo fighter does not have one unambiguous API profile.");
    return matches[0].id;
}

export async function pipelineApiRequest<T extends z.ZodType>(path: string, schema: T, options: ApiRequestOptions = {}) {
    return apiRequest(path, schema, { ...options, accessToken: await getPipelineAccessToken() });
}
