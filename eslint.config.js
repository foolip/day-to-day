'use strict';

const js = require('@eslint/js');
const google = require('eslint-config-google');
const globals = require('globals');

// These rules were removed in ESLint 9.
const googleRules = Object.assign({}, google.rules);
delete googleRules['valid-jsdoc'];
delete googleRules['require-jsdoc'];

module.exports = [
  {
    ignores: ['out/'],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2017,
      sourceType: 'script',
      globals: Object.assign({}, globals.browser, globals.node),
    },
    rules: Object.assign({}, googleRules, {
      'no-console': 'off',
    }),
  },
];
