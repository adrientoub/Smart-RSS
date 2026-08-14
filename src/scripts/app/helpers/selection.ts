/**
 * Index-based list selection, shared by the feed list and the article list.
 *
 * Ported from the old `selectable` mixin and `articleList.select`, which walked
 * DOM siblings. Only ids are involved here, so a virtualized list whose rows
 * mostly do not exist still behaves the same.
 */
export interface SelectionState {
    selected: string[];
    pivot: string | null;
    last: string | null;
}

export const emptySelection: SelectionState = { selected: [], pivot: null, last: null };

export interface SelectionModifiers {
    shiftKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
}

export interface SelectionResult {
    state: SelectionState;
    /** Whether this counts as picking a single row, which opens it. */
    picked: boolean;
}

const isToggle = (modifiers: SelectionModifiers) => Boolean(modifiers.ctrlKey || modifiers.metaKey);

export function selectId(
    current: SelectionState,
    order: readonly string[],
    id: string,
    modifiers: SelectionModifiers = {},
    forcePick = false
): SelectionResult {
    const indexes = new Map(order.map((value, index) => [value, index]));
    if (!indexes.has(id)) {
        return { state: current, picked: false };
    }

    const shift = Boolean(modifiers.shiftKey);
    const toggle = isToggle(modifiers);
    let selected: string[];
    let pivot = current.pivot;
    let picked = false;

    if ((!shift && !toggle) || (shift && !pivot)) {
        selected = [];
        pivot = id;
        picked = true;
    } else if (shift && pivot) {
        selected = [pivot];
        if (pivot !== id) {
            const from = Math.min(indexes.get(pivot), indexes.get(id));
            const to = Math.max(indexes.get(pivot), indexes.get(id));
            for (let index = from; index <= to; index++) {
                const between = order[index];
                if (between !== pivot && between !== id) {
                    selected.push(between);
                }
            }
        }
        picked = forcePick;
    } else if (toggle && current.selected.includes(id)) {
        return {
            state: {
                selected: current.selected.filter((value) => value !== id),
                pivot: null,
                last: current.last === id ? null : current.last,
            },
            picked: false,
        };
    } else {
        selected = [...current.selected];
        pivot = id;
    }

    if (selected[0] !== id) {
        selected.push(id);
    }

    return { state: { selected, pivot, last: id }, picked };
}

/** Drops ids that are no longer in the list. */
export function pruneSelection(current: SelectionState, order: readonly string[]): SelectionState {
    const present = new Set(order);
    const selected = current.selected.filter((id) => present.has(id));
    const pivot = current.pivot && present.has(current.pivot) ? current.pivot : null;
    const last = current.last && present.has(current.last) ? current.last : null;
    if (
        selected.length === current.selected.length &&
        pivot === current.pivot &&
        last === current.last
    ) {
        return current;
    }
    return { selected, pivot, last };
}

export function selectAll(order: readonly string[]): SelectionState {
    return {
        selected: [...order],
        pivot: order[0] ?? null,
        last: order[order.length - 1] ?? null,
    };
}
