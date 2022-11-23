const sendGitHubAPIRequest = require('./github-api-request')

const getIssue = async (context, token, owner, repo, issue_number) => {
    return await sendGitHubAPIRequest(context, token, 'GET', `/repos/${owner}/${repo}/issues/${issue_number}`)
}

const addIssueComment = async (context, token, owner, repo, issue_number, comment) => {
    const answer = await sendGitHubAPIRequest(
        context,
        token,
        'POST',
        `/repos/${owner}/${repo}/issues/${issue_number}/comments`, {
            body: comment
        }
    )
    return answer.id
}

const getIssueComment = async (context, token, owner, repo, comment_id) => {
    return await sendGitHubAPIRequest(context, token, 'GET', `/repos/${owner}/${repo}/issues/comments/${comment_id}`)
}

module.exports = {
    addIssueComment,
    getIssue,
    getIssueComment
}