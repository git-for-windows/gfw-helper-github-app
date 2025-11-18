const validateGitHubWebHook = require('./validate-github-webhook')

module.exports = async function (context, req) {
    const withStatus = (status, headers, body) => {
        if (typeof body === 'object') try {
            body = JSON.stringify(null, 2)
        } catch (e) {
            context.log(e)
        }
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
        return withStatus(500, undefined, e.message || JSON.stringify(e, null, 2))
    }

    try {
        const selfHostedARM64Runners = require('./self-hosted-arm64-runners')
        if (req.headers['x-github-event'] === 'workflow_job'
            && ['git-for-windows/git-for-windows-automation', 'git-for-windows/git-sdk-arm64'].includes(req.body.repository.full_name)
            && ['queued', 'completed'].includes(req.body.action)
            && req.body.workflow_job.labels.length === 2
            && req.body.workflow_job.labels[0] === 'Windows'
            && req.body.workflow_job.labels[1] === 'ARM64') return ok(await selfHostedARM64Runners(context, req))
    } catch (e) {
        context.log(e)
        return withStatus(500, undefined, e.message || JSON.stringify(e, null, 2))
    }

    try {
        const finalizeGitForWindowsRelease = require('./finalize-g4w-release')
        if (req.headers['x-github-event'] === 'workflow_run'
            && req.body.workflow_run?.event === 'workflow_dispatch'
            && req.body.workflow_run?.head_branch === 'main'
            && req.body.repository.full_name === 'git-for-windows/git-for-windows-automation'
            && req.body.action === 'completed'
            && req.body.workflow_run.path === '.github/workflows/release-git.yml'
            && req.body.workflow_run.conclusion === 'success') return ok(await finalizeGitForWindowsRelease(context, req))
    } catch (e) {
        context.log(e)
        return withStatus(500, undefined, e.message || JSON.stringify(e, null, 2))
    }

    try {
        const { cascadingRuns, handlePush } = require('./cascading-runs.js')
        if (req.headers['x-github-event'] === 'check_run'
            && req.body.repository.full_name === 'git-for-windows/git'
            && req.body.action === 'completed') return ok(await cascadingRuns(context, req))

        if (req.headers['x-github-event'] === 'push'
            && req.body.repository.full_name === 'git-for-windows/git') return ok(await handlePush(context, req))
    } catch (e) {
        context.log(e)
        return withStatus(500, undefined, e.message || JSON.stringify(e, null, 2))
    }

    context.log("Got headers")
    context.log(req.headers)
    context.log("Got body")
    context.log(req.body)

    ok(`Received event ${req.headers["x-github-event"]}`)
}
