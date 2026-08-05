/**
 * Whether a model change touched only the read state.
 *
 * Read state is expressed with classes on the row, so such a change needs no new
 * content. The caller must also check that content exists: `model.changed`
 * survives until the next `set`, so a view created afterwards would otherwise
 * skip its only render and stay blank.
 */
export function isReadStateOnlyChange(changed) {
    if (!changed || typeof changed !== "object") {
        return false;
    }
    const keys = Object.keys(changed);
    if (keys.length === 1) {
        return keys[0] === "unread" || keys[0] === "visited";
    }
    if (keys.length === 2) {
        return keys.includes("unread") && keys.includes("visited");
    }
    return false;
}
