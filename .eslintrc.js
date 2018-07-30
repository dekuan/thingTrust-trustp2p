module.exports = {
    "env": {
        "browser": true,
        "es6": true
    },
    "extends": "airbnb-base",
    "parserOptions": {
        "ecmaVersion": 2015,
        "sourceType": "module"
    },
    "rules": {
        "indent": ["warn", 4],
        "linebreak-style": ["error", "unix"],
        "quotes": ["error", "single"],
        "semi": ["warn", "never"],
        "no-param-reassign": ["off", "unix"],
        "import/no-dynamic-require": 0,
        "global-require": 0,
        "no-use-before-define": ["error", { "functions": false, "classes": false }],
        "no-plusplus": ["error", {"allowForLoopAfterthoughts": true}]
    }
};