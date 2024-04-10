module.exports = (fn, fallback) => {
    try {
        return fn()
    } catch {
        return fallback
    }
}
