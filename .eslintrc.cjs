/* eslint-env node */
module.exports = {
    root: true,
    env: { node: true, es2021: true },
    parser: "@typescript-eslint/parser",
    parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname,
        ecmaVersion: 2021,
        sourceType: "module",
    },
    plugins: ["@typescript-eslint"],
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "prettier",
        // or, if you installed eslint-plugin-prettier:
        // "plugin:prettier/recommended"
    ],
    ignorePatterns: ["dist/", "node_modules/"],
    rules: {
        // turn off unsafe‐member‐access until you add proper types:
        "@typescript-eslint/no-unsafe-member-access": "off",
    },
};
