const searchIssues = async (context, searchTerms) => {
    const httpsRequest = require('./https-request');
    const answer = await httpsRequest(
        context,
        'api.github.com',
        'GET',
        `/search/issues?q=${encodeURIComponent(searchTerms)}`,
        null, {
            Accept: 'application/vnd.github.text-match+json'
        }
    )
    if (answer.error) throw new Error(answer.error)
    if (!answer.items) throw new Error(`Unexpected answer:\n${JSON.stringify(answer, null, 2)}`)
    return answer.items
}

module.exports = {
    searchIssues
}