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

let mockGitHubApiRequest = jest.fn((_context, _token, method, requestPath, payload) => {
    if (method === 'POST' && requestPath.endsWith('/comments')) return {
        id: -124,
        html_url: `new-comment-url-${payload.body}`
    }
})
jest.mock('../GitForWindowsHelper/github-api-request', () => {
    return mockGitHubApiRequest
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

const testIssueComment = (comment, fn) => {
    const context = makeContext({
        action: 'created',
        comment: {
            body: comment,
            html_url: 'https://github.com/git-for-windows/git/issues/0',
            id: 0,
            user: {
                login: 'statler and waldorf'
            }
        },
        installation: {
            id: 123
        },
        issue: {
            number: 0
        },
        repository: {
            name: 'git',
            owner: {
                login: 'git-for-windows'
            }
        }
    }, {
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
