import { defineConfig, globalIgnores } from "eslint/config";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import jsdoc from "eslint-plugin-jsdoc";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([globalIgnores(["**/node_modules", "**/dist"]), {
    extends: compat.extends(
        "eslint:recommended",
        "plugin:@typescript-eslint/eslint-recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:jsdoc/recommended",
    ),

    languageOptions: {
        parser: tsParser,
        ecmaVersion: 5,
        sourceType: "script",

        parserOptions: {
            project: ["./tsconfig.json"],
        },
    },

    rules: {
        "no-console": "off",
        "no-fallthrough": "off",

        "require-jsdoc": ["error", {
            require: {
                ClassDeclaration: true,
                MethodDefinition: true,
            },
        }],

        "valid-jsdoc": ["error", {
            requireReturn: false,
            requireReturnType: false,
            requireParamType: false,
        }],

        "block-scoped-var": ["error"],
        curly: ["error", "all"],
        "default-case": "off",
        eqeqeq: ["error"],
        "guard-for-in": ["error"],

        "new-cap": ["error", {
            capIsNew: false,
        }],

        "no-alert": ["error"],
        "no-bitwise": ["error"],
        "no-caller": ["error"],
        "no-catch-shadow": ["error"],
        "no-continue": ["error"],
        "no-debugger": ["error"],
        "no-eval": ["error"],
        "no-extend-native": ["error"],
        "no-extra-bind": ["error"],
        "no-iterator": ["error"],
        "no-labels": ["error"],
        "no-lone-blocks": ["error"],
        "no-lonely-if": ["error"],
        "no-new": ["error"],
        "no-param-reassign": ["error"],
        "no-proto": ["error"],
        "no-return-assign": ["error"],
        "no-self-compare": ["error"],
        "no-shadow-restricted-names": ["error"],
        "no-tabs": ["error"],
        "no-unmodified-loop-condition": ["error"],
        "no-useless-call": ["error"],
        "no-useless-escape": ["error"],
        "no-void": ["error"],
        "no-with": ["error"],

        "prefer-const": ["error", {
            destructuring: "all",
        }],

        radix: ["error"],
        "space-before-blocks": ["error", "always"],
        "vars-on-top": ["error"],
        "wrap-iife": ["error"],
        yoda: ["error"],
        "brace-style": "off",
        "@typescript-eslint/brace-style": "error",
        "comma-dangle": "off",
        "@typescript-eslint/comma-dangle": "error",
        "comma-spacing": "off",
        "@typescript-eslint/comma-spacing": "error",
        "default-param-last": "off",
        "@typescript-eslint/default-param-last": "error",
        "dot-notation": "off",
        "@typescript-eslint/dot-notation": "error",
        "func-call-spacing": "off",
        "@typescript-eslint/func-call-spacing": "error",
        indent: "off",
        "keyword-spacing": "off",
        "@typescript-eslint/keyword-spacing": "error",
        "lines-between-class-members": "off",
        "@typescript-eslint/lines-between-class-members": "error",
        "no-dupe-class-members": "off",
        "@typescript-eslint/no-dupe-class-members": "error",
        "no-duplicate-imports": "error",
        "no-loop-func": "off",
        "@typescript-eslint/no-loop-func": "error",
        "no-loss-of-precision": "off",
        "@typescript-eslint/no-loss-of-precision": "error",
        "no-magic-numbers": "off",

        "@typescript-eslint/no-magic-numbers": ["error", {
            ignoreArrayIndexes: true,
            ignore: [-1, 0, 1, 2, 10],
        }],

        "no-redeclare": "off",
        "@typescript-eslint/no-redeclare": "error",
        "no-shadow": "off",
        "@typescript-eslint/no-shadow": "error",
        "no-throw-literal": "off",
        "@typescript-eslint/no-throw-literal": "error",
        "no-unused-expressions": "off",
        "@typescript-eslint/no-unused-expressions": "error",
        "no-use-before-define": "off",
        "@typescript-eslint/no-use-before-define": "error",
        "no-useless-constructor": "off",
        "@typescript-eslint/no-useless-constructor": "error",
        "object-curly-spacing": "off",
        "@typescript-eslint/object-curly-spacing": ["error", "always"],
        quotes: "off",
        "@typescript-eslint/quotes": ["error", "single"],
        "return-await": "off",
        "@typescript-eslint/return-await": "error",
        semi: "off",
        "@typescript-eslint/semi": ["error", "always"],
        "space-before-function-paren": "off",

        "@typescript-eslint/space-before-function-paren": ["error", {
            anonymous: "always",
            named: "never",
        }],

        "space-infix-ops": "off",
        "@typescript-eslint/space-infix-ops": "error",
        "@typescript-eslint/member-delimiter-style": "error",
        "@typescript-eslint/consistent-type-assertions": "error",
        "@typescript-eslint/class-literal-property-style": "error",
        "@typescript-eslint/explicit-function-return-type": "error",
        "@typescript-eslint/explicit-member-accessibility": "error",
        "@typescript-eslint/no-base-to-string": "error",
        "@typescript-eslint/no-confusing-non-null-assertion": "error",
        "@typescript-eslint/no-dynamic-delete": "error",
        "@typescript-eslint/no-require-imports": "error",
        "@typescript-eslint/no-unnecessary-boolean-literal-compare": "error",
        "@typescript-eslint/no-unnecessary-qualifier": "error",
        "@typescript-eslint/no-unnecessary-type-constraint": "error",
        "@typescript-eslint/no-unsafe-argument": "error",
        "@typescript-eslint/prefer-for-of": "error",
        "@typescript-eslint/prefer-function-type": "error",
        "@typescript-eslint/prefer-includes": "error",
        "@typescript-eslint/prefer-literal-enum-member": "error",
        "@typescript-eslint/prefer-nullish-coalescing": "error",
        "@typescript-eslint/prefer-optional-chain": "error",
        "@typescript-eslint/prefer-readonly": "error",
        "@typescript-eslint/prefer-reduce-type-parameter": "error",
        "@typescript-eslint/prefer-return-this-type": "error",
        "@typescript-eslint/prefer-string-starts-ends-with": "error",
        "@typescript-eslint/prefer-ts-expect-error": "error",

        "@typescript-eslint/require-array-sort-compare": ["error", {
            ignoreStringArrays: true,
        }],

        "@typescript-eslint/switch-exhaustiveness-check": "error",
        "@typescript-eslint/type-annotation-spacing": "error",
        "@typescript-eslint/typedef": ["error"],
        "@typescript-eslint/unified-signatures": "error",

        "@typescript-eslint/no-unused-vars": ["error", {
            args: "none",
        }],

        "@typescript-eslint/no-explicit-any": "error",

        "@typescript-eslint/no-inferrable-types": ["error", {
            ignoreParameters: true,
        }],

        "jsdoc/require-jsdoc": ["error", {
            contexts: [
                "TSMethodSignature",
                "TSInterfaceDeclaration",
                "TSTypeAliasDeclaration",
                "TSEnumDeclaration",
                "TSPropertySignature",
            ],
        }],

        "jsdoc/check-access": "error",
        "jsdoc/check-alignment": "error",
        "jsdoc/check-line-alignment": "error",
        "jsdoc/check-param-names": "error",
        "jsdoc/check-property-names": "error",
        "jsdoc/check-syntax": "error",
        "jsdoc/check-tag-names": "error",
        "jsdoc/check-types": "error",
        "jsdoc/check-values": "error",
        "jsdoc/empty-tags": "error",
        "jsdoc/implements-on-classes": "error",
        "jsdoc/no-bad-blocks": "error",
        "jsdoc/no-defaults": "error",
        "jsdoc/no-types": "error",
        "jsdoc/no-undefined-types": "error",
        "jsdoc/require-asterisk-prefix": "error",
        "jsdoc/require-description": "error",
        "jsdoc/require-hyphen-before-param-description": "error",
        "jsdoc/require-param": "error",
        "jsdoc/require-param-description": "error",
        "jsdoc/require-param-name": "error",
        "jsdoc/require-param-type": 0,
        "jsdoc/require-property": "error",
        "jsdoc/require-property-description": "error",
        "jsdoc/require-property-name": "error",
        "jsdoc/require-property-type": 0,
        "jsdoc/require-returns": "error",
        "jsdoc/require-returns-check": "error",
        "jsdoc/require-returns-description": "error",
        "jsdoc/require-returns-type": 0,
        "jsdoc/require-throws": "error",
        "jsdoc/require-yields": "error",
        "jsdoc/require-yields-check": "error",
        "jsdoc/valid-types": 1,
    },
}]);