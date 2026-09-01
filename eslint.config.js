import { defineConfig } from 'eslint/config';
import eslint from '@eslint/js';
import i18next from 'eslint-plugin-i18next';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default defineConfig([
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat['recommended-latest'],
  {
    files: ['src/**/*.{ts,tsx}', 'scripts/**/*.{ts,tsx}', 'e2e/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { 'react-refresh': reactRefresh, i18next },
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'func-style': ['error', 'expression', { allowArrowFunctions: true }],
      'prefer-arrow-callback': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-inferrable-types': 'error',
      'no-constant-binary-expression': 'error',
      'no-new-wrappers': 'error',
      'no-unreachable-loop': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'spaced-comment': ['error', 'always', { exceptions: ['-', '+'] }],
      curly: ['error', 'all'],
      'brace-style': ['error', '1tbs', { allowSingleLine: false }],
      'no-lonely-if': 'error',
      'no-else-return': ['error', { allowElseIf: false }],
      'i18next/no-literal-string': 'error',
    },
  },
  {
    files: ['src/entities/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/app/**', '@/features/**'],
              message: 'Entities cannot depend on app or feature layers.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/pages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/app/**', '../app/**', '../../app/**', '../../../app/**'],
              message:
                'Pages cannot import app implementations; use a legacy adapter during migration.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/app/**', '@/features/**', '@/entities/**'],
              message: 'Shared code cannot depend on upper layers.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['server/**/*.{ts,tsx}', 'scripts/**/*.{ts,tsx}'],
    rules: { 'no-console': 'off', 'max-lines-per-function': 'off' },
  },
  {
    files: [
      'src/app/App/**/*.{ts,tsx}',
      'src/app/seo/**/*.{ts,tsx}',
      'src/entities/**/*.{ts,tsx}',
      'src/features/share/**/*.{ts,tsx}',
      'src/pages/**/*.{ts,tsx}',
      'src/shared/**/*.{ts,tsx}',
    ],
    rules: {
      'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0 }],
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: 'return' },
        { blankLine: 'always', prev: 'block-like', next: '*' },
        { blankLine: 'always', prev: ['if', 'for', 'while', 'switch', 'try'], next: '*' },
        {
          blankLine: 'always',
          prev: ['const', 'let', 'var'],
          next: ['if', 'for', 'while', 'switch', 'try'],
        },
      ],
      'lines-between-class-members': ['error', 'always', { exceptAfterSingleLine: true }],
      'max-lines-per-function': [
        'error',
        { max: 120, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
    },
  },
  {
    files: ['src/app/seo/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': [
        'error',
        {
          allowConstantExport: true,
          allowExportNames: ['useAppSeo', 'detectInitialLocale', 'localeFromSearch'],
        },
      ],
    },
  },
  prettier,
  {
    files: [
      'src/app/**/*.{ts,tsx}',
      'src/features/customizer/hooks/**/*.{ts,tsx}',
      'src/features/export/model/**/*.{ts,tsx}',
      'src/features/hosted/hooks/**/*.{ts,tsx}',
      'src/features/preview/components/**/*.{ts,tsx}',
    ],
    rules: {
      'padding-line-between-statements': [
        'error',
        {
          blankLine: 'always',
          prev: ['const', 'let', 'var'],
          next: ['expression', 'return'],
        },
      ],
    },
  },
  {
    files: ['src/app/pages/LandingPage/**/*.{ts,tsx}'],
    rules: {
      'padding-line-between-statements': 'off',
    },
  },
]);
