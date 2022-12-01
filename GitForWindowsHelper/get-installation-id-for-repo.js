module.exports = async (context, owner, repo) => {
    const gitHubAPIRequestAsApp = require('./github-api-request-as-app')
    const answer = await gitHubAPIRequestAsApp(
        context,
        'GET',
        `/repos/${owner}/${repo}/installation`
    )
    if (answer.error) throw answer.error
    return answer.id
}