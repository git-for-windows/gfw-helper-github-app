const { activeOrg } = require('./org')

module.exports = async (context, req) => {
    if (req.body.action !== 'completed') return "Nothing to do here: workflow run did not complete yet"
    if (req.body.workflow_run.conclusion !== 'success') return "Nothing to do here: workflow run did not succeed"

    const releaseWorkflowRunID = req.body.workflow_run.id
    const owner = activeOrg
    const repo = 'git'
    const sender = req.body.sender.login

    const getToken = (() => {
        let token

        const get = async () => {
            const getInstallationIdForRepo = require('./get-installation-id-for-repo')
            const installationId = await getInstallationIdForRepo(context, owner, repo)
            const getInstallationAccessToken = require('./get-installation-access-token')
            return await getInstallationAccessToken(context, installationId)
        }

        return async () => token || (token = await get())
    })()

    const isAllowed = async (login) => {
        if (login === 'gitforwindowshelper[bot]') return true
        const getCollaboratorPermissions = require('./get-collaborator-permissions')
        const token = await getToken()
        const permission = await getCollaboratorPermissions(context, token, owner, repo, login)
        return ['ADMIN', 'MAINTAIN', 'WRITE'].includes(permission.toString())
    }

    if (!await isAllowed(sender)) throw new Error(`${sender} is not allowed to do that`)

    const { searchIssues } = require('./search')
    const items = await searchIssues(context, `org:${activeOrg} is:pr is:open in:comments "The release-git workflow run was started"`)

    const githubApiRequest = require('./github-api-request')

    const needle = `The \`release-git\` workflow run [was started](https://github.com/${activeOrg}/git-for-windows-automation/actions/runs/${releaseWorkflowRunID})`
    const candidates = []
    for (const item of items) {
        if (!['OWNER', 'MEMBER'].includes(item.author_association)) continue
        for (const match of item.text_matches) {
            const commentURL = match.object_url
            if (!commentURL.startsWith('https://api.github.com/')) continue
            const data = await githubApiRequest(context, await getToken(), 'GET', commentURL.substring(22))
            if (data.body.indexOf(needle) >=0) candidates.push(item)
        }
    }

    if (candidates.length !== 1) throw new Error(`Expected 1 candidate PR, got ${candidates.length}`)

    const prNumber = candidates[0].number
    const pr = await githubApiRequest(context, await getToken(), 'GET', `/repos/${owner}/${repo}/pulls/${prNumber}`)
    const sha = pr.head.sha

    await githubApiRequest(context, await getToken(), 'PATCH', `/repos/${owner}/${repo}/git/refs/heads/main`, {
        sha,
        force: false // require fast-forward
    })

    return `Took care of pushing the \`main\` branch to close PR ${prNumber}`
}
