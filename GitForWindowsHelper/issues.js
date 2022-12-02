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
    return {
        id: answer.id,
        html_url: answer.html_url
    }
}

const getIssueComment = async (context, token, owner, repo, comment_id) => {
    return await sendGitHubAPIRequest(context, token, 'GET', `/repos/${owner}/${repo}/issues/comments/${comment_id}`)
}

const appendToIssueComment = async (context, token, owner, repo, comment_id, append) => {
    const data = await getIssueComment(context, token, owner, repo, comment_id)
    const answer = await sendGitHubAPIRequest(
        context,
        token,
        'PATCH',
        `/repos/${owner}/${repo}/issues/comments/${comment_id}`, {
            body: `${data.body}${data.body.endsWith('\n\n') ? '' : '\n\n'}${append}`
        }
    )
    return {
        id: answer.id,
        html_url: answer.html_url
    }
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
    appendToIssueComment,
    createReactionForIssueComment
}