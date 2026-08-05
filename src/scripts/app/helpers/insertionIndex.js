/**
 * First index whose model sorts after `item`, so the new row is inserted before
 * it. `views` must already be in comparator order.
 *
 * Separate from the view so the ordering can be tested without a DOM.
 */
export function findInsertionIndex(views, item, comparator) {
    let low = 0;
    let high = views.length;
    while (low < high) {
        const mid = (low + high) >> 1;
        if (comparator(views[mid].model, item) === 1) {
            high = mid;
        } else {
            low = mid + 1;
        }
    }
    return low;
}
