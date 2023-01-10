const queueCheckRun = async (context, token, owner, repo, ref, checkRunName, title, summary) => {
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
        process.stderr.write(`Returning existing ${filtered[0].id}`)
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
    const githubApiRequest = require('./github-api-request')

    await githubApiRequest(
        context,
        token,
        'PATCH',
        `/repos/${owner}/${repo}/check-runs/${checkRunId}`,
        parameters
    )
}

module.exports = {
    queueCheckRun,
    updateCheckRun
}
