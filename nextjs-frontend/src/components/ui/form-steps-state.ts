/** The part of an action state the stepper reads. */
export interface StepState {
    status: string;
}

export interface MissingControl {
    element: HTMLElement;
    /** The control's visible label without the required marker, or "" when it has none. */
    label: string;
}

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const CONTROLS = "input, select, textarea";

function cleanLabel(text: string | null | undefined): string {
    return (text ?? "")
        .replace(/\(optional\)|\(required\)|\*/gi, "")
        .replace(/\s+/g, " ")
        .trim();
}

function textOfIds(root: Document, ids: string | null): string {
    if (!ids) return "";
    return ids
        .split(/\s+/)
        .map((id) => root.getElementById(id)?.textContent ?? "")
        .join(" ");
}

function controlLabel(element: Control): string {
    const group = element.type === "radio" ? element.closest<HTMLElement>('[role="radiogroup"]') : null;
    if (group) {
        const named = cleanLabel(group.getAttribute("aria-label") ?? textOfIds(element.ownerDocument, group.getAttribute("aria-labelledby")));
        return named || cleanLabel(group.querySelector("legend")?.textContent);
    }
    const own = element.labels?.[0]?.textContent ?? element.getAttribute("aria-label") ?? textOfIds(element.ownerDocument, element.getAttribute("aria-labelledby"));
    if (cleanLabel(own)) return cleanLabel(own);
    return cleanLabel(element.closest("fieldset")?.querySelector("legend")?.textContent);
}

/** True when the control sits inside a hidden or closed container below the step panel itself. */
function concealed(element: HTMLElement, panel: HTMLElement): boolean {
    for (let node = element.parentElement; node && node !== panel; node = node.parentElement) {
        if (node.hidden) return true;
        if (node instanceof HTMLDetailsElement && !node.open && !(element.closest("summary"))) return true;
    }
    return false;
}

/**
 * Required controls in a step that are still empty: text-like fields with only whitespace, unselected selects,
 * unticked required checkboxes and radio groups with nothing chosen. Disabled and concealed controls are skipped.
 */
export function missingRequiredControls(panel: HTMLElement): MissingControl[] {
    const missing: MissingControl[] = [];
    const radioGroups = new Set<string>();
    for (const element of panel.querySelectorAll<Control>(CONTROLS)) {
        if (element.disabled || element.type === "hidden" || concealed(element, panel)) continue;
        const required = element.required || element.getAttribute("aria-required") === "true";
        if (!required) continue;
        if (element instanceof HTMLInputElement && element.type === "radio") {
            if (!element.name || radioGroups.has(element.name)) continue;
            radioGroups.add(element.name);
            const group = panel.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(element.name)}"]`);
            if (![...group].some((radio) => radio.checked)) missing.push({ element, label: controlLabel(element) });
            continue;
        }
        const empty = element instanceof HTMLInputElement && element.type === "checkbox" ? !element.checked : element.value.trim() === "";
        if (empty) missing.push({ element, label: controlLabel(element) });
    }
    return missing;
}

/** The id of the step holding the first control marked invalid, or null when no step holds one. */
export function firstStepWithError(root: HTMLElement): string | null {
    const invalid = root.querySelector('[aria-invalid="true"], [data-invalid="true"]');
    return invalid?.closest("[data-form-step]")?.getAttribute("data-form-step") ?? null;
}
