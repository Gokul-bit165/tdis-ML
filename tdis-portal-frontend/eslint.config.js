import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import sonarjs from 'eslint-plugin-sonarjs';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
  {
    ignores: [
      'dist',
      'coverage/**/*',
      'node_modules/**/*',
      'vitest.config.js',
      'vite.config.js',
      'public/keycloak.js',
    ],
  },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      sonarjs: sonarjs,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'off',
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
      'react-refresh/only-export-components': [
        'warn',
        {
          allowConstantExport: true,
          allowExportNames: ['buttonVariants', 'useSidebar', 'RIVERINE_SEVERITY_LEGEND'],
        },
      ],
      // --- SONARJS MAINTAINABILITY & COMPLEXITY ---
      'sonarjs/cognitive-complexity': ['warn', 15], // Standard threshold is 15
      'sonarjs/max-switch-cases': ['warn', 10], // Prevents massive switch blocks
      'sonarjs/no-collapsible-if': 'warn', // Suggests merging nested IFs
      'sonarjs/no-duplicate-string': ['warn', { threshold: 3 }], // Magic strings check

      // --- SONARJS BUG PREVENTION ---
      'sonarjs/no-all-duplicated-branches': 'error', // Logic error: all paths do the same thing
      'sonarjs/no-identical-expressions': 'error', // Logic error: (a === a)
      'sonarjs/no-redundant-boolean': 'warn', // Simplifies if (x === true)
      'sonarjs/no-unused-collection': 'error', // Catch arrays/objects created but never used
      'sonarjs/no-element-overwrite': 'error', // Catch accidental variable overwriting
      'sonarjs/non-number-in-arithmetic-expression': 'error', // Catch NaN bugs early

      // --- SONARJS REACT-SPECIFIC / CLEANUP ---
      'sonarjs/no-identical-functions': 'warn', // Suggests refactoring repetitive logic
      'sonarjs/prefer-immediate-return': 'warn', // Cleaner function returns
      'sonarjs/no-inverted-boolean-check': 'warn', // Improves readability
    },
  },
  {
    files: ['tests/**/*.{js,jsx}', 'src/**/*.{test,spec}.{js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.vitest,
      },
    },
    rules: {
      // Assertions repeat UI copy and fixtures by design.
      'sonarjs/no-duplicate-string': 'off',
    },
  },
  // Map/UI orchestration modules — keep other lint rules; silence complexity until refactored.
  {
    files: [
      'src/hooks/useHMEDHexInteractions.js',
      'src/services/threadService.js',
      'src/services/streamingMapAccumulator.js',
      'src/services/parseOrchestratorResponse.js',
      'src/services/mapChatHistoryToTurns.js',
      'src/components/hmed/LtsFlashFloodMobilePanel.jsx',
      'src/components/hmed/HMEDInfoModal.jsx',
      'src/components/hmed/FloodHubPrdSidePanel.jsx',
      'src/components/ai-assistant/ThreadList.jsx',
      'src/components/ai-assistant/AIAssistantMessage.jsx',
      'src/components/ai-assistant/AIAssistantMap.jsx',
      'src/components/TabNavigation.jsx',
      'src/components/AIAssistantTab.jsx',
    ],
    rules: {
      'sonarjs/cognitive-complexity': 'off',
    },
  },
  eslintConfigPrettier,
];
