/**
 * The article list is heterogeneous: date headers are interleaved with articles.
 * A virtualizer addresses rows by index, so the two have to live in one array.
 *
 * Kept free of Backbone and the DOM so the interleaving can be tested directly.
 */

export interface ItemRow<T> {
    type: "item";
    model: T;
    /** Index into the item array the rows were built from. */
    itemIndex: number;
}

export interface GroupRow {
    type: "group";
    title: string;
}

export type ListRow<T> = ItemRow<T> | GroupRow;

/**
 * Builds the row array for `models`, which must already be in display order.
 * Passing `null` for `groupTitleFor` produces items only.
 */
export function buildRows<T>(
    models: readonly T[],
    getDate: (model: T) => number,
    groupTitleFor: ((date: number) => string) | null
): Array<ListRow<T>> {
    const rows: Array<ListRow<T>> = [];
    let currentTitle: string | null = null;

    for (let index = 0; index < models.length; index++) {
        const model = models[index];
        if (groupTitleFor) {
            const title = groupTitleFor(getDate(model));
            if (title !== currentTitle) {
                currentTitle = title;
                rows.push({ type: "group", title });
            }
        }
        rows.push({ type: "item", model, itemIndex: index });
    }

    return rows;
}

/**
 * Row index of each item, so a selection expressed in item indexes can be turned
 * into a scroll target.
 */
export function itemRowIndexes<T>(rows: ReadonlyArray<ListRow<T>>): number[] {
    const indexes: number[] = [];
    for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        if (row.type === "item") {
            indexes[row.itemIndex] = index;
        }
    }
    return indexes;
}

/**
 * Title of the group each row belongs to, so the sticky header can be resolved
 * in O(1) instead of scanning backwards from the topmost visible row.
 */
export function groupTitleByRow<T>(rows: ReadonlyArray<ListRow<T>>): Array<string | null> {
    const titles: Array<string | null> = new Array(rows.length);
    let current: string | null = null;
    for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        if (row.type === "group") {
            current = row.title;
        }
        titles[index] = current;
    }
    return titles;
}
