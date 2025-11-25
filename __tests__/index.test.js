const index = require('../GitForWindowsHelper/index')
const crypto = require('crypto')

process.env['GITHUB_WEBHOOK_SECRET'] = 'for-testing'

test('reject requests other than webhook payloads', async () => {
    const context = {
        log: jest.fn(),
        req: {
            method: 'GET'
        }
    }

    const expectInvalidWebhook = async (message) => {
        context.log.mockClear()
        expect(await index(context, context.req)).toBeUndefined()
        expect(context.log).toHaveBeenCalledTimes(1)
        // context.log was called with an instance of an `Error`
        expect(context.log.mock.calls[0][0].message).toEqual(message)
        expect(context.res).toEqual({
            body: `Go away, you are not a valid GitHub webhook: Error: ${message}`,
            headers: undefined,
            status: 403
        })
    }

    await expectInvalidWebhook('Unexpected method: GET')

    context.log = jest.fn()
    context.req.method = 'POST'
    context.req.headers = {
        'content-type': 'text/plain'
    }
    await expectInvalidWebhook('Unexpected content type: text/plain')

    context.req.headers['content-type'] = 'application/json'
    await expectInvalidWebhook('Missing X-Hub-Signature')

    context.req.headers['x-hub-signature-256'] = 'invalid'
    await expectInvalidWebhook('Unexpected X-Hub-Signature format: invalid')

    context.req.headers['x-hub-signature-256'] = 'sha256=incorrect'
    context.req.rawBody = '# empty'
    await expectInvalidWebhook('Incorrect X-Hub-Signature')
})

let mockGetInstallationAccessToken = jest.fn(() => 'installation-access-token')
jest.mock('../GitForWindowsHelper/get-installation-access-token', () => {
    return mockGetInstallationAccessToken
})

let mockGitHubApiRequestAsApp = jest.fn()
jest.mock('../GitForWindowsHelper/github-api-request-as-app', () => {
    return mockGitHubApiRequestAsApp
})

const dispatchedWorkflows = []
let mockGitHubApiRequest = jest.fn((_context, _token, method, requestPath, payload) => {
    if (method === 'POST' && requestPath.endsWith('/comments')) return {
        id: -124,
        html_url: `new-comment-url-${payload.body}`
    }
    if (method === 'GET' && requestPath.endsWith('/comments/0')) return {
        body: `existing comment body`
    }
    if (method === 'PATCH' && requestPath.endsWith('/comments/0')) return {
        id: 0,
        html_url: `appended-comment-body-${payload.body}`
    }
    if (method === 'GET' && requestPath.endsWith('/comments/654321')) return {
        body: 'The `release-git` workflow run [was started](https://github.com/git-for-windows/git-for-windows-automation/actions/runs/54321)'
    }
    if (method === 'POST' && requestPath.endsWith('/reactions')) return {
        id: `new-reaction-${payload.content}`
    }
    if (method === 'POST' && requestPath === '/graphql') {
        if (payload.query.startsWith('query CollaboratorPermission')) return {
            data: {
                repository:{
                    collaborators: {
                        edges: [{ permission: 'WRITE' }]
                    }
                }
            }
        }
    }
    let match
    if (method === 'POST' && (match = requestPath.match(/([^/]+)\/dispatches$/))) {
        dispatchedWorkflows.unshift({
            html_url: `dispatched-workflow-${match[1]}`,
            path: `.github/workflows/${match[1]}`,
            payload
        })
        return {
            headers: {
                date: (new Date()).toISOString()
            }
        }
    }
    if (method === 'GET' && requestPath.indexOf('/actions/runs?') > 0) return {
        workflow_runs: dispatchedWorkflows
    }
    if (method === 'GET' && requestPath === '/user') return {
        login: 'cheers'
    }
    if (method === 'GET' && requestPath.endsWith('/pulls/86')) return {
        head: { sha: '707a11ee' }
    }
    if (method === 'GET' && requestPath.endsWith('/pulls/500')) return {
        head: { sha: '82e8648' }
    }
    if (method === 'GET' && requestPath.endsWith('/pulls/74')) return {
        head: { sha: 'a7e4b90' }
    }
    if (method === 'GET' && requestPath.endsWith('/pulls/90')) return {
        head: { sha: '265d07e' }
    }
    if (method === 'GET' && requestPath.endsWith('/pulls/96')) return {
        head: { sha: 'b7b0dfc' }
    }
    if (method === 'GET' && requestPath.endsWith('/pulls/115')) return {
        head: { sha: '9bc59bd' }
    }
    if (method === 'GET' && requestPath.endsWith('/pulls/153')) return {
        head: { sha: 'b197f8f' }
    }
    if (method === 'GET' && requestPath.endsWith('/pulls/4322')) return {
        head: { sha: 'c8edb521bdabec14b07e9142e48cab77a40ba339' }
    }
    if (method === 'GET' && requestPath.endsWith('/pulls/4328')) return {
        head: { sha: 'this-will-be-rc2' }
    }
    if (method === 'GET' && requestPath.endsWith('/pulls/4323')) return {
        head: { sha: 'dee501d15' }
    }
    if (method === 'GET' && requestPath.endsWith('/pulls/765')) return {
        head: { sha: 'c0ffee1ab7e' }
    }
    if (method === 'GET' && requestPath.endsWith('/pulls/69')) return {
        head: { sha: '59d71150a6ee93ab954221c43ca86f8eafe68ddc'}
    }
    if (method === 'GET' && requestPath.endsWith('/pulls/177')) return {
        head: { sha: '03bdffe5997'}
    }
    if (method === 'PATCH' && requestPath.endsWith('/git/refs/heads/main')) {
        if (payload.sha !== 'c0ffee1ab7e') throw new Error(`Unexpected sha: ${payload.sha}`)
        if (payload.force !== false) throw new Error(`Unexpected force value: ${payload.force}`)
        return {}
    }
    if (method === 'GET' && requestPath === '/search/issues?q=repo:git-for-windows/git+c8edb521bdabec14b07e9142e48cab77a40ba339+type:pr+%22git-artifacts%22') return {
        items: [{
            text_matches: [{
                object_url: 'https://api.github.com/repositories/23216272/issues/comments/1450703020',
                fragment: '/git-artifacts\n\nThe tag-git workflow run was started\n'
            }]
        }]
    }
    if (method === 'GET' && requestPath === '/repos/git-for-windows/git/issues/comments/1450703020') return {
        body: '/git-artifacts\n\nThe `tag-git` workflow run [was started](https://url-to-tag-git/)'
    }
    if (method === 'PATCH' && requestPath === '/repos/git-for-windows/git/issues/comments/1450703020') {
        expect(payload.body).toEqual(`/git-artifacts

The \`tag-git\` workflow run [was started](https://url-to-tag-git/)

git-artifacts-x86_64 run already exists at <url-to-existing-x86_64-run>.
The \`git-artifacts-i686\` workflow run [was started](dispatched-workflow-git-artifacts.yml).
The \`git-artifacts-aarch64\` workflow run [was started](dispatched-workflow-git-artifacts.yml).
`)
        return { html_url: 'https://github.com/git-for-windows/git/pull/4322#issuecomment-1450703020' }
    }
    if (method === 'GET' && requestPath ===
        '/repos/git-for-windows/git-snapshots/releases/tags/prerelease-2.48.0-rc2.windows.1-472-g0c796d3013-20250128120446') {
        throw { statusCode: 404 }
    }
    if (method === 'GET' && requestPath ===
        '/repos/git-for-windows/git/compare/HEAD...0c796d3013a57e8cc894c152f0200107226e5dd1') {
        return { ahead_by: 0, behind_by: 99 }
    }
    throw new Error(`Unhandled ${method}-${requestPath}-${JSON.stringify(payload)}`)
})
jest.mock('../GitForWindowsHelper/github-api-request', () => {
    return mockGitHubApiRequest
})

afterEach(() => {
    jest.clearAllMocks()
    dispatchedWorkflows.splice(0, dispatchedWorkflows.length) // empty the array
})

const makeContext = (body, headers) => {
    body = {
        app: {
            slug: 'gitforwindowshelper'
        },
        sender: {
            login: 'gitforwindowshelper[bot]'
        },
        ...body
    }
    const rawBody = JSON.stringify(body)
    const sha256 = crypto.createHmac('sha256', process.env['GITHUB_WEBHOOK_SECRET']).update(rawBody).digest('hex')
    return {
        log: jest.fn(),
        req: {
            body,
            headers: {
                'content-type': 'application/json',
                'x-hub-signature-256': `sha256=${sha256}`,
                ...headers || {}
            },
            method: 'POST',
            rawBody
        }
    }
}

function extend (a, ...list) {
    for (const b of list) {
        for (const key of Object.keys(b)) {
            if (Array.isArray(key[a])) a[key].push(...(Array.isArray(b[key]) ? b[key] : [ b[key] ]))
            if (a[key] !== null && a[key] instanceof Object) extend(a[key], b[key])
            else a[key] = b[key]
        }
    }
    return a
}

const testIssueComment = (comment, bodyExtra_, fn) => {
    let note = comment
    if (typeof comment === 'object') {
        note = comment.note
        comment = comment.comment
    }
    if (!fn) {
        fn = bodyExtra_
        bodyExtra_= undefined
    }
    const repo = bodyExtra_?.repository?.name || 'git'
    const number = bodyExtra_?.issue?.number || 0
    const pullOrIssues = bodyExtra_?.issue?.pull_request ? 'pull' : 'issues'
    const context = makeContext(extend({
        action: 'created',
        comment: {
            body: comment,
            html_url: `https://github.com/git-for-windows/${repo}/${pullOrIssues}/${number}`,
            id: 0,
            user: {
                login: 'statler and waldorf'
            }
        },
        installation: {
            id: 123
        },
        issue: {
            number
        },
        repository: {
            name: repo,
            owner: {
                login: 'git-for-windows'
            }
        }
    }, bodyExtra_ ? bodyExtra_ : {}), {
        'x-github-event': 'issue_comment'
    })

    test(`test ${comment}${note ? ` (${note})` : ''}`, async () => {
        try {
            await fn(context)
        } catch (e) {
            context.log.mock.calls.forEach(e => console.log(e[0]))
            throw e;
        }
    })
}

testIssueComment('/hi', async (context) => {
    expect(await index(context, context.req)).toBeUndefined()
    expect(context.res).toEqual({
        body: 'I said hi! new-comment-url-Hi @statler and waldorf!',
        headers: undefined,
        status: undefined
    })
    expect(mockGetInstallationAccessToken).toHaveBeenCalledTimes(1)
    expect(mockGitHubApiRequestAsApp).not.toHaveBeenCalled()
    expect(mockGitHubApiRequest).toHaveBeenCalledTimes(1)
    expect(mockGitHubApiRequest.mock.calls[0].slice(1)).toEqual([
        "installation-access-token",
        "POST",
        "/repos/git-for-windows/git/issues/0/comments",
        {"body": "Hi @statler and waldorf!" }
    ])
})

let mockGetInstallationIDForRepo = jest.fn(() => 'installation-id')
jest.mock('../GitForWindowsHelper/get-installation-id-for-repo', () => {
    return mockGetInstallationIDForRepo
})

let mockSearchIssues = jest.fn((_context, searchTerms) => {
    if (searchTerms.indexOf('release-git') > 0) return [{
        number: 765,
        author_association: 'MEMBER',
        text_matches: [{
            object_url: 'https://api.github.com/repos/git-for-windows/git/issues/comments/654321'
        }]
    }]
    return []
})
jest.mock('../GitForWindowsHelper/search', () => {
    return {
        searchIssues: mockSearchIssues
    }
})

testIssueComment('/open pr', {
    issue: {
        number: 4281,
        title: '[New gnutls version] GnuTLS 3.8.0',
        body: `Released a bug-fix and enhancement release on the 3.8.x branch.[GnuTLS 3.8.0](https://lists.gnupg.org/pipermail/gnutls-help/2023-February/004816.html)

Added the security advisory.[GNUTLS-SA-2020-07-14](security-new.html#GNUTLS-SA-2020-07-14)

http://www.gnutls.org/news.html#2023-02-10`
    }
}, async (context) => {
    expect(await index(context, context.req)).toBeUndefined()
    expect(context.res).toEqual({
        body: `I edited the comment: appended-comment-body-existing comment body

The MINGW workflow run [was started](dispatched-workflow-open-pr.yml)`,
        headers: undefined,
        status: undefined
    })
    expect(mockGetInstallationAccessToken).toHaveBeenCalledTimes(1)
    expect(mockGitHubApiRequestAsApp).not.toHaveBeenCalled()
    expect(dispatchedWorkflows).toHaveLength(2)
    expect(dispatchedWorkflows.map(e => e.payload.inputs.package)).toEqual(['mingw-w64-gnutls', 'gnutls'])
    expect(mockGitHubApiRequest).toHaveBeenCalled()
    const msysComment = mockGitHubApiRequest.mock.calls[mockGitHubApiRequest.mock.calls.length - 6]
    expect(msysComment[3]).toEqual('/repos/git-for-windows/git/issues/comments/0')
    expect(msysComment[4]).toEqual({
        body: `existing comment body

The MSYS workflow run [was started](dispatched-workflow-open-pr.yml)`
    })
    const mingwComment = mockGitHubApiRequest.mock.calls[mockGitHubApiRequest.mock.calls.length - 1]
    expect(mingwComment[3]).toEqual('/repos/git-for-windows/git/issues/comments/0')
    expect(mingwComment[4]).toEqual({
        body: `existing comment body

The MINGW workflow run [was started](dispatched-workflow-open-pr.yml)`
    })
})

testIssueComment('/open pr', {
    repository: {
        name: 'msys2-runtime'
    },
    issue: {
        number: 69,
        title: 'Support OneDrive better',
        body: `This backports patches that avoid hydrating files on OneDrive _just_ to \`stat()\` them.

See also https://github.com/msys2/msys2-runtime/issues/206.`,
        pull_request: {
            html_url: 'https://github.com/git-for-windows/msys2-runtime/pull/69'
        }
    }
}, async (context) => {
    expect(await index(context, context.req)).toBeUndefined()
    expect(context.res).toEqual({
        body: `I edited the comment: appended-comment-body-existing comment body

The workflow run [was started](dispatched-workflow-open-pr.yml)`,
        headers: undefined,
        status: undefined
    })
    expect(mockGetInstallationAccessToken).toHaveBeenCalledTimes(1)
    expect(mockGitHubApiRequestAsApp).not.toHaveBeenCalled()
    expect(dispatchedWorkflows).toHaveLength(1)
    expect(dispatchedWorkflows[0].payload.inputs.package).toEqual('msys2-runtime')
    expect(dispatchedWorkflows[0].payload.inputs.version).toEqual('59d71150a6ee93ab954221c43ca86f8eafe68ddc')
    expect(mockGitHubApiRequest).toHaveBeenCalled()
    const msysComment = mockGitHubApiRequest.mock.calls[mockGitHubApiRequest.mock.calls.length - 1]
    expect(msysComment[3]).toEqual('/repos/git-for-windows/msys2-runtime/issues/comments/0')
    expect(msysComment[4]).toEqual({
        body: `existing comment body

The workflow run [was started](dispatched-workflow-open-pr.yml)`
    })
})

testIssueComment('/updpkgsums', {
    issue: {
        number: 104,
        title: 'Make tig launchable from PowerShell/Command Prompt',
        body: 'Add tig.exe to /cmd/',
        pull_request: {
            html_url: 'https://github.com/git-for-windows/MINGW-packages/pull/104'
        }
    },
    repository: {
        name: 'MINGW-packages'
    }
}, async (context) => {
    expect(await index(context, context.req)).toBeUndefined()
    expect(context.res).toEqual({
        body: `I edited the comment: appended-comment-body-existing comment body

The workflow run [was started](dispatched-workflow-updpkgsums.yml).`,
        headers: undefined,
        status: undefined
    })
    expect(mockGetInstallationAccessToken).toHaveBeenCalledTimes(1)
    expect(mockGitHubApiRequestAsApp).not.toHaveBeenCalled()
    expect(dispatchedWorkflows).toHaveLength(1)
    expect(dispatchedWorkflows.map(e => e.payload.inputs['pr-number'])).toEqual(['104'])
    expect(mockGitHubApiRequest).toHaveBeenCalled()
    const comment = mockGitHubApiRequest.mock.calls[mockGitHubApiRequest.mock.calls.length - 1]
    expect(comment[3]).toEqual('/repos/git-for-windows/MINGW-packages/issues/comments/0')
    expect(comment[4]).toEqual({
        body: `existing comment body

The workflow run [was started](dispatched-workflow-updpkgsums.yml).`
    })
})

let mockQueueCheckRun = jest.fn(() => 'check-run-id')
let mockUpdateCheckRun = jest.fn()
let mockListCheckRunsForCommit = jest.fn((_context, _token, _owner, _repo, rev, checkRunName) => {
    const app = {
        slug: 'gitforwindowshelper'
    }
    if (rev === 'this-will-be-rc2') {
        const id = {
            'git-artifacts-x86_64': 8664,
            'git-artifacts-i686': 686,
            'git-artifacts-aarch64': 64
        }[checkRunName]
        const output = {
            title: 'Build Git -rc2 artifacts',
            summary: 'Build Git -rc2 artifacts from commit this-will-be-rc2 (tag-git run #987)',
            text: `For details, see [this run](https://github.com/git-for-windows/git-for-windows-automation/actions/runs/${id})`
        }
        return [{ id, status: 'completed', conclusion: 'success', output, app }]
    }
    if (rev === '0c796d3013a57e8cc894c152f0200107226e5dd1') {
        const id = {
            'git-artifacts-x86_64': 13010015190,
            'git-artifacts-i686': 13010015938,
            'git-artifacts-aarch64': 13010016895
        }[checkRunName]
        const output = {
            title: 'Build Git v2.48.0-rc2.windows.1-472-g0c796d3013-20250128120446 artifacts',
            summary: 'Build Git v2.48.0-rc2.windows.1-472-g0c796d3013-20250128120446 artifacts from commit 0c796d3013a57e8cc894c152f0200107226e5dd1 (tag-git run #13009996573)',
            text: `For details, see [this run](https://github.com/git-for-windows/git-for-windows-automation/actions/runs/${id})`
        }
        return [{ id, status: 'completed', conclusion: 'success', output }]
    }
    if (rev === 'dee501d15') {
        if (checkRunName === 'tag-git') return [{
            status: 'completed',
            conclusion: 'success',
            html_url: '<url-to-tag-git',
            output: {
                title: 'Tag Git -rc1½',
                summary: `Tag Git -rc1½ @${rev}`,
                text: 'For details, see [this run](https://github.com/git-for-windows/git-for-windows-automation/actions/runs/341).'
            },
            app,
        }]
        return []
    }
    if (rev === '88811') {
        if (checkRunName === 'tag-git') return [{
            conclusion: 'success',
            status: 'completed',
            output: {
                summary: 'Tag Git already-tagged @88811',
                text: 'For details, see [this run](https://github.com/x/y/actions/runs/123).\nTagged already-tagged\nDone!.'
            },
            id: 123456789
        }]
        if (checkRunName.startsWith('git-artifacts')) {
            const id = {
                'git-artifacts-x86_64': 8664,
                'git-artifacts-i686': 686,
                'git-artifacts-aarch64':64,
            }[checkRunName]
            const output = {
                title: 'Build already-tagged artifacts',
                summary: 'Build Git already-tagged artifacts from commit 88811 (tag-git run #123)',
                text: `For details, see [this run](https://github.com/git-for-windows/git-for-windows-automation/actions/runs/${id})`
            }
            return [{ id, status: 'completed', conclusion: 'success', output }]
        }
    }
    if (checkRunName === 'git-artifacts-x86_64') return [{
        status: 'completed',
        conclusion: 'success',
        html_url: '<url-to-existing-x86_64-run>',
        output: {
            title: 'Build Git -rc1',
            summary: 'Build Git -rc1 from commit c8edb521bdabec14b07e9142e48cab77a40ba339 (tag-git run #4322343196)'
        }
    }]
    return []
})
jest.mock('../GitForWindowsHelper/check-runs', () => {
    return {
        queueCheckRun: mockQueueCheckRun,
        updateCheckRun: mockUpdateCheckRun,
        listCheckRunsForCommit: mockListCheckRunsForCommit
    }
})

testIssueComment('/deploy', {
    issue: {
        number: 86,
        title: 'gnutls: update to 3.8.0',
        body: 'This closes https://github.com/git-for-windows/git/issues/4281',
        pull_request: {
            html_url: 'https://github.com/git-for-windows/MSYS2-packages/pull/86'
        }
    },
    repository: {
        name: 'MSYS2-packages',
    }
}, async (context) => {
    expect(await index(context, context.req)).toBeUndefined()
    expect(context.res).toEqual({
        body: `I edited the comment: appended-comment-body-existing comment body

The [x86_64](dispatched-workflow-build-and-deploy.yml) and the [i686](dispatched-workflow-build-and-deploy.yml) workflow runs were started.`,
        headers: undefined,
        status: undefined
    })
    expect(mockGetInstallationAccessToken).toHaveBeenCalledTimes(1)
    expect(mockGitHubApiRequestAsApp).not.toHaveBeenCalled()
    expect(mockQueueCheckRun).toHaveBeenCalledTimes(2)
    expect(mockUpdateCheckRun).toHaveBeenCalledTimes(2)
    expect(dispatchedWorkflows).toHaveLength(2)
    expect(dispatchedWorkflows.map(e => e.payload.inputs.architecture)).toEqual(['i686', 'x86_64'])
})

testIssueComment('/deploy mingw-w64-git-credential-manager', {
    issue: {
        number: 500,
        title: 'mingw-w64-git-credential-manager: update to 2.1.2',
        body: 'This closes https://github.com/git-for-windows/git/issues/4415',
        pull_request: {
            html_url: 'https://github.com/git-for-windows/build-extra/pull/500'
        }
    },
    repository: {
        name: 'build-extra'
    }
}, async (context) => {
    expect(await index(context, context.req)).toBeUndefined()
    expect(context.res.body).toEqual(`I edited the comment: appended-comment-body-existing comment body

The workflow run [was started](dispatched-workflow-build-and-deploy.yml).`)
    expect(mockQueueCheckRun).toHaveBeenCalledTimes(1)
    expect(mockUpdateCheckRun).toHaveBeenCalledTimes(1)
    expect(dispatchedWorkflows.map(e => e.payload.inputs.architecture)).toEqual([undefined])
})

testIssueComment('/deploy mingw-w64-curl', {
    issue: {
        number: 74,
        title: 'mingw-w64-curl: update to 8.0.1',
        body: 'This closes https://github.com/git-for-windows/git/issues/4354',
        pull_request: {
            html_url: 'https://github.com/git-for-windows/MINGW-packages/pull/74'
        }
    },
    repository: {
        name: 'MINGW-packages'
    }
}, async (context) => {
    expect(await index(context, context.req)).toBeUndefined()
    expect(context.res.body).toEqual(`I edited the comment: appended-comment-body-existing comment body

The [i686/x86_64](dispatched-workflow-build-and-deploy.yml) and the [arm64](dispatched-workflow-build-and-deploy.yml) workflow runs were started.`)
    expect(mockQueueCheckRun).toHaveBeenCalledTimes(2)
    expect(mockUpdateCheckRun).toHaveBeenCalledTimes(2)
    expect(dispatchedWorkflows.map(e => e.payload.inputs.architecture)).toEqual(['aarch64', undefined])
})

testIssueComment('/deploy msys2-runtime', {
    issue: {
        number: 90,
        title: 'msys2-runtime: avoid sharing incompatible cygheaps, take two',
        body: 'This is a companion to https://github.com/git-for-windows/msys2-runtime/pull/49.',
        pull_request: {
            html_url: 'https://github.com/git-for-windows/MSYS2-packages/pull/90'
        }
    },
    repository: {
        name: 'MSYS2-packages'
    }
}, async (context) => {
    expect(await index(context, context.req)).toBeUndefined()
    expect(context.res.body).toEqual(`I edited the comment: appended-comment-body-existing comment body

The workflow run [was started](dispatched-workflow-build-and-deploy.yml).`)
    expect(mockQueueCheckRun).toHaveBeenCalledTimes(1)
    expect(mockUpdateCheckRun).toHaveBeenCalledTimes(1)
    expect(dispatchedWorkflows.map(e => e.payload.inputs.architecture)).toEqual(['x86_64'])
})

testIssueComment('/deploy', {
    issue: {
        number: 177,
        title: 'msys2-runtime: update to 4b3a2e08f545432b62461313082193d6df09b6b8',
        body: 'This corresponds to https://github.com/git-for-windows/msys2-runtime/pull/70',
        pull_request: {
            html_url: 'https://github.com/git-for-windows/MSYS2-packages/pull/177'
        }
    },
    repository: {
        name: 'MSYS2-packages'
    }
}, async (context) => {
    expect(await index(context, context.req)).toBeUndefined()
    expect(context.res.body).toEqual(`I edited the comment: appended-comment-body-existing comment body

The workflow run [was started](dispatched-workflow-build-and-deploy.yml).`)
    expect(mockQueueCheckRun).toHaveBeenCalledTimes(1)
    expect(mockUpdateCheckRun).toHaveBeenCalledTimes(1)
    expect(dispatchedWorkflows.map(e => e.payload.inputs.architecture)).toEqual(['x86_64'])
    expect(dispatchedWorkflows.map(e => e.payload.inputs.package)).toEqual(['msys2-runtime'])
})

testIssueComment('/deploy msys2-runtime-3.3', {
    issue: {
        number: 96,
        title: 'add a msys2-runtime-3.3 package',
        body: 'The first step of phase 2 of the current timeline(https://github.com/git-for-windows/git/issues/4279#issue-1577622335)',
        pull_request: {
            html_url: 'https://github.com/git-for-windows/MSYS2-packages/pull/96'
        }
    },
    repository: {
        name: 'MSYS2-packages'
    }
}, async (context) => {
    expect(await index(context, context.req)).toBeUndefined()
    expect(context.res.body).toEqual(`I edited the comment: appended-comment-body-existing comment body

The workflow run [was started](dispatched-workflow-build-and-deploy.yml).`)
    expect(mockQueueCheckRun).toHaveBeenCalledTimes(1)
    expect(mockUpdateCheckRun).toHaveBeenCalledTimes(1)
    expect(dispatchedWorkflows.map(e => e.payload.inputs.architecture)).toEqual(['i686'])
})

testIssueComment('/deploy mingw-w64-llvm', {
    issue: {
        number: 115,
        title: 'clang: update to 18.1.6',
        body: '',
        pull_request: {
            html_url: 'https://github.com/git-for-windows/MINGW-packages/pull/115'
        }
    },
    repository: {
        name: 'MINGW-packages'
    }
}, async (context) => {
    expect(await index(context, context.req)).toBeUndefined()
    expect(context.res.body).toEqual(`I edited the comment: appended-comment-body-existing comment body

The workflow run [was started](dispatched-workflow-build-and-deploy.yml).`)
    expect(mockQueueCheckRun).toHaveBeenCalledTimes(1)
    expect(mockUpdateCheckRun).toHaveBeenCalledTimes(1)
    expect(dispatchedWorkflows.map(e => e.payload.inputs.architecture)).toEqual(['aarch64'])
})

testIssueComment('/deploy', {
    issue: {
        number: 115,
        title: 'clang: update to 18.1.6',
        body: '',
        pull_request: {
            html_url: 'https://github.com/git-for-windows/MINGW-packages/pull/115'
        }
    },
    repository: {
        name: 'MINGW-packages'
    }
}, async (context) => {
    expect(await index(context, context.req)).toBeUndefined()
    expect(context.res.body).toEqual(`I edited the comment: appended-comment-body-existing comment body

The workflow run [was started](dispatched-workflow-build-and-deploy.yml).`)
    expect(mockQueueCheckRun).toHaveBeenCalledTimes(1)
    expect(mockUpdateCheckRun).toHaveBeenCalledTimes(1)
    expect(dispatchedWorkflows.map(e => e.payload.inputs.architecture)).toEqual(['aarch64'])
    expect(dispatchedWorkflows.map(e => e.payload.inputs.package)).toEqual(['mingw-w64-llvm'])
})

testIssueComment('/deploy libkbsa', {
    issue: {
        number: 153,
        title: 'i686: build newest version of libksba, because gnupg requires at least v1.6.3',
        body: 'I just tried to deploy gnupg v2.4.4 but it failed in the deploy-i686 job because of an outdated libksba package. We used to benefit from MSYS2\'s updates, but for the i686 variant there are no more updates of the MSYS packages, therefore we have to build it ourselves now.',
        pull_request: {
            html_url: 'https://github.com/git-for-windows/MSYS2-packages/pull/153'
        }
    },
    repository: {
        name: 'MSYS2-packages'
    }
}, async (context) => {
    expect(await index(context, context.req)).toBeUndefined()
    expect(context.res.body).toEqual(`I edited the comment: appended-comment-body-existing comment body

The workflow run [was started](dispatched-workflow-build-and-deploy.yml).`)
    expect(mockQueueCheckRun).toHaveBeenCalledTimes(1)
    expect(mockUpdateCheckRun).toHaveBeenCalledTimes(1)
    expect(dispatchedWorkflows.map(e => e.payload.inputs.architecture)).toEqual(['i686'])
})

const missingURL = 'https://wingit.blob.core.windows.net/x86-64/mingw-w64-x86_64-git-lfs-3.4.0-1-any.pkg.tar.xz'
const mockDoesURLReturn404 = jest.fn(url => url === missingURL)
jest.mock('../GitForWindowsHelper/https-request', () => {
    return { doesURLReturn404: mockDoesURLReturn404 }
})

testIssueComment('/add release note', {
    issue: {
        number: 4281,
        labels: [{ name: 'component-update' }],
        title: '[New gnutls version] GnuTLS 3.8.0',
        body: `Released a bug-fix and enhancement release on the 3.8.x branch.[GnuTLS 3.8.0](https://lists.gnupg.org/pipermail/gnutls-help/2023-February/004816.html)

Added the security advisory.[GNUTLS-SA-2020-07-14](security-new.html#GNUTLS-SA-2020-07-14)

http://www.gnutls.org/news.html#2023-02-10`
    }
}, async (context) => {
    expect(await index(context, context.req)).toBeUndefined()
    expect(context.res).toEqual({
        body: `I edited the comment: appended-comment-body-existing comment body

The workflow run [was started](dispatched-workflow-add-release-note.yml)`,
        headers: undefined,
        status: undefined
    })
    expect(mockGetInstallationAccessToken).toHaveBeenCalledTimes(1)
    expect(mockGitHubApiRequestAsApp).not.toHaveBeenCalled()
    expect(mockDoesURLReturn404).toHaveBeenCalledTimes(5)
    expect(dispatchedWorkflows).toHaveLength(1)
    expect(dispatchedWorkflows[0].payload.inputs).toEqual({
        message: 'Comes with [GNU TLS v3.8.0](https://lists.gnupg.org/pipermail/gnutls-help/2023-February/004816.html).',
        type: 'feature'
    })
})

testIssueComment({ comment: '/add release note', note: 'missing deployment' }, {
    issue: {
        number: 4523,
        labels: [{ name: 'component-update' }],
        title: '[New git-lfs version] v3.4.0',
        body: `https://github.com/git-lfs/git-lfs/releases/tag/v3.4.0`
    }
}, async (context) => {
    expect(await index(context, context.req)).toBeUndefined()
    expect(context.res).toEqual({
        body: `The following deployment(s) are missing:

* https://wingit.blob.core.windows.net/x86-64/mingw-w64-x86_64-git-lfs-3.4.0-1-any.pkg.tar.xz`,
        headers: undefined,
        status: 500
    })
    expect(mockGetInstallationAccessToken).toHaveBeenCalledTimes(1)
    expect(mockGitHubApiRequestAsApp).not.toHaveBeenCalled()
    expect(mockDoesURLReturn404).toHaveBeenCalledTimes(3)
    expect(dispatchedWorkflows).toHaveLength(0)
})

test('a completed `tag-git` run triggers `git-artifacts` runs', async () => {
    const context = makeContext({
        action: 'completed',
        check_run: {
            name: 'tag-git',
            head_sha: 'c8edb521bdabec14b07e9142e48cab77a40ba339',
            conclusion: 'success',
            details_url: 'https://url-to-tag-git/',
            output: {
                title: 'Tag Git v2.40.0-rc1.windows.1 @c8edb521bdabec14b07e9142e48cab77a40ba339',
                summary: 'Tag Git v2.40.0-rc1.windows.1 @c8edb521bdabec14b07e9142e48cab77a40ba339',
                text: 'For details, see [this run](https://github.com/git-for-windows/git-for-windows-automation/actions/runs/4322343196).\nTagged Git v2.40.0-rc1.windows.1\nDone!.'
            }
        },
        installation: {
            id: 123
        },
        repository: {
            name: 'git',
            owner: {
                login: 'git-for-windows'
            },
            full_name: 'git-for-windows/git'
        }
    }, {
        'x-github-event': 'check_run'
    })

    try {
        expect(await index(context, context.req)).toBeUndefined()
        expect(context.res).toEqual({
            body: `git-artifacts-x86_64 run already exists at <url-to-existing-x86_64-run>.
The \`git-artifacts-i686\` workflow run [was started](dispatched-workflow-git-artifacts.yml).
The \`git-artifacts-aarch64\` workflow run [was started](dispatched-workflow-git-artifacts.yml).
`,
            headers: undefined,
            status: undefined
        })
        expect(mockGitHubApiRequest).toHaveBeenCalled()
        expect(mockGitHubApiRequest.mock.calls[0].slice(1)).toEqual([
            'installation-access-token',
            'POST',
            '/repos/git-for-windows/git-for-windows-automation/actions/workflows/git-artifacts.yml/dispatches', {
                ref: 'main',
                inputs: {
                    architecture: 'i686',
                    tag_git_workflow_run_id: "4322343196"
                }
            }
        ])
    } catch (e) {
        context.log.mock.calls.forEach(e => console.log(e[0]))
        throw e;
    }
})

testIssueComment('/git-artifacts', {
    issue: {
        number: 4322,
        title: 'Rebase to v2.40.0-rc1',
        pull_request: {
            html_url: 'https://github.com/git-for-windows/git/pull/4322'
        }
    }
}, async (context) => {
    expect(await index(context, context.req)).toBeUndefined()
    expect(context.res).toEqual({
        body: `I edited the comment: appended-comment-body-existing comment body

The \`tag-git\` workflow run [was started](dispatched-workflow-tag-git.yml)`,
        headers: undefined,
        status: undefined
    })
    expect(mockGetInstallationAccessToken).toHaveBeenCalledTimes(1)
    expect(mockGitHubApiRequestAsApp).not.toHaveBeenCalled()
    expect(dispatchedWorkflows).toHaveLength(1)
    expect(dispatchedWorkflows[0].html_url).toEqual('dispatched-workflow-tag-git.yml')
    expect(dispatchedWorkflows[0].payload.inputs).toEqual({
        owner: 'git-for-windows',
        repo: 'git',
        rev: 'c8edb521bdabec14b07e9142e48cab77a40ba339',
        snapshot: 'false'
    })

    jest.clearAllMocks()
    dispatchedWorkflows.splice(0, dispatchedWorkflows.length) // empty the array

    // with existing `tag-git` run
    context.req.body.issue = {
        number: 4323,
        title: 'Rebase to v2.40.0-rc1½',
        pull_request: {
            html_url: 'https://github.com/git-for-windows/git/pull/4323'
        }
    }

    expect(await index(context, context.req)).toBeUndefined()
    expect(context.res).toEqual({
        body: `I edited the comment: appended-comment-body-existing comment body

The \`git-artifacts-x86_64\` workflow run [was started](dispatched-workflow-git-artifacts.yml).
The \`git-artifacts-i686\` workflow run [was started](dispatched-workflow-git-artifacts.yml).
The \`git-artifacts-aarch64\` workflow run [was started](dispatched-workflow-git-artifacts.yml).
`,
        headers: undefined,
        status: undefined
    })
    expect(mockGetInstallationAccessToken).toHaveBeenCalled()
    expect(mockGitHubApiRequestAsApp).not.toHaveBeenCalled()
    expect(dispatchedWorkflows).toHaveLength(3)
    expect(dispatchedWorkflows[0].html_url).toEqual('dispatched-workflow-git-artifacts.yml')
    expect(dispatchedWorkflows[0].payload.inputs).toEqual({
        architecture: 'aarch64',
        tag_git_workflow_run_id: "341"
    })
    expect(dispatchedWorkflows[1].html_url).toEqual('dispatched-workflow-git-artifacts.yml')
    expect(dispatchedWorkflows[1].payload.inputs).toEqual({
        architecture: 'i686',
        tag_git_workflow_run_id: "341"
    })
    expect(dispatchedWorkflows[2].html_url).toEqual('dispatched-workflow-git-artifacts.yml')
    expect(dispatchedWorkflows[2].payload.inputs).toEqual({
        architecture: 'x86_64',
        tag_git_workflow_run_id: "341"
    })
})

testIssueComment('/release', {
    issue: {
        number: 4328,
        title: 'Rebase to v2.40.0-rc2',
        pull_request: {
            html_url: 'https://github.com/git-for-windows/git/pull/4328'
        }
    }
}, async (context) => {
    expect(await index(context, context.req)).toBeUndefined()
    expect(context.res).toEqual({
        body: `I edited the comment: appended-comment-body-existing comment body

The \`release-git\` workflow run [was started](dispatched-workflow-release-git.yml)`,
        headers: undefined,
        status: undefined
    })
    expect(mockGetInstallationAccessToken).toHaveBeenCalledTimes(1)
    expect(mockGitHubApiRequestAsApp).not.toHaveBeenCalled()
    expect(dispatchedWorkflows).toHaveLength(1)
    expect(dispatchedWorkflows[0].html_url).toEqual('dispatched-workflow-release-git.yml')
    expect(dispatchedWorkflows[0].payload.inputs).toEqual({
        git_artifacts_x86_64_workflow_run_id: "8664",
        git_artifacts_i686_workflow_run_id: "686",
        git_artifacts_aarch64_workflow_run_id: "64"
    })
})

test('a completed `release-git` run updates the `main` branch in git-for-windows/git', async () => {
    const context = makeContext({
        action: 'completed',
        repository: {
            full_name: 'git-for-windows/git-for-windows-automation'
        },
        sender: {
            login: 'a-member'
        },
        workflow_run: {
            id: 54321,
            path: '.github/workflows/release-git.yml',
            conclusion: 'success',
            event: 'workflow_dispatch',
            head_branch: 'main',
        }
    }, {
        'x-github-event': 'workflow_run'
    })

    try {
        expect(await index(context, context.req)).toBeUndefined()
        expect(context.res).toEqual({
            body: `Took care of pushing the \`main\` branch to close PR 765`,
            headers: undefined,
            status: undefined
        })
        expect(mockGitHubApiRequest).toHaveBeenCalledTimes(4)
        expect(mockGitHubApiRequest.mock.calls[3].slice(1)).toEqual([
            'installation-access-token',
            'PATCH',
            '/repos/git-for-windows/git/git/refs/heads/main', {
                sha: 'c0ffee1ab7e',
                force: false
            }
        ])
    } catch (e) {
        context.log.mock.calls.forEach(e => console.log(e[0]))
        throw e;
    }
})

test('the third completed `git-artifacts-<arch>` check-run triggers an `upload-snapshot`', async () => {
    const context = makeContext({
        action: 'completed',
        check_run: {
            name: 'git-artifacts-aarch64',
            head_sha: '0c796d3013a57e8cc894c152f0200107226e5dd1',
            status: 'completed',
            conclusion: 'success',
            details_url: 'https://url-to-git-artifacts-aarch64/',
            output: {
                title: 'Build Git v2.48.0-rc2.windows.1-472-g0c796d3013-20250128120446 artifacts',
                summary: 'Build Git v2.48.0-rc2.windows.1-472-g0c796d3013-20250128120446 artifacts from commit 0c796d3013a57e8cc894c152f0200107226e5dd1 (tag-git run #13009996573)',
                text: 'For details, see [this run](https://github.com/git-for-windows/git-for-windows-automation/actions/runs/13010016895).'
            }
        },
        installation: {
            id: 123
        },
        repository: {
            name: 'git',
            owner: {
                login: 'git-for-windows'
            },
            full_name: 'git-for-windows/git'
        }
    }, {
        'x-github-event': 'check_run'
    })

    try {
        expect(await index(context, context.req)).toBeUndefined()
        expect(context.res).toEqual({
            body: `The 'upload-snapshot' workflow run was started at dispatched-workflow-upload-snapshot.yml (ahead by 0, behind by 99)`,
            headers: undefined,
            status: undefined
        })
        expect(mockGitHubApiRequest).toHaveBeenCalled()
        expect(mockGitHubApiRequest.mock.calls[0].slice(1)).toEqual([
            'installation-access-token',
            'GET',
            '/repos/git-for-windows/git-snapshots/releases/tags/prerelease-2.48.0-rc2.windows.1-472-g0c796d3013-20250128120446'
        ])
        expect(mockGitHubApiRequest.mock.calls[2].slice(1)).toEqual([
            'installation-access-token',
            'POST',
            '/repos/git-for-windows/git-for-windows-automation/actions/workflows/upload-snapshot.yml/dispatches', {
                ref: 'main',
                inputs: {
                    git_artifacts_aarch64_workflow_run_id: "13010016895",
                    git_artifacts_i686_workflow_run_id: "13010015938",
                    git_artifacts_x86_64_workflow_run_id: "13010015190"
                }
            }
        ])
    } catch (e) {
        context.log.mock.calls.forEach(e => console.log(e[0]))
        throw e;
    }
})

test('a `push` triggers a `tag-git` or an `upload-snapshot` run', async () => {
    const context = makeContext({
        ref: 'refs/heads/main',
        after: 'no-tag-git-yet',
        installation: {
            id: 123
        },
        repository: {
            name: 'git',
            owner: {
                login: 'git-for-windows'
            },
            full_name: 'git-for-windows/git'
        }
    }, {
        'x-github-event': 'push'
    })

    try {
        expect(await index(context, context.req)).toBeUndefined()
        expect(context.res).toEqual({
            body: `The 'tag-git' workflow run was started at dispatched-workflow-tag-git.yml`,
            headers: undefined,
            status: undefined
        })
    } catch (e) {
        context.log.mock.calls.forEach(e => console.log(e[0]))
        throw e;
    }

    context.req.body.after = '88811'
    try {
        expect(await index(context, context.req)).toBeUndefined()
        expect(context.res).toEqual({
            body: `The 'upload-snapshot' workflow run was started at dispatched-workflow-upload-snapshot.yml`,
            headers: undefined,
            status: undefined
        })
    } catch (e) {
        context.log.mock.calls.forEach(e => console.log(e[0]))
        throw e;
    }
})
