import StyleLintOrderRules from './stylelintrc-order-rules.mjs';

/** @type {import('stylelint').Config} */
export default {
    plugins: ['stylelint-order'],
    extends: ['stylelint-config-recommended-scss', 'stylelint-config-standard-scss', 'stylelint-config-css-modules'],
    rules: {
        'at-rule-no-unknown': null,
        'property-no-vendor-prefix': null,
        'scss/at-rule-no-unknown': true,
        'scss/at-import-no-partial-leading-underscore': null,
        'scss/dollar-variable-empty-line-before': null,
        'declaration-empty-line-before': null,
        'rule-empty-line-before': null,
        'at-rule-empty-line-before': null,
        'custom-property-empty-line-before': null,
        'keyframe-declaration-no-important': null,
        'scss/double-slash-comment-whitespace-inside': null,
        ...StyleLintOrderRules
    }
}