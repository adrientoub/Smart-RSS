import { readFileSync } from "node:fs";

type Factory = (...deps: unknown[]) => unknown;

/**
 * Evaluates a hand-written AMD module from src/ and returns its export.
 * Temporary: delete once the tree is converted to ES modules.
 */
export function loadAmd<T>(relativePath: string, deps: Record<string, unknown> = {}): T {
    const source = readFileSync(new URL(`../../src/${relativePath}`, import.meta.url), "utf8");

    let exported: unknown;
    const define = (a: string[] | Factory, b?: Factory) => {
        const factory = (typeof a === "function" ? a : b) as Factory;
        const names = Array.isArray(a) ? a : [];
        const resolve = (name: string) => {
            if (!(name in deps)) {
                throw new Error(`loadAmd: unstubbed dependency "${name}" in ${relativePath}`);
            }
            return deps[name];
        };
        exported = factory(...names.map(resolve));
    };

    new Function("define", source)(define);

    if (exported === undefined) {
        throw new Error(`loadAmd: ${relativePath} did not export anything`);
    }
    return exported as T;
}
