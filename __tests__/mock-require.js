import { afterAll } from 'vitest'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

export const createMockRequire = () => {
    const require = createRequire(import.meta.url)
    const directory = fileURLToPath(
        new URL('../GitForWindowsHelper/', import.meta.url)
    )
    const originals = new Map()
    for (const [id, module] of Object.entries(require.cache)) {
        if (id.startsWith(directory)) {
            originals.set(id, module)
            delete require.cache[id]
        }
    }

    afterAll(() => {
        for (const id of Object.keys(require.cache)) {
            if (id.startsWith(directory)) delete require.cache[id]
        }
        for (const [id, module] of originals) require.cache[id] = module
    })

    const mockRequire = (path, exports) => {
        const id = require.resolve(path)
        require.cache[id] = { exports, loaded: true }
    }
    return { require, mockRequire }
}
