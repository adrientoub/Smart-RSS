/**
 * Keyboard navigation over an index-addressable list.
 *
 * The list is virtualized, so off-screen rows have no DOM node to walk to with
 * `nextElementSibling`; navigation is index arithmetic over the row model.
 */

/**
 * Next index after `from` in `direction` for which `isSelectable` holds, or -1.
 *
 * `from` may be out of range (-1 or `count`) to mean "nothing selected yet".
 * With `circular`, the search wraps to the far end and stops at `from`.
 */
export function findSiblingIndex(
    count: number,
    from: number,
    direction: 1 | -1,
    isSelectable: (index: number) => boolean,
    circular: boolean
): number {
    for (let index = from + direction; index >= 0 && index < count; index += direction) {
        if (isSelectable(index)) {
            return index;
        }
    }

    if (!circular) {
        return -1;
    }

    for (
        let index = direction === 1 ? 0 : count - 1;
        direction === 1 ? index <= from : index >= from;
        index += direction
    ) {
        if (index >= 0 && index < count && isSelectable(index)) {
            return index;
        }
    }

    return -1;
}
