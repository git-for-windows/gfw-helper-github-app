const queueCheckRun = async (context, token, owner, repo, ref, checkRunName, title, summary) => {
    if ('true' === process.env.DO_NOT_TRIGGER_ANYTHING) {
        throw new Error(`Would have queued Check Run ${checkRunName} in ${owner}/${repo} with ref ${ref}`)
    }
    const githubApiRequest = require('./github-api-request')
    // is there an existing check-run we can re-use?
    const { check_runs } = await githubApiRequest(
        context,
        token,
        'GET',
        `/repos/${owner}/${repo}/commits/${ref}/check-runs`
    )
    const filtered = check_runs
        .filter(e => e.name === checkRunName && e.conclusion === null).map(e => {
            return {
                id: e.id,
                status: e.status
            }
        })
    if (filtered.length > 0) {
        // ensure that the check_run is set to status "in progress"
        if (filtered[0].status !== 'queued') {
            console.log(await githubApiRequest(
                context,
                token,
                'PATCH',
                `/repos/${owner}/${repo}/check-runs/${filtered[0].id}`, {
                    status: 'queued'
                }
            ))
        }
        return filtered[0].id
    }

    const { id } = await githubApiRequest(
        context,
        token,
        'POST',
        `/repos/${owner}/${repo}/check-runs`, {
            name: checkRunName,
            head_sha: ref,
            status: 'queued',
            output: {
                title,
                summary
            }
        }
    )
    return id
}

const updateCheckRun = async (context, token, owner, repo, checkRunId, parameters) => {
    if ('true' === process.env.DO_NOT_TRIGGER_ANYTHING) {
        throw new Error(`Would have updated Check Run ${checkRunId} in ${owner}/${repo} with parameters ${JSON.stringify(parameters)}`)
    }
    const githubApiRequest = require('./github-api-request')

    await githubApiRequest(
        context,
        token,
        'PATCH',
        `/repos/${owner}/${repo}/check-runs/${checkRunId}`,
        parameters
    )
}

const cancelWorkflowRun = async (context, token, owner, repo, workflowRunId) => {
    if ('true' === process.env.DO_NOT_TRIGGER_ANYTHING) {
        throw new Error(`Would have canceled workflow run ${workflowRunId} in ${owner}/${repo}`)
    }
    const githubApiRequest = require('./github-api-request')

    const answer = await githubApiRequest(
        context,
        token,
        'POST',
        `/repos/${owner}/${repo}/actions/runs/${workflowRunId}/cancel`
    )
    console.log(answer)
}

const listCheckRunsForCommit = async (context, token, owner, repo, rev, checkRunName) => {
    const githubApiRequest = require('./github-api-request')

    const answer = await githubApiRequest(
        context,
        token,
        'GET',
        `/repos/${owner}/${repo}/commits/${rev}/check-runs?per_page=100${
            checkRunName ? `&check_name=${checkRunName}` : ''
        }`
    )
    return answer.check_runs
}

module.exports = {
    queueCheckRun,
    updateCheckRun,
    cancelWorkflowRun,
    listCheckRunsForCommit
}
