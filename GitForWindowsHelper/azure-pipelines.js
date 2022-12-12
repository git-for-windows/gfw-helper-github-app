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

module.exports = {
    triggerAzurePipeline
}