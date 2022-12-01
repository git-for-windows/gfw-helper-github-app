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

// `reaction` can be one of `+1`, `-1`, `laugh`, `confused`, `heart`, `hooray`, `rocket`, `eyes`
const createReactionForIssueComment = async (context, token, owner, repo, comment_id, reaction) => {
    const answer = await sendGitHubAPIRequest(
        context,
        token,
        'POST',
        `/repos/${owner}/${repo}/issues/comments/${comment_id}/reactions`, {
            content: reaction
        }
    )
    return answer.id
}

module.exports = {
    addIssueComment,
    getIssue,
    getIssueComment,
    createReactionForIssueComment
}