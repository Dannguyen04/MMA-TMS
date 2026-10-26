/**
 * How a SCAT6 schema issue reads on the form. The schema mirrors the service rule for rule; an answer the doctor
 * hasn't given yet (a yes/no left blank, a part not marked performed or not) reaches it as null and gets a plain
 * sentence here instead of zod's wording. Safe for Server and Client Components.
 */

interface IssueLike {
    code: string;
    message: string;
    path: PropertyKey[];
    expected?: unknown;
    discriminator?: unknown;
}

/** The sentence for one issue. */
export function scat6IssueMessage(issue: IssueLike): string {
    if (issue.code === "invalid_type" && issue.expected === "boolean") return "Answer yes or no.";
    if (issue.code === "invalid_union" && issue.discriminator === "performed") return "Say whether it was performed.";
    return issue.message;
}

/** The issues with plain sentences, the rest of each issue unchanged. */
export function friendlyScat6Issues<T extends IssueLike>(issues: readonly T[]): T[] {
    return issues.map((issue) => ({ ...issue, message: scat6IssueMessage(issue) }));
}
