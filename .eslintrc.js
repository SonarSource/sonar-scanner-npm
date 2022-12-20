// eslint-disable-next-line notice/notice
module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['notice'],
  rules: {
    // notice
    'notice/notice': ['error', { templateFile: 'scripts/file-header.ts' }],
  },
};
