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

const getGitArtifactsCommentID = async (context, token, owner, repo, headSHA) => {
    const answer = await sendGitHubAPIRequest(context, token, 'GET', `/search/issues?q=repo:${owner}/${repo}+${headSHA}+type:pr+%22git-artifacts%22`, null, {
        Accept: 'application/vnd.github.text-match+json'
    })
    const items = answer.items.filter(item =>
        item.text_matches.length === 1
        && item.text_matches[0].fragment.trim() === '/git-artifacts\n\nThe tag-git workflow run was started'
    )
    return items.length === 1 && items[0].text_matches[0].object_url.replace(/^.*\/(\d+)$/, '$1')
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

const getPRCommitSHA = async (context, token, owner, repo, pullRequestNumber) => {
    const answer = await sendGitHubAPIRequest(
        context,
        token,
        'GET',
        `/repos/${owner}/${repo}/pulls/${pullRequestNumber}`
    )
    return answer.head.sha
}

module.exports = {
    addIssueComment,
    getIssue,
    getGitArtifactsCommentID,
    getIssueComment,
    appendToIssueComment,
    createReactionForIssueComment,
    getPRCommitSHA
}