const js = require("@eslint/js")
const jest = require("eslint-plugin-jest")
const globals = require("globals")

module.exports = [
    js.configs.recommended,
    {
        plugins: {
            jest: jest
        },
        languageOptions: {
            ecmaVersion: 12,
            sourceType: "module",
            globals: {
                ...globals.node,
                ...globals.es6,
                ...globals.jest
            }
        },
        rules: {
            indent: ["error", 4],
            "no-trailing-spaces": "error"
        }
    }
]
