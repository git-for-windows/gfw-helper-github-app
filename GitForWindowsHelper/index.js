const validateGitHubWebHook = require('./validate-github-webhook')

module.exports = async function (context, req) {
    const withStatus = (status, headers, body) => {
        context.res = {
            status,
            headers,
            body
        }
    }

    const ok = (body) => {
        withStatus(undefined, undefined, body)
    }

    try {
        validateGitHubWebHook(context)
    } catch (e) {
        context.log(e)
        return withStatus(403, undefined, `Go away, you are not a valid GitHub webhook: ${e}`)
    }

    try {
        const slashCommand = require('./slash-commands')
        if (req.headers['x-github-event'] === 'issue_comment'
            && req.body.action === 'created'
            && req.body.comment?.body
            && req.body.comment.body.startsWith('/')) return ok(await slashCommand(context, req))
    } catch (e) {
        context.log(e)
        return withStatus(500, undefined, e.toString('utf-8'))
    }

    try {
        const selfHostedARM64Runners = require('./self-hosted-arm64-runners')
        if (req.headers['x-github-event'] === 'workflow_job'
            && req.body.repository.full_name === 'git-for-windows/git-for-windows-automation'
            && ['queued', 'completed'].includes(req.body.action)
            && req.body.workflow_job.labels.length === 2
            && req.body.workflow_job.labels[0] === 'Windows'
            && req.body.workflow_job.labels[1] === 'ARM64') return ok(await selfHostedARM64Runners(context, req))
    } catch (e) {
        context.log(e)
        return withStatus(500, undefined, e.toString('utf-8'))
    }

    try {
        const cascadingRuns = require('./cascading-runs.js')
        if (req.headers['x-github-event'] === 'check_run'
            && req.body.repository.full_name === 'git-for-windows/git'
            && req.body.action === 'completed') return ok(await cascadingRuns(context, req))
    } catch (e) {
        context.log(e)
        return withStatus(500, undefined, e.toString('utf-8'))
    }

    context.log("Got headers")
    context.log(req.headers)
    context.log("Got body")
    context.log(req.body)

    ok(`Received event ${req.headers["x-github-event"]}`)
}
