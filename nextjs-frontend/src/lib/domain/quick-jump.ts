/** Lower case without Vietnamese marks, so "vo si" finds "Võ sĩ" and "dang" finds "Đặng". */
export function foldText(text: string): string {
    return text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}

/** Items whose label contains every word of the query (in any order), labels starting with the query first. */
export function matchItems<T extends { label: string }>(items: T[], query: string, limit = 12): T[] {
    const words = foldText(query).split(/\s+/).filter(Boolean);
    if (words.length === 0) return items.slice(0, limit);
    const scored = items
        .map((item) => ({ item, folded: foldText(item.label) }))
        .filter(({ folded }) => words.every((word) => folded.includes(word)))
        .sort((a, b) => Number(!a.folded.startsWith(words[0])) - Number(!b.folded.startsWith(words[0])));
    return scored.slice(0, limit).map(({ item }) => item);
}
