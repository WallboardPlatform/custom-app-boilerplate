const { positioning } = require('stylelint-config-clean-order/src/groups/positioning');
const { interaction } = require('stylelint-config-clean-order/src/groups/interaction');
const { layout } = require('stylelint-config-clean-order/src/groups/layout');
const { boxModel } = require('stylelint-config-clean-order/src/groups/box-model');
const { typography } = require('stylelint-config-clean-order/src/groups/typography');
const { appearance } = require('stylelint-config-clean-order/src/groups/appearance');
const { svgPresentation } = require('stylelint-config-clean-order/src/groups/svg-presentation');
const { transition } = require('stylelint-config-clean-order/src/groups/transition');

const propertyGroups = [
    ['composes'],
    ['all'],
    interaction,
    positioning,
    layout,
    boxModel,
    typography,
    appearance,
    svgPresentation,
    transition
];

const propertyOrder = propertyGroups.map((properties) => ({
    properties
}));

const StyleLintOrderRules = {
    'order/order': [
        [
            { type: 'at-rule', name: 'import' },
            { type: 'at-rule', name: 'forward' },
            { type: 'at-rule', name: 'use' },
            'dollar-variables',
            'at-variables',
            'custom-properties',
            { type: 'at-rule', name: 'custom-media' },
            { type: 'at-rule', name: 'function' },
            { type: 'at-rule', name: 'mixin' },
            { type: 'at-rule', name: 'extend' },
            { type: 'at-rule', name: 'include' },
            'declarations',
            {
                type: 'rule',
                selector: /^&::[\w-]+/,
                hasBlock: true
            },
            'rules',
            { type: 'at-rule', name: 'media', hasBlock: true }
        ],
        {
            severity: 'warning'
        }
    ],
    'order/properties-order': [
        propertyOrder,
        {
            severity: 'warning',
            unspecified: 'bottomAlphabetical'
        }
    ]
};

export default StyleLintOrderRules;