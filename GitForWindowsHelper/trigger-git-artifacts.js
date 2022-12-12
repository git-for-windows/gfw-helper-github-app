module.exports = async (context, prNumber) => {
    const githubApiRequest = require('./github-api-request')
    const answer = await githubApiRequest(
        context,
        null,
        'GET',
        `/repos/git-for-windows/git/pulls/${prNumber}`
    )
    const sourceBranch = `refs/pull/${prNumber}/head`
    const useBranch = `${answer.head.ref}@https://github.com/${answer.head.repo.full_name}`
    const parameters = {
        "use.branch": useBranch
    }
    const token = process.env['AZURE_PIPELINE_TRIGGER_TOKEN']
    const { triggerAzurePipeline } = require('./azure-pipelines')
    const answer2 = await triggerAzurePipeline(context, token, 'git-for-windows', 'git', 34, sourceBranch, parameters)
    return {
        id: answer2.id,
        url: answer2._links.web.href
    }
}