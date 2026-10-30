/**
 * English dictionary for app-wide states and tools: error and not-found screens, the unsaved-changes guard,
 * the quick-jump palette, exports and the install prompt.
 * Key prefix: `ux.`
 */
export const enScreensApp = {
    "ux.error.title": "This page didn't load",
    "ux.error.description": "Something went wrong while loading this data. Try again — if it keeps happening, tell your administrator.",
    "ux.error.sectionTitle": "This section didn't load",
    "ux.error.sectionDescription": "The rest of the page still works. Try this section again.",
    "ux.error.reference": "Reference {digest}",
    "ux.error.retry": "Try again",
    "ux.error.home": "Back to Today",
    "ux.unsaved.confirm": "You have changes that aren't saved. Leave this page anyway?",
    "ux.notFound.title": "We couldn't find that",
    "ux.notFound.description": "It may have been removed, or it belongs to a fighter you aren't assigned to.",
    "ux.notFound.rootTitle": "This page isn't in the octagon",
    "ux.notFound.rootDescription": "The page may have moved, or you may not have access to it. Records you aren't assigned to are hidden.",
    "ux.notFound.rootBack": "Back to my dashboard",
    "ux.notFound.metaTitle": "Page not found",
    "ux.notFound.home": "Back to Today",
} as const;
