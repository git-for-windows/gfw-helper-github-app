const { activeOrg } = require('./org')

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

const isAllowed = async (context, owner, repo, login) => {
    if (login === 'gitforwindowshelper[bot]') return true
    const getCollaboratorPermissions = require('./get-collaborator-permissions')
    const token = await getToken(context, owner, repo)
    const permission = await getCollaboratorPermissions(context, token, owner, repo, login)
    return ['ADMIN', 'MAINTAIN', 'WRITE'].includes(permission.toString())
}

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
    if (owner !== activeOrg || repo !== 'git-for-windows-automation') {
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
    for (const architecture of ['x86_64', 'i686', 'aarch64']) {
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
    const sender = req.body.sender.login === 'ghost' && checkRun?.app?.slug === 'gitforwindowshelper'
        ? 'gitforwindowshelper[bot]' : req.body.sender.login

    if (action === 'completed') {
        if (name === 'tag-git') {
            if (checkRunOwner !== activeOrg || checkRunRepo !== 'git') {
                throw new Error(`Refusing to handle cascading run in ${checkRunOwner}/${checkRunRepo}`)
            }

            if (!await isAllowed(context, checkRunOwner, checkRunRepo, sender)) throw new Error(`${sender} is not allowed to do that`)

            const comment = await triggerGitArtifactsRuns(context, checkRunOwner, checkRunRepo, checkRun)

            const token = await getToken(context, checkRunOwner, checkRunRepo)
            const { getGitArtifactsCommentID, appendToIssueComment } = require('./issues')
            const gitArtifactsCommentID = await getGitArtifactsCommentID(
                context,
                token,
                checkRunOwner,
                checkRunRepo,
                req.body.check_run.head_sha,
                checkRun.details_url,
            )

            if (gitArtifactsCommentID) {
                await appendToIssueComment(context, token, checkRunOwner, checkRunRepo, gitArtifactsCommentID, comment)
            }

            return comment
        }
        if (checkRunOwner === 'git-for-windows'
            && checkRunRepo === 'git'
            && name.startsWith('git-artifacts-')) {
            if (!await isAllowed(context, checkRunOwner, checkRunRepo, sender)) throw new Error(`${sender} is not allowed to do that`)

            const output = req.body.check_run.output
            const match = output.summary.match(
                /Build Git (\S+) artifacts from commit (\S+) \(tag-git run #(\d+)\)/
            )
            if (!match) throw new Error(
                `Could not parse 'summary' attribute of check-run ${req.body.check_run.id}: ${output.summary}`
            )
            const [, ver, commit, tagGitWorkflowRunID] = match
            const snapshotTag = `prerelease-${ver.replace(/^v/, '')}`

            // First, verify that the snapshot has not been uploaded yet
            const gitSnapshotsToken = await getToken(context, checkRunOwner, 'git-snapshots')
            const githubApiRequest = require('./github-api-request')
            try {
                const releasePath = `${checkRunOwner}/git-snapshots/releases/tags/${snapshotTag}`
                await githubApiRequest(
                    context,
                    gitSnapshotsToken,
                    'GET',
                    `/repos/${releasePath}`,
                )
                return `Ignoring ${name} check-run because the snapshot for ${commit} was already uploaded`
                    + ` to https://github.com/${releasePath}`
            } catch(e) {
                if (e?.statusCode !== 404) throw e
                // The snapshot does not exist yet
            }

            // Next, check that the commit is on the `main` branch
            const gitToken = await getToken(context, checkRunOwner, checkRunRepo)
            const { ahead_by, behind_by } = await githubApiRequest(
                context,
                gitToken,
                'GET',
                `/repos/${checkRunOwner}/${checkRunRepo}/compare/HEAD...${commit}`,
            )
            if (ahead_by > 0) {
                return `Ignoring ${name} check-run because its corresponding commit ${commit} is not on the main branch (ahead by ${ahead_by}, behind by ${behind_by})`
            }

            const workFlowRunIDs = {}
            const { listCheckRunsForCommit, queueCheckRun } = require('./check-runs')
            for (const architecture of ['x86_64', 'i686', 'aarch64']) {
                const workflowName = `git-artifacts-${architecture}`
                const runs = name === workflowName ? [req.body.check_run] : await listCheckRunsForCommit(
                    context,
                    gitToken,
                    checkRunOwner,
                    checkRunRepo,
                    commit,
                    workflowName
                )
                const needle =
                    `Build Git ${ver} artifacts from commit ${commit} (tag-git run #${tagGitWorkflowRunID})`
                const latest = runs
                    .filter(run => run.output.summary === needle)
                    .sort((a, b) => a.id - b.id)
                    .pop()
                if (latest) {
                    if (latest.status !== 'completed') {
                        return `The '${workflowName}' run at ${latest.html_url} did not complete yet.`
                    }
                    if (latest.conclusion !== 'success') {
                        throw new Error(`The '${workflowName}' run at ${latest.html_url} did not succeed.`)
                    }

                    const match = latest.output.text.match(
                        /For details, see \[this run\]\(https:\/\/github.com\/([^/]+)\/([^/]+)\/actions\/runs\/(\d+)\)/
                    )
                    if (!match) throw new Error(`Unhandled 'text' attribute of git-artifacts run ${latest.id}: ${latest.url}`)
                    const owner = match[1]
                    const repo = match[2]
                    workFlowRunIDs[architecture] = match[3]
                    if (owner !== 'git-for-windows' || repo !== 'git-for-windows-automation') {
                        throw new Error(`Unexpected repository ${owner}/${repo} for git-artifacts run ${latest.id}: ${latest.url}`)
                    }
                } else {
                    return `Won't trigger 'upload-snapshot' in reaction to ${name} because the '${workflowName}' run does not exist.`
                }
            }

            const checkRunTitle = `Upload snapshot ${snapshotTag}`
            await queueCheckRun(
                context,
                gitToken,
                'git-for-windows',
                'git',
                commit,
                'upload-snapshot',
                checkRunTitle,
                checkRunTitle
            )

            const gitForWindowsAutomationToken =
                await getToken(context, checkRunOwner, 'git-for-windows-automation')
            const triggerWorkflowDispatch = require('./trigger-workflow-dispatch')
            const answer = await triggerWorkflowDispatch(
                context,
                gitForWindowsAutomationToken,
                'git-for-windows',
                'git-for-windows-automation',
                'upload-snapshot.yml',
                'main', {
                    git_artifacts_x86_64_workflow_run_id: workFlowRunIDs['x86_64'],
                    git_artifacts_i686_workflow_run_id: workFlowRunIDs['i686'],
                    git_artifacts_aarch64_workflow_run_id: workFlowRunIDs['aarch64'],
                }
            )

            return `The 'upload-snapshot' workflow run was started at ${answer.html_url} (ahead by ${ahead_by}, behind by ${behind_by})`
        }
        return `Not a cascading run: ${name}; Doing nothing.`
    }
    return `Unhandled action: ${action}`
}

const handlePush = async (context, req) => {
    const pushOwner = req.body.repository.owner.login
    const pushRepo = req.body.repository.name
    const ref = req.body.ref
    const commit = req.body.after
    const sender = req.body.sender.login

    if (pushOwner !== 'git-for-windows' || pushRepo !== 'git') {
        throw new Error(`Refusing to handle push to ${pushOwner}/${pushRepo}`)
    }

    if (ref !== 'refs/heads/main') return `Ignoring push to ${ref}`

    if (!await isAllowed(context, pushOwner, pushRepo, sender)) throw new Error(`${sender} is not allowed to do that`)

    // See whether there was are already a `tag-git` check-run for this commit
    const { listCheckRunsForCommit, queueCheckRun, updateCheckRun } = require('./check-runs')
    const gitToken = await getToken(context, pushOwner, pushRepo)
    const runs =  await listCheckRunsForCommit(
        context,
        gitToken,
        pushOwner,
        pushRepo,
        commit,
        'tag-git'
    )

    const latest = runs
        .sort((a, b) => a.id - b.id)
        .pop()

    if (latest && latest.status !== 'completed') throw new Error(`The 'tag-git' run at ${latest.html_url} did not complete yet before ${commit} was pushed to ${ref}!`)

    const gitForWindowsAutomationToken =
        await getToken(context, pushOwner, 'git-for-windows-automation')
    const triggerWorkflowDispatch = require('./trigger-workflow-dispatch')
    if (!latest) {
        // There is no `tag-git` workflow run; Trigger it to build a new snapshot
        const tagGitCheckRunTitle = `Tag snapshot Git @${commit}`
        const tagGitCheckRunId = await queueCheckRun(
            context,
            gitForWindowsAutomationToken,
            pushOwner,
            pushRepo,
            commit,
            'tag-git',
            tagGitCheckRunTitle,
            tagGitCheckRunTitle
        )

        try {
            const answer = await triggerWorkflowDispatch(
                context,
                gitForWindowsAutomationToken,
                pushOwner,
                'git-for-windows-automation',
                'tag-git.yml',
                'main', {
                    rev: commit,
                    owner: pushOwner,
                    repo: pushRepo,
                    snapshot: 'true'
                }
            )
            return `The 'tag-git' workflow run was started at ${answer.html_url}`
        } catch (e) {
            await updateCheckRun(
                context,
                gitForWindowsAutomationToken,
                pushOwner,
                pushRepo,
                tagGitCheckRunId, {
                    status: 'completed',
                    conclusion: 'failure',
                    output: {
                        title: tagGitCheckRunTitle,
                        summary: tagGitCheckRunTitle,
                        text: e.message || JSON.stringify(e, null, 2)
                    }
                }
            )
            throw e
        }
    }

    if (latest.conclusion !== 'success') throw new Error(
        `The 'tag-git' run at ${latest.html_url} did not succeed (conclusion = ${latest.conclusion}).`
    )

    const match = latest.output.summary.match(/^Tag Git (\S+) @([0-9a-f]+)$/)
    if (!match) throw new Error(`Unexpected summary '${latest.output.summary}' of tag-git run: ${latest.html_url}`)
    if (!match[2] === commit) throw new Error(`Unexpected revision ${match[2]} '${latest.output.summary}' of tag-git run: ${latest.html_url}`)
    const ver = match[1]

    const match2 = latest.output.text.match(/^For details, see \[this run\]\(https:\/\/github.com\/([^/]+)\/([^/]+)\/actions\/runs\/(\d+)\)/)
    if (!match2) throw new Error(`Unexpected summary '${latest.output.summary}' of tag-git run: ${latest.html_url}`)
    const [, , , tagGitWorkflowRunId] = match2

    // There is already a `tag-git` workflow run; Is there already an `upload-snapshot` run?
    const latestUploadSnapshotRun = (await listCheckRunsForCommit(
        context,
        gitToken,
        pushOwner,
        pushRepo,
        commit,
        'upload-snapshot'
    )).pop()
    if (latestUploadSnapshotRun) return `The 'upload-snapshot' check-run already exists for ${commit}: ${latestUploadSnapshotRun.html_url}`

    // Trigger the `upload-snapshot` run directly
    const tagGitCheckRunTitle = `Upload snapshot Git @${commit}`
    const tagGitCheckRunId = await queueCheckRun(
        context,
        await getToken(context, pushOwner, pushRepo),
        pushOwner,
        pushRepo,
        commit,
        'upload-snapshot',
        tagGitCheckRunTitle,
        tagGitCheckRunTitle
    )

    try {
        const workFlowRunIDs = {}
        for (const architecture of ['x86_64', 'i686', 'aarch64']) {
            const workflowName = `git-artifacts-${architecture}`
            const runs = await listCheckRunsForCommit(
                context,
                gitToken,
                pushOwner,
                pushRepo,
                commit,
                workflowName
            )
            const needle =
                `Build Git ${ver} artifacts from commit ${commit} (tag-git run #${tagGitWorkflowRunId})`
            const latest2 = runs
                .filter(run => run.output.summary === needle)
                .sort((a, b) => a.id - b.id)
                .pop()
            if (latest2) {
                if (latest2.status !== 'completed' || latest2.conclusion !== 'success') {
                    throw new Error(`The '${workflowName}' run at ${latest2.html_url} did not succeed.`)
                }

                const match = latest2.output.text.match(
                    /For details, see \[this run\]\(https:\/\/github.com\/([^/]+)\/([^/]+)\/actions\/runs\/(\d+)\)/
                )
                if (!match) throw new Error(`Unhandled 'text' attribute of git-artifacts run ${latest2.id}: ${latest2.url}`)
                const owner = match[1]
                const repo = match[2]
                workFlowRunIDs[architecture] = match[3]
                if (owner !== 'git-for-windows' || repo !== 'git-for-windows-automation') {
                    throw new Error(`Unexpected repository ${owner}/${repo} for git-artifacts run ${latest2.id}: ${latest2.url}`)
                }
            } else {
                return `Won't trigger 'upload-snapshot' on pushing ${commit} because the '${workflowName}' run does not exist.`
            }
        }

        const answer = await triggerWorkflowDispatch(
            context,
            gitForWindowsAutomationToken,
            pushOwner,
            'git-for-windows-automation',
            'upload-snapshot.yml',
            'main', {
                git_artifacts_x86_64_workflow_run_id: workFlowRunIDs['x86_64'],
                git_artifacts_i686_workflow_run_id: workFlowRunIDs['i686'],
                git_artifacts_aarch64_workflow_run_id: workFlowRunIDs['aarch64'],
            }
        )

        return `The 'upload-snapshot' workflow run was started at ${answer.html_url}`
    } catch (e) {
        await updateCheckRun(
            context,
            gitForWindowsAutomationToken,
            pushOwner,
            pushRepo,
            tagGitCheckRunId, {
                status: 'completed',
                conclusion: 'failure',
                output: {
                    title: tagGitCheckRunTitle,
                    summary: tagGitCheckRunTitle,
                    text: e.message || JSON.stringify(e, null, 2)
                }
            }
        )
        throw e
    }
}

module.exports = {
    triggerGitArtifactsRuns,
    cascadingRuns,
    handlePush
}