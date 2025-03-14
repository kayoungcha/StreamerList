module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["./tsconfig.json", "./tsconfig.dev.json"], // ✅ `tsconfig.dev.json` 추가
    sourceType: "module",
  },
  ignorePatterns: ["/lib/**"], // ✅ ESLint에서 `lib` 폴더 무시
  env: {
    node: true,
  },
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  plugins: ["@typescript-eslint"],
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
  },
};
