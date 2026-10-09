const js = require("@eslint/js")
const globals = require("globals")

module.exports = [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 12,
            sourceType: "module",
            globals: {
                ...globals.node,
                ...globals.es6
            }
        },
        rules: {
            indent: ["error", 4],
            "no-trailing-spaces": "error"
        }
    }
]
