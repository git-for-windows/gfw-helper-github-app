module.exports = async (context, token, method, requestPath, payload, extraHeaders) => {
    const { httpsRequest } = require('./https-request')
    const headers = token
        ? { ...(extraHeaders || {}), Authorization: `Bearer ${token}` }
        : extraHeaders
    const answer = await httpsRequest(context, null, method, requestPath, payload, headers)
    if (answer.error) throw answer.error
    return answer
}