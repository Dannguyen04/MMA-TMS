/** Appends a suggestion to free text as a new sentence, without adding it twice. */
export function appendSuggestion(current: string, value: string): string {
    const text = current.trimEnd();
    if (!text) return value;
    if (text.toLowerCase().includes(value.toLowerCase())) return current;
    const joiner = /[.!?]$/.test(text) ? " " : ". ";
    return `${text}${joiner}${value}`;
}
