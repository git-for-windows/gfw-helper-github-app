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

    const { httpsRequest } = require('./https-request')
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
    if ('true' === process.env.DO_NOT_TRIGGER_ANYTHING) {
        throw new Error(`Would have triggered GitArtifacts for PR ${prNumber}`)
    }
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

const listReleases = async (context, token, organization, project) => {
    const auth = Buffer.from('PAT:' + token).toString('base64')
    const headers = {
        'Accept': 'application/json; api-version=7.0; excludeUrls=true',
        'Authorization': 'Basic ' + auth,
    }

    const { httpsRequest } = require('./https-request')
    return await httpsRequest(
        context,
        'vsrm.dev.azure.com',
        'GET',
        `/${organization}/${project}/_apis/release/releases`,
        undefined,
        headers
    )
}

const getRelease = async (context, token, organization, project, releaseId) => {
    const auth = Buffer.from('PAT:' + token).toString('base64')
    const headers = {
        'Accept': 'application/json; api-version=7.0; excludeUrls=true',
        'Authorization': 'Basic ' + auth,
    }

    const { httpsRequest } = require('./https-request')
    return await httpsRequest(
        context,
        'vsrm.dev.azure.com',
        'GET',
        `/${organization}/${project}/_apis/release/releases/${releaseId}`,
        undefined,
        headers
    )
}

const createRelease = async (
    context,
    token,
    organization,
    project,
    releaseDefinitionId,
    artifactAlias,
    artifactBuildRunId,
    artifactBuildRunName,
    artifactBuildDefinitionId,
    artifactBuildDefinitionName,
    sourceBranch,
    sourceCommitId,
    repo
) => {
    const auth = Buffer.from("PAT:" + token).toString("base64");
    const headers = {
        Accept: "application/json; api-version=7.0; excludeUrls=true",
        Authorization: "Basic " + auth,
    };
    const body = {
        definitionId: releaseDefinitionId,
        isDraft: false,
        description: "",
        artifacts: [
            {
                alias: artifactAlias,
                instanceReference: {
                    id: artifactBuildRunId,
                    name: artifactBuildRunName,
                    definitionId: artifactBuildDefinitionId,
                    definitionName: artifactBuildDefinitionName,
                    sourceBranch,
                    sourceVersion: sourceCommitId,
                    sourceRepositoryId: repo,
                    sourceRepositoryType: "GitHub",
                },
            },
        ],
        properties: { ReleaseCreationSource: "GitForWindowsHelper" },
    }

    const { httpsRequest } = require('./https-request')
    return await httpsRequest(
        context,
        'vsrm.dev.azure.com',
        'POST',
        `/${organization}/${project}/_apis/release/releases`,
        body,
        headers
    )
}

const releaseGitArtifacts = async (context, prNumber) => {
    if ('true' === process.env.DO_NOT_TRIGGER_ANYTHING) {
        throw new Error(`Would have triggered release for PR ${prNumber}`)
    }
    const githubApiRequest = require('./github-api-request')
    const answer = await githubApiRequest(
        context,
        null,
        'GET',
        `/repos/git-for-windows/git/pulls/${prNumber}`
    )

    const sourceBranch = `refs/pull/${prNumber}/head`
    const sourceCommitId = answer.head.sha

    const { check_runs } = await githubApiRequest(
        context,
        null,
        'GET',
        `/repos/git-for-windows/git/commits/${sourceCommitId}/check-runs`
    )
    const artifactBuildDefinitionName = 'Git artifacts'
    const gitArtifactsRun = check_runs.filter(e => e.name === artifactBuildDefinitionName)
    if (gitArtifactsRun.length !== 1) throw new Error(`Expected one run, got ${JSON.stringify(gitArtifactsRun, null, 2)}`)
    const [artifactBuildDefinitionId, artifactBuildRunId] = gitArtifactsRun[0].external_id.split('|')
    const [artifactBuildRunName] = gitArtifactsRun[0].output.title.match(/v\d+(?:\.\d+)*\.windows\.\d+/)

    const token = process.env['AZURE_PIPELINE_TRIGGER_TOKEN']
    const answer2 = await createRelease(
        context,
        token,
        'git-for-windows',
        'git',
        1,
        'artifacts',
        artifactBuildRunId,
        artifactBuildRunName,
        artifactBuildDefinitionId,
        artifactBuildDefinitionName,
        sourceBranch,
        sourceCommitId,
        'git-for-windows/git'
    )
    return {
        id: answer2.id,
        url: answer2._links.web.href
    }
}

module.exports = {
    triggerAzurePipeline,
    triggerGitArtifacts,
    listReleases,
    getRelease,
    createRelease,
    releaseGitArtifacts
}