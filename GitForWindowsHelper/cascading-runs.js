const getToken = (() => {
    const tokens = {}

    const get = async (context, owner, repo) => {
        const getInstallationIdForRepo = require('./get-installation-id-for-repo')
        const installationId = await getInstallationIdForRepo(context, owner, repo)
        const getInstallationAccessToken = require('./get-installation-access-token')
        return await getInstallationAccessToken(context, installationId)
    }

    return async (context, owner, repo) => tokens[[owner, repo]] || (tokens[[owner, repo]] = await get(context, owner, repo))
})()

const triggerGitArtifactsRuns = async (context, checkRunOwner, checkRunRepo, tagGitCheckRun) => {
    const commitSHA = tagGitCheckRun.head_sha
    const conclusion = tagGitCheckRun.conclusion
    const text = tagGitCheckRun.output.text

    if (conclusion !== 'success') {
        throw new Error(`tag-git run ${tagGitCheckRun.id} completed with ${conclusion}: ${tagGitCheckRun.html_url}`)
    }

    const match = text.match(/For details, see \[this run\]\(https:\/\/github.com\/([^/]+)\/([^/]+)\/actions\/runs\/(\d+)\)/)
    if (!match) throw new Error(`Unhandled 'text' attribute of tag-git run ${tagGitCheckRun.id}: ${tagGitCheckRun.url}`)
    const owner = match[1]
    const repo = match[2]
    const workflowRunId = Number(match[3])
    if (owner !== 'git-for-windows' || repo !== 'git-for-windows-automation') {
        throw new Error(`Unexpected repository ${owner}/${repo} for tag-git run ${tagGitCheckRun.id}: ${tagGitCheckRun.url}`)
    }

    const gitVersionMatch = tagGitCheckRun.output.summary.match(/^Tag Git (\S+) @([0-9a-f]+)$/)
    if (!gitVersionMatch) {
        throw new Error(`Could not parse Git version from summary '${tagGitCheckRun.output.summary}' of tag-git run ${tagGitCheckRun.id}: ${tagGitCheckRun.url}`)
    }
    if (commitSHA !== gitVersionMatch[2]) {
        throw new Error(`Expected ${commitSHA} in summary '${tagGitCheckRun.output.summary}' of tag-git run ${tagGitCheckRun.id}: ${tagGitCheckRun.url}`)
    }
    const gitVersion = gitVersionMatch[1]

    let res = ''

    const architecturesToTrigger = []
    const { listCheckRunsForCommit, queueCheckRun } = require('./check-runs')
    for (const architecture of ['x86_64', 'i686']) {
        const workflowName = `git-artifacts-${architecture}`
        const runs = await listCheckRunsForCommit(
            context,
            await getToken(context, checkRunOwner, checkRunRepo),
            checkRunOwner,
            checkRunRepo,
            commitSHA,
            workflowName
        )
        const latest = runs
            .filter(run => run.output.summary.endsWith(`(tag-git run #${workflowRunId})`))
            .sort((a, b) => a.id - b.id)
            .pop()
        if (latest && (latest.status !== 'completed' || latest.conclusion === 'success')) {
            // It either succeeded or is still running
            res = `${res}${workflowName} run already exists at ${latest.html_url}.\n`
        } else {
            architecturesToTrigger.push(architecture)
        }
    }

    if (architecturesToTrigger.length === 0) return `${res}No workflows need to be run!\n`

    for (const architecture of architecturesToTrigger) {
        const workflowName = `git-artifacts-${architecture}`
        const title = `Build Git ${gitVersion} artifacts`
        const summary = `Build Git ${gitVersion} artifacts from commit ${commitSHA} (tag-git run #${workflowRunId})`
        await queueCheckRun(
            context,
            await getToken(context, checkRunOwner, checkRunRepo),
            checkRunOwner,
            checkRunRepo,
            commitSHA,
            workflowName,
            title,
            summary
        )
    }

    const triggerWorkflowDispatch = require('./trigger-workflow-dispatch')
    for (const architecture of architecturesToTrigger) {
        const run = await triggerWorkflowDispatch(
            context,
            await getToken(context, owner, repo),
            owner,
            repo,
            'git-artifacts.yml',
            'main', {
                architecture,
                tag_git_workflow_run_id: workflowRunId.toString()
            }
        )
        res = `${res}The \`git-artifacts-${architecture}\` workflow run [was started](${run.html_url}).\n`
    }

    return res
}

const cascadingRuns = async (context, req) => {
    const action = req.body.action
    const checkRunOwner = req.body.repository.owner.login
    const checkRunRepo = req.body.repository.name
    const checkRun = req.body.check_run
    const name = checkRun.name

    if (action === 'completed') {
        if (name === 'tag-git') {
            if (checkRunOwner !== 'git-for-windows' || checkRunRepo !== 'git') {
                throw new Error(`Refusing to handle cascading run in ${checkRunOwner}/${checkRunRepo}`)
            }

            return await triggerGitArtifactsRuns(context, checkRunOwner, checkRunRepo, checkRun)
        }
        return `Not a cascading run: ${name}; Doing nothing.`
    }
    return `Unhandled action: ${action}`
}

module.exports = {
    triggerGitArtifactsRuns,
    cascadingRuns
}