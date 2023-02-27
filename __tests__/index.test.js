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
    if (method === 'POST' && requestPath.endsWith('/reactions')) return {
        id: `new-reaction-${payload.content}`
    }
    if (method === 'POST' && requestPath === '/graphql') {
        if (payload.query.startsWith('query CollaboratorPermission')) return {
            data: {
                repository:{
                    collaborators: {
                        edges: [{ permission: 'WRITE'}]
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

    test(`test ${comment}`, async () => {
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

let mockSearchIssues = jest.fn(() => [])
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
