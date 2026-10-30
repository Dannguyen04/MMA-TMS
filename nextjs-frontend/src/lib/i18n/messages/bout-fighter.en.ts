/** English text for the fighter's bout and weigh-in pages and the shared weight components. Keys start with `boutFighter.`. */
export const enBoutFighter = {
    /* Fighter bout page */
    "boutFighter.page.title": "Bout",
    "boutFighter.page.noBout": "No upcoming bout",
    "boutFighter.page.noBoutText": "You can still log today's weight.",
    "boutFighter.page.opponentTba": "Opponent TBA",
    "boutFighter.page.limit": "Limit",
    "boutFighter.page.catchweight": "Catchweight",
    "boutFighter.page.noUpperLimit": "No upper limit",
    "boutFighter.page.weighIn": "Weigh-in",
    "boutFighter.page.bout": "Bout",
    "boutFighter.page.countdown": "Countdown",
    "boutFighter.page.noPlan": "No plan for this phase yet.",
    "boutFighter.page.medicalFile": "Medical file",
    "boutFighter.page.noDocuments": "Your coach hasn't listed any documents for this bout yet.",
    "boutFighter.page.optional": "Optional",
    "boutFighter.page.validUntil": "Valid until {date}",
    "boutFighter.page.validUntilLate": "Valid until {date} (before the bout)",

    /* Loading states */
    "boutFighter.loading.bout": "Loading bout",
    "boutFighter.loading.weighIn": "Loading weigh-in",

    /* Today's weight page */
    "boutFighter.weighIn.title": "Today's weight",
    "boutFighter.weighIn.description": "Log this morning's weight. Saving again today replaces the earlier number.",
    "boutFighter.weighIn.back": "Bout",

    /* Weigh-in form */
    "boutFighter.form.weight": "Weight",
    "boutFighter.form.weightHint": "Kilograms, such as 66.5. Today's entry replaces an earlier one.",
    "boutFighter.form.adherenceQuestion": "Did yesterday follow the plan?",
    "boutFighter.form.optional": "(optional)",
    "boutFighter.form.adherenceHint": "Skip this and today's weight still saves.",
    "boutFighter.form.note": "Note",
    "boutFighter.form.noteHint": "200 characters at most.",
    "boutFighter.form.saving": "Saving",
    "boutFighter.form.save": "Save",

    /* Nutrition plan form (coach) */
    "boutFighter.plan.currentPhase": "Now",
    "boutFighter.plan.intro": "Write what this fighter should eat in each phase. The app stores the words you type.",
    "boutFighter.plan.lastEdited": "Last edited by {name}, {date}",
    "boutFighter.plan.writtenBy": "Written by",
    "boutFighter.plan.writtenByHint": "Your name, or the specialist you are copying from.",
    "boutFighter.plan.saving": "Saving",
    "boutFighter.plan.save": "Save plan",

    /* Camp weight chart */
    "boutFighter.chart.empty": "No camp days to chart yet.",
    "boutFighter.chart.tableCaption": "Camp weight by day",
    "boutFighter.chart.day": "Day",
    "boutFighter.chart.weight": "Weight",
    "boutFighter.chart.reference": "Reference",
    "boutFighter.chart.planAnswer": "Plan answer",
    "boutFighter.chart.limit": "Limit",
    "boutFighter.chart.legend": "Plan answer dots",
    "boutFighter.chart.aria": "Weight against a {limit} kg limit. {latest}, status {status}.",
    "boutFighter.chart.ariaNoLimit": "Weight against no limit set. {latest}, status {status}.",
    "boutFighter.chart.ariaLatest": "Latest {kg} kg",
    "boutFighter.chart.ariaNoWeight": "No weight logged",

    /* Weight cards */
    "boutFighter.weight.title": "Weight",
    "boutFighter.weight.noWeight": "No weight logged",
    "boutFighter.weight.remaining": "{pct}% remaining",
    "boutFighter.weight.noWeightsInCamp": "No weights logged in this camp yet.",
    "boutFighter.weight.logWeight": "Log weight",
    "boutFighter.weight.noBout": "No upcoming bout",
    "boutFighter.weight.noWeightYet": "No weight logged yet",
    "boutFighter.weight.todayTitle": "Today's weight",
    "boutFighter.weight.logToday": "Log today's weight",
} as const;
