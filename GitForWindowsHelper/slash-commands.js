module.exports = async (context, req) => {
    const command = req.body.comment.body
    const owner = req.body.repository.owner.login
    const repo = req.body.repository.name
    const issueNumber = req.body.issue.number
    const commenter = req.body.comment.user.login
    let commentId = req.body.comment.id
    let commentURL = req.body.comment.html_url

    context.log(`Looking at command '${command}' (${typeof command})`)

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

    const react = async (reaction) => {
        const { createReactionForIssueComment } = require('./issues')
        await createReactionForIssueComment(console, await getToken(), owner, repo, commentId, reaction)
    }

    const thumbsUp = async () => react('+1')

    try {
        if (command == '/open pr') {
            if (owner !== 'git-for-windows' || repo !== 'git') return `Ignoring ${command} in unexpected repo: ${commentURL}`

            await checkPermissions()

            const { guessComponentUpdateDetails } = require('./component-updates')
            const { package_name, version } = guessComponentUpdateDetails(req.body.issue.title, req.body.issue.body)

            await thumbsUp()

            const openPR = async (package_name, packageType) => {
                const { searchIssues } = require('./search')
                const prTitle = `${package_name}: update to ${version}`
                const items = await searchIssues(context, `org:git-for-windows is:pull-request "${prTitle}" in:title`)
                const alreadyOpenedPR = items.filter(e => e.title === prTitle)

                const { appendToIssueComment } = require('./issues');
                if (alreadyOpenedPR.length > 0) {
                    ({ html_url: commentURL, id: commentId } =
                      await appendToIssueComment(
                          context,
                          await getToken(),
                          owner,
                          repo,
                          commentId,
                          `${
                              packageType ? `${packageType} ` : ""
                          }PR [already exists](${alreadyOpenedPR[0].html_url})`
                      ));
                    return
                }

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
                );
                ({ html_url: commentURL, id: commentId } = await appendToIssueComment(context, await getToken(), owner, repo, commentId, `The${packageType ? ` ${packageType}` : ''} workflow run [was started](${answer.html_url})`))
            }
            if (!['openssl', 'curl', 'gnutls', 'pcre2'].includes(package_name)) {
                await openPR(package_name)
            } else {
                await openPR(package_name, 'MSYS')
                await openPR(`mingw-w64-${package_name}`, 'MINGW')
            }
            return `I edited the comment: ${commentURL}`
        }

        const deployMatch = command.match(/^\/deploy(\s+(\S+)\s*)?$/)
        if (deployMatch) {
            if (owner !== 'git-for-windows'
             || !req.body.issue.pull_request
             || !['build-extra', 'MINGW-packages', 'MSYS2-packages'].includes(repo)) {
                return `Ignoring ${command} in unexpected repo: ${commentURL}`
            }

            await checkPermissions()

            const { guessComponentUpdateDetails, isMSYSPackage, needsSeparateARM64Build } = require('./component-updates')
            const { package_name } = deployMatch[2]
                ? { package_name: deployMatch[2] }
                : guessComponentUpdateDetails(req.body.issue.title, req.body.issue.body)

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

            await thumbsUp()

            const { queueCheckRun, updateCheckRun } = require('./check-runs')
            const triggerWorkflowDispatch = require('./trigger-workflow-dispatch')
            const triggerBuild = async (architecture) =>
                await triggerWorkflowDispatch(
                    context,
                    await getToken(),
                    'git-for-windows',
                    'git-for-windows-automation',
                    'build-and-deploy.yml',
                    'main', {
                        package: package_name,
                        repo,
                        ref,
                        architecture,
                        actor: commenter
                    }
                )

            const { appendToIssueComment } = require('./issues')
            const appendToComment = async (text) =>
                await appendToIssueComment(
                    context,
                    await getToken(),
                    owner,
                    repo,
                    commentId,
                    text
                )
            if (!isMSYSPackage(package_name)) {
                let aarch64Answer
                if (needsSeparateARM64Build(package_name)) {
                    const aarch64Id = await queueCheckRun(
                        context,
                        await getToken(),
                        'git-for-windows',
                        repo,
                        ref,
                        'deploy_aarch64',
                        `Build and deploy ${package_name}`,
                        `Deploying ${package_name}`
                    )
                    aarch64Answer = await triggerBuild('aarch64')
                    await updateCheckRun(
                        context,
                        await getToken(),
                        'git-for-windows',
                        repo,
                        aarch64Id, {
                            details_url: aarch64Answer.html_url
                        }
                    )
                }

                const id = await queueCheckRun(
                    context,
                    await getToken(),
                    'git-for-windows',
                    repo,
                    ref,
                    'deploy',
                    `Build and deploy ${package_name}`,
                    `Deploying ${package_name}`
                )

                const answer = await triggerBuild()
                const answer2 = await appendToComment(aarch64Answer
                    ? `The [i686/x86_64](${answer.html_url}) and the [arm64](${aarch64Answer.html_url}) workflow runs were started.`
                    : `The workflow run [was started](${answer.html_url}).`
                )
                await updateCheckRun(
                    context,
                    await getToken(),
                    'git-for-windows',
                    repo,
                    id, {
                        details_url: answer.html_url
                    }
                )
                return `I edited the comment: ${answer2.html_url}`
            }

            const x86_64Id = await queueCheckRun(
                context,
                await getToken(),
                'git-for-windows',
                repo,
                ref,
                'deploy_x86_64',
                `Build and deploy ${package_name}`,
                `Deploying ${package_name}`
            )
            const i686Id = await queueCheckRun(
                context,
                await getToken(),
                'git-for-windows',
                repo,
                ref,
                'deploy_i686',
                `Build and deploy ${package_name}`,
                `Deploying ${package_name}`
            )

            const x86_64Answer = await triggerBuild('x86_64')
            const i686Answer = await triggerBuild('i686')
            const answer2 = await appendToComment(
                `The [x86_64](${x86_64Answer.html_url}) and the [i686](${i686Answer.html_url}) workflow runs were started.`
            )
            await updateCheckRun(
                context,
                await getToken(),
                'git-for-windows',
                repo,
                x86_64Id, {
                    details_url: x86_64Answer.html_url
                }
            )
            await updateCheckRun(
                context,
                await getToken(),
                'git-for-windows',
                repo,
                i686Id, {
                    details_url: i686Answer.html_url
                }
            )
            return `I edited the comment: ${answer2.html_url}`
        }

        if (command == '/git-artifacts') {
            if (owner !== 'git-for-windows'
             || repo !== 'git'
             || !req.body.issue.pull_request
            ) {
                return `Ignoring ${command} in unexpected repo: ${commentURL}`
            }

            await checkPermissions()
            await thumbsUp()

            const { triggerGitArtifacts } = require('./azure-pipelines')
            const answer = await triggerGitArtifacts(context, req.body.issue.number)

            const { appendToIssueComment } = require('./issues')
            const answer2 = await appendToIssueComment(context, await getToken(), owner, repo, commentId, `The Azure Pipeline run [was started](${answer.url})`)
            return `I edited the comment: ${answer2.html_url}`
        }

        if (command == '/release') {
            if (owner !== 'git-for-windows'
              || repo !== 'git'
              || !req.body.issue.pull_request
            ) {
                return `Ignoring ${command} in unexpected repo: ${commentURL}`
            }

            await checkPermissions()
            await thumbsUp()

            const { releaseGitArtifacts } = require('./azure-pipelines')
            const answer = await releaseGitArtifacts(context, req.body.issue.number)

            const { appendToIssueComment } = require('./issues')
            const answer2 = await appendToIssueComment(context, await getToken(), owner, repo, commentId, `The Azure Release Pipeline run [was started](${answer.url})`)
            return `I edited the comment: ${answer2.html_url}`
        }

        const relNotesMatch = command.match(/^\/add (relnote|release ?note)(\s+(blurb|feature|bug)\s+([^]*))?$/i)
        if (relNotesMatch) {
            if (owner !== 'git-for-windows'
             || !['git', 'build-extra', 'MINGW-packages', 'MSYS2-packages'].includes(repo)) {
                return `Ignoring ${command} in unexpected repo: ${commentURL}`
            }

            await checkPermissions()

            let [ , , , type, message ] = relNotesMatch
            if (!type) {
                const { guessReleaseNotes } = require('./component-updates');
                ({ type, message } = await guessReleaseNotes(req.body.issue))
            }

            await thumbsUp()

            const triggerWorkflowDispatch = require('./trigger-workflow-dispatch')
            const answer = await triggerWorkflowDispatch(
                context,
                await getToken(),
                'git-for-windows',
                'build-extra',
                'add-release-note.yml',
                'main', {
                    type,
                    message
                }
            )
            const { appendToIssueComment } = require('./issues')
            const answer2 = await appendToIssueComment(context, await getToken(), owner, repo, commentId, `The workflow run [was started](${answer.html_url})`)
            return `I edited the comment: ${answer2.html_url}`
        }
    } catch (e) {
        await react('confused')
        throw e
    }

    return `Ignoring slash command ${command} in ${commentURL}`
}
