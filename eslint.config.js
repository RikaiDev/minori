import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      // TypeScript handles these
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],

      // Allow explicit any in some cases, but warn
      '@typescript-eslint/no-explicit-any': 'warn',

      // Consistency
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],

      // Allow empty functions for handlers
      '@typescript-eslint/no-empty-function': 'off',
    },
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.turbo/**',
      'coverage/**',
      '*.config.js',
      '*.config.ts',
    ],
  }
);
