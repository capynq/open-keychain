import { defineConfig } from 'eslint/config';
import eslint from '@eslint/js';
import i18next from 'eslint-plugin-i18next';
import noBarrelFiles from 'eslint-plugin-no-barrel-files';
import perfectionist from 'eslint-plugin-perfectionist';
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
    plugins: {
      'react-refresh': reactRefresh,
      i18next,
      'no-barrel-files': noBarrelFiles,
      perfectionist,
    },
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
      'no-barrel-files/no-barrel-files': [
        'error',
        {
          allow: [
            // Existing entry points are temporary compatibility APIs; additions must be direct files.
            'src/app/App/index.ts',
            'src/app/components/AccountPopover/index.ts',
            'src/app/components/AnalyticsConsentBanner/index.ts',
            'src/app/components/AppHeader/index.ts',
            'src/app/components/BrandMark/index.ts',
            'src/app/components/CustomizerFooter/index.ts',
            'src/app/components/CustomizerNavigationHeader/index.ts',
            'src/app/components/CustomizerWorkspace/index.ts',
            'src/app/components/IconButton/index.ts',
            'src/app/components/LandingNavigationHeader/index.ts',
            'src/app/components/LanguagePicker/index.ts',
            'src/app/components/PreviewPanel/index.ts',
            'src/app/components/RouteLoading/index.ts',
            'src/app/components/Toast/index.ts',
            'src/app/components/index.ts',
            'src/app/components/landing/ConfiguratorShowcase/index.ts',
            'src/app/components/landing/LandingFaq/index.ts',
            'src/app/components/landing/LandingFooter/index.ts',
            'src/app/components/landing/LandingHero/index.ts',
            'src/app/components/landing/LandingRunModes/index.ts',
            'src/app/components/landing/LandingSectionHeading/index.ts',
            'src/app/components/landing/LandingTemplates/index.ts',
            'src/app/components/landing/LandingTrust/index.ts',
            'src/app/components/landing/LandingWorkflow/index.ts',
            'src/app/components/landing/RunModeCard/index.ts',
            'src/app/components/landing/TemplatePreviewCard/index.ts',
            'src/app/components/landing/index.ts',
            'src/app/hooks/index.ts',
            'src/app/index.ts',
            'src/app/seo/index.ts',
            'src/domain/keychain/index.ts',
            'src/entities/keychain/build/index.ts',
            'src/entities/keychain/fonts/index.ts',
            'src/entities/keychain/geometry/index.ts',
            'src/entities/keychain/index.ts',
            'src/entities/keychain/model/index.ts',
            'src/entities/keychain/styles/index.ts',
            'src/entities/keychain/templates/index.ts',
            'src/features/customizer/components/ControlsPanel/index.ts',
            'src/features/customizer/components/DesignCardRail/index.ts',
            'src/features/customizer/components/DesignSelectCard/index.ts',
            'src/features/customizer/components/InfoBlock/index.ts',
            'src/features/customizer/components/RangeControl/index.ts',
            'src/features/customizer/components/index.ts',
            'src/features/customizer/hooks/index.ts',
            'src/features/customizer/index.ts',
            'src/features/customizer/model/index.ts',
            'src/features/export/components/ExportDialog/index.ts',
            'src/features/export/components/index.ts',
            'src/features/export/index.ts',
            'src/features/export/model/index.ts',
            'src/features/hosted/api/index.ts',
            'src/features/hosted/hooks/index.ts',
            'src/features/hosted/index.ts',
            'src/features/index.ts',
            'src/features/preview/camera/index.ts',
            'src/features/preview/components/Viewer/index.ts',
            'src/features/preview/components/index.ts',
            'src/features/preview/index.ts',
            'src/features/preview/model/index.ts',
            'src/features/seo/index.ts',
            'src/features/seo/model/index.ts',
            'src/features/share/index.ts',
            'src/features/share/model/index.ts',
            'src/infrastructure/export/index.ts',
            'src/infrastructure/geometry/index.ts',
            'src/infrastructure/i18n/index.ts',
            'src/infrastructure/index.ts',
            'src/infrastructure/seo/index.ts',
            'src/infrastructure/telemetry/TelemetryProvider/index.ts',
            'src/infrastructure/telemetry/index.ts',
            'src/shared/index.ts',
            'src/shared/lib/index.ts',
            'src/shared/ui/index.ts',
            'src/infrastructure/geometry/manifold-types.ts',
            'src/infrastructure/i18n/config.ts',
            'src/infrastructure/i18n/utils.ts',
            'src/app/components/IconButton/IconButton.tsx',
            'src/app/components/landing/content.ts',
            'src/features/seo/catalog.ts',
          ],
        },
      ],
      'perfectionist/sort-imports': [
        'error',
        {
          type: 'alphabetical',
          order: 'asc',
          fallbackSort: { type: 'unsorted' },
          ignoreCase: true,
          specialCharacters: 'keep',
          sortBy: 'path',
          internalPattern: ['^@/.+'],
          partitionByComment: false,
          partitionByNewLine: false,
          newlinesBetween: 1,
          newlinesInside: 0,
          groups: [
            'type-import',
            ['value-builtin', 'value-external'],
            'type-internal',
            'value-internal',
            ['type-parent', 'type-sibling', 'type-index'],
            ['value-parent', 'value-sibling', 'value-index'],
            'ts-equals-import',
            'unknown',
          ],
          customGroups: [],
          environment: 'node',
          useExperimentalDependencyDetection: true,
        },
      ],
    },
  },
  {
    files: ['src/pages/seo/**/*.{ts,tsx}'],
    rules: {
      'no-barrel-files/prefer-source-imports': [
        'error',
        {
          fixStyle: 'preserve-alias',
          ignore: ['@/features/seo', '@/infrastructure/i18n'],
        },
      ],
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
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/app/**', '@/pages/**', '**/app/**'],
              message: 'Features cannot depend on app or page implementations.',
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
]);
