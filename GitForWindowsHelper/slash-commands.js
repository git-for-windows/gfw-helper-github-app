module.exports = async (context, req) => {
    const command = req.body.comment.body
    const owner = req.body.repository.owner.login
    const repo = req.body.repository.name
    const issueNumber = req.body.issue.number
    const commenter = req.body.comment.user.login
    let commentId = req.body.comment.id
    let commentURL = req.body.comment.html_url

    if (command === '/hi') {
        const comment = `Hi @${commenter}!`

        const getInstallationAccessToken = require('./get-installation-access-token')
        const token = await getInstallationAccessToken(context, req.body.installation.id)

        const { addIssueComment } = require('./issues')
        const answer = await addIssueComment(context, token, owner, repo, issueNumber, comment)

        return `I said hi! ${answer.html_url}`
    }

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

    const checkPermissions = async () => {
        const getCollaboratorPermissions = require('./get-collaborator-permissions')
        const token = await getToken()
        const permission = await getCollaboratorPermissions(context, token, owner, repo, commenter)
        if (!['ADMIN', 'MAINTAIN', 'WRITE'].includes(permission.toString())) throw new Error(`@${commenter} has no permissions to do that`)
    }

    try {
        if (command == '/open pr') {
            if (owner !== 'git-for-windows' || repo !== 'git') return `Ignoring ${command} in unexpected repo: ${commentURL}`

            await checkPermissions()

            const { guessComponentUpdateDetails } = require('./component-updates')
            const { package_name, version } = guessComponentUpdateDetails(req.body.issue.title)

            const { createReactionForIssueComment } = require('./issues')
            await createReactionForIssueComment(console, await getToken(), owner, repo, commentId, '+1')

            const openPR = async (package_name, packageType) => {
                const triggerWorkflowDispatch = require('./trigger-workflow-dispatch')
                const answer = await triggerWorkflowDispatch(
                    context,
                    await getToken(),
                    'git-for-windows',
                    'git-for-windows-automation',
                    'open-pr.yml',
                    'main', {
                        package: package_name,
                        version,
                        actor: commenter
                    }
                )
                const { appendToIssueComment } = require('./issues');
                ({ html_url: commentURL, id: commentId } = await appendToIssueComment(context, await getToken(), owner, repo, commentId, `The${packageType ? ` ${packageType}` : ''} workflow run [was started](${answer.html_url})`))
            }
            if (!['openssl', 'curl', 'gnutls'].includes(package_name)) {
                await openPR(package_name)
            } else {
                await openPR(package_name, 'MSYS')
                await openPR(`mingw-w64-${package_name}`, 'MINGW')
            }
            return `I edited the comment: ${commentURL}`
        }

        if (command == '/deploy') {
            if (owner !== 'git-for-windows'
             || !req.body.issue.pull_request
             || !['build-extra', 'MINGW-packages', 'MSYS2-packages'].includes(repo)) {
                return `Ignoring ${command} in unexpected repo: ${commentURL}`
             }

            await checkPermissions()

            let [ , package_name, version ] = req.body.issue.title.match(/^(\S+): update to (\S+)/) || []
            if (!package_name || !version) throw new Error(`Could not parse ${req.issue.title} in ${commentURL}`)
            if (package_name == 'git-lfs') package_name = `mingw-w64-${package_name}`
            if (version.startsWith('v')) version = version.substring(1)

            // The commit hash of the tip commit is sadly not part of the
            // "comment.created" webhook's payload. Therefore, we have to get it
            // "by hand"
            const githubApiRequest = require('./github-api-request')
            const { head: { sha: ref } } = await githubApiRequest(
                console,
                null,
                'GET',
                `/repos/${owner}/${repo}/pulls/${issueNumber}`
            )

            const { createReactionForIssueComment } = require('./issues')
            await createReactionForIssueComment(console, await getToken(), owner, repo, commentId, '+1')

            const triggerWorkflowDispatch = require('./trigger-workflow-dispatch')
            const answer = await triggerWorkflowDispatch(
                context,
                await getToken(),
                'git-for-windows',
                'git-for-windows-automation',
                'build-and-deploy.yml',
                'main', {
                    package: package_name,
                    repo,
                    ref,
                    actor: commenter
                }
            )
            const { appendToIssueComment } = require('./issues')
            const answer2 = await appendToIssueComment(context, await getToken(), owner, repo, commentId, `The workflow run [was started](${answer.html_url})`)
            return `I edited the comment: ${answer2.html_url}`
        }
    } catch (e) {
        const { createReactionForIssueComment } = require('./issues')
        await createReactionForIssueComment(console, await getToken(), owner, repo, commentId, 'confused')
        throw e
    }

    return `Ignoring slash command ${command} in ${commentURL}`
}