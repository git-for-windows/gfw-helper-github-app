const githubApiRequest = require('./github-api-request')
const githubApiRequestAsApp = require('./github-api-request-as-app')

const sleep = async (milliseconds) => {
    return new Promise((resolve) => {
        setTimeout(resolve, milliseconds)
    })
}

const getActorForToken = async (context, token) => {
    try {
        const { login } = await githubApiRequest(context, token, 'GET', '/user')
        return login
    } catch (e) {
        if (e.statusCode !== 403 || e.json?.message !== 'Resource not accessible by integration') throw e
        const answer = await githubApiRequestAsApp(context, 'GET', '/app')
        return `${answer.slug}[bot]`
    }
}

const waitForWorkflowRun = async (context, owner, repo, workflow_id, after, token, actor) => {
    if (!actor) actor = await getActorForToken(context, token)
    let counter = 0
    for (;;) {
        const res = await githubApiRequest(
            context,
            token,
            'GET',
            `/repos/${owner}/${repo}/actions/runs?actor=${actor}&event=workflow_dispatch&created>=${after}`
        )
        const filtered = res.workflow_runs.filter(e => e.path === `.github/workflows/${workflow_id}`)
        if (filtered.length > 0) return filtered
        if (counter++ > 30) throw new Error(`Times out waiting for workflow?`)
        await sleep(1000)
    }
}

const triggerWorkflowDispatch = async (context, token, owner, repo, workflow_id, ref, inputs) => {
    if ('true' === process.env.DO_NOT_TRIGGER_ANYTHING) {
        throw new Error(`Would have triggered workflow ${workflow_id} on ${owner}/${repo} with ref ${ref} and inputs ${JSON.stringify(inputs)}`)
    }
    const { headers: { date } } = await githubApiRequest(
        context,
        token,
        'POST',
        `/repos/${owner}/${repo}/actions/workflows/${workflow_id}/dispatches`,
        { ref, inputs }
    )

    const runs = await waitForWorkflowRun(context, owner, repo, workflow_id, new Date(date).toISOString(), token)
    return runs[0]
}

module.exports = triggerWorkflowDispatch