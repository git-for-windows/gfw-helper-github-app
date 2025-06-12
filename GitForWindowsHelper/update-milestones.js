const addIssueToCurrentMilestone= async (context, req) => {
    if (req.body.action !== 'closed') return "Nothing to do here: PR has not been closed"
    if (req.body.pull_request.merged !== 'true') return "Nothing to do here: PR has been closed, but not by merging"

    const owner = 'git-for-windows'
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

    const githubApiRequest = require('./github-api-request')

    const candidates = req.body.pull_request.body.match(/(?:[Cc]loses|[Ff]ixes) (?:https:\/\/github\.com\/git-for-windows\/git\/issues\/|#)(\d+)/)

    if (candidates.length !== 1) throw new Error(`Expected 1 candidate issue, got ${candidates.length}`)

    const { getCurrentMilestone } = require('./GitForWindowsHelper/milestones')
    const current = await getCurrentMilestone(console, await getToken(), owner, repo)

    const issueNumber = candidates[0]
    const issue = await githubApiRequest(context, await getToken(), 'GET', `/repos/${owner}/${repo}/issues/${issueNumber}`)

    if (issue.labels.length>0){
        for (const label of issue.labels) {
            if (label.name === "component-update"){
                await githubApiRequest(context, await getToken(), 'PATCH', `/repos/${owner}/${repo}/issues/${issueNumber}`, {
                    milestone: current.id
                })

                return `Added issue ${issueNumber} to milestone "Next release"`
            }
        }
    }

    throw new Error(`Issue ${issueNumber} isn't a component update`)
}

const renameCurrentAndCreateNextMilestone = async (context, req) => {
    const gitVersionMatch = req.body.pull_request.title.match(/^Rebase to (v\d+\.\d+\.\d+)$/)
    if (!gitVersionMatch) throw new Error(`Not a new Git version: ${req.body.pull_request.title}`)
    const gitVersion = gitVersionMatch[1]

    const owner = 'git-for-windows'
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

    const { getCurrentMilestone, renameMilestone, openNextReleaseMilestone } = require('./milestones')
    const current = await getCurrentMilestone(console, await getToken(), owner, repo)
    await renameMilestone(context, await getToken(), owner, repo,current.id, gitVersion)
    await openNextReleaseMilestone(context, await getToken(), owner, repo)
}

module.exports = {
    addIssueToCurrentMilestone,
    renameCurrentAndCreateNextMilestone
}