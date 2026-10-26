/** A term the interface explains in a tooltip. */
export interface GlossaryEntry {
    /** The term as the interface shows it. */
    term: string;
    /** One or two plain sentences, short enough for a tooltip (at most 220 characters). */
    definition: string;
}
