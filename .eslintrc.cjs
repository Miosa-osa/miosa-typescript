module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  env: {
    es2022: true,
    node: true,
  },
  rules: {
    "@typescript-eslint/ban-types": "off",
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "@typescript-eslint/no-var-requires": "off",
    "no-constant-condition": "off",
    "no-regex-spaces": "off",
  },
  overrides: [
    {
      files: ["**/*.test.ts", "**/*.spec.ts"],
      rules: {
        "@typescript-eslint/no-unused-vars": "off",
      },
    },
  ],
  ignorePatterns: ["dist", "coverage"],
};
