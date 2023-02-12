const index = require('../GitForWindowsHelper/index')

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