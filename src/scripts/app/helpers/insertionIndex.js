/**
 * First index whose model sorts after `item`, so the new row is inserted before
 * it. `models` must already be in comparator order.
 *
 * Separate from the view so the ordering can be tested without a DOM.
 */
export function findInsertionIndex(models, item, comparator) {
    let low = 0;
    let high = models.length;
    while (low < high) {
        const mid = (low + high) >> 1;
        if (comparator(models[mid], item) === 1) {
            high = mid;
        } else {
            low = mid + 1;
        }
    }
    return low;
}
