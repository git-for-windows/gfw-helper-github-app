const triggerAzurePipeline = async (context, token, organization, project, buildDefinitionId, sourceBranch, parameters) => {
    const auth = Buffer.from('PAT:' + token).toString('base64')
    const headers = {
        'Accept': 'application/json; api-version=5.0-preview.5; excludeUrls=true',
        'Authorization': 'Basic ' + auth,
    }
    const body = {
        'definition': { 'id': buildDefinitionId },
        'sourceBranch': sourceBranch,
        'parameters': JSON.stringify(parameters),
    }

    const httpsRequest = require('./https-request')
    return await httpsRequest(
        context,
        'dev.azure.com',
        'POST',
        `/${organization}/${project}/_apis/build/builds?ignoreWarnings=false&api-version=5.0-preview.5`,
        body,
        headers
    )
}

const triggerGitArtifacts = async (context, prNumber) => {
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
    const answer2 = await triggerAzurePipeline(context, token, 'git-for-windows', 'git', 34, sourceBranch, parameters)
    return {
        id: answer2.id,
        url: answer2._links.web.href
    }
}

module.exports = {
    triggerAzurePipeline,
    triggerGitArtifacts
}