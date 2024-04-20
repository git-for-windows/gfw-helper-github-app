const { activeOrg } = require('./org')

module.exports = async (context, req) => {
    const action = req.body.action
    const owner = req.body.repository.owner.login
    const repo = req.body.repository.name
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

    if (!await isAllowed(sender)) {
        if (action !== 'completed') {
            // Cancel workflow run
            const { cancelWorkflowRun } = require('./check-runs')
            const token = await getToken()
            const workflowRunId = req.body.workflow_job.run_id
            await cancelWorkflowRun(context, token, owner, repo, workflowRunId)
        }
        throw new Error(`${sender} is not allowed to do that`)
    }

    if (action === 'queued') {
        // Spin up a new runner
        const triggerWorkflowDispatch = require('./trigger-workflow-dispatch')
        const token = await getToken()
        const answer = await triggerWorkflowDispatch(
            context,
            token,
            activeOrg,
            'git-for-windows-automation',
            'create-azure-self-hosted-runners.yml',
            'main', {
                runner_scope: 'repo-level',
                // Repository that the runner will be deployed to. We want to ensure that the runner is deployed to the same repository that triggered the action.
                runner_repo: repo
            }
        )

        return `The workflow run to create the self-hosted runner VM was started at ${answer.html_url}`
    }

    if (action === 'completed') {
        // Delete the runner
        const triggerWorkflowDispatch = require('./trigger-workflow-dispatch')
        const token = await getToken()
        const vmName = req.body.workflow_job.runner_name
        const answer = await triggerWorkflowDispatch(
            context,
            token,
            activeOrg,
            'git-for-windows-automation',
            'delete-self-hosted-runner.yml',
            'main', {
                runner_name: vmName
            }
        )

        return `The workflow run to delete the self-hosted runner VM '${vmName}' was started at ${answer.html_url}`
    }

    return `Unhandled action: ${action}`
}