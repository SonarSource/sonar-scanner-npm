const { defineConfig, globalIgnores } = require('eslint/config');

const tsParser = require('@typescript-eslint/parser');
const notice = require('eslint-plugin-notice');

module.exports = defineConfig([
  {
    files: ['**/*.ts', '**/*.js'],
    languageOptions: {
      parser: tsParser,
    },

    plugins: {
      notice,
    },

    rules: {
      'notice/notice': [
        'error',
        {
          templateFile: 'license-header.txt',
          onNonMatchingHeader: 'replace',
        },
      ],
    },
  },
  globalIgnores(['**/dist', '**/build', 'eslint.config.js', '**/fixtures']),
]);
