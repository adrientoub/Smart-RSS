import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
    {
        ignores: ["dist/**", "node_modules/**", "docs/**"],
    },

    js.configs.recommended,
    ...tseslint.configs.recommended,

    // Extension sources: browser + WebExtension APIs.
    {
        files: ["src/**/*.{js,ts}"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                ...globals.browser,
                ...globals.webextensions,
            },
        },
        rules: {
            eqeqeq: ["error", "smart"],
            curly: "error",
            "no-empty": ["error", { allowEmptyCatch: true }],
            "no-var": "error",
            "prefer-const": "error",
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": [
                "warn",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
            ],
            // Loose on purpose: this is a gradual JS -> TS migration.
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/ban-ts-comment": "off",
            "@typescript-eslint/no-empty-object-type": "off",
        },
    },

    // UI pages reach into the background page via `window.bg`. Removed once the
    // background exposes a real message-passing API instead of shared globals.
    {
        files: ["src/scripts/app/**/*.js", "src/scripts/appEntrypoint.js"],
        languageOptions: {
            globals: { bg: "readonly", app: "readonly", tabID: "readonly" },
        },
    },

    // Background process attaches its collections to `window`.
    {
        files: ["src/scripts/bgprocess/**/*.js"],
        languageOptions: {
            globals: {
                settings: "readonly",
                sources: "readonly",
                items: "readonly",
                folders: "readonly",
                toolbars: "readonly",
                loader: "readonly",
                info: "readonly",
                Source: "readonly",
                Folder: "readonly",
                getBoolean: "readonly",
                valueToBoolean: "readonly",
                getElementSetting: "readonly",
            },
        },
    },

    // Web worker context.
    {
        files: ["src/scripts/options/worker.js"],
        languageOptions: {
            globals: { ...globals.worker },
        },
    },

    // Node-side build tooling.
    {
        files: ["build.js", "*.config.{js,mjs}", "tools/**/*.{js,mjs}"],
        languageOptions: {
            sourceType: "commonjs",
            globals: { ...globals.node },
        },
        rules: {
            "@typescript-eslint/no-require-imports": "off",
        },
    },

    // Tests run on the Node test runner.
    {
        files: ["test/**/*.{js,ts}"],
        languageOptions: {
            sourceType: "module",
            globals: { ...globals.node },
        },
    },

    prettier
);
