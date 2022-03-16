module.exports = {
    'extends': 'eslint:recommended',
    'rules': {
        'arrow-parens': 'error',
        'brace-style': 'error',
        'comma-dangle': ['warn', 'always-multiline'],
        'comma-spacing': 'warn',
        'curly': 'error',
        'eol-last': 'error',
        'eqeqeq': ['error', 'smart'],
        'indent': [
            'error',
            4,
            {
                'FunctionExpression': { 'parameters': 'first' },
                'CallExpression': { 'arguments': 'first' },
            },
        ],
        'keyword-spacing': 'warn',
        'linebreak-style': ['error', 'unix'],
        'no-console': 'off',
        'no-trailing-spaces': 'error',
        'no-unused-vars': [
            'error',
            { 'args': 'none', 'varsIgnorePattern': '^_+$' },
        ],
        'prefer-template': 'error',
        'quotes': [
            'error',
            'single',
            {
                'avoidEscape': true,
                'allowTemplateLiterals': true,
            },
        ],
        'semi': [
            'error',
            'always',
        ],
        'space-before-blocks': 'error',
        'space-infix-ops': 'error',
    },
    'env': {
        'es6': true,
        'node': true,
    },
    'parserOptions': {
        'ecmaVersion': 2020,
        'sourceType': 'module',
    },
};
