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

    const slashCommand = require('./slash-commands')
    if (req.headers['x-github-event'] === 'issue_comment'
        && req.body.action === 'created'
        && req.body.comment?.body
        && req.body.comment.body.startsWith('/')) return ok(await slashCommand(context, req))

    context.log("Got headers")
    context.log(req.headers)
    context.log("Got body")
    context.log(req.body)

    ok(`Received event ${req.headers["x-github-event"]}`)
}
