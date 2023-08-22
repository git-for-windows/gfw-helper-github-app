const gently = require('./gently')

const httpsRequest = async (context, hostname, method, requestPath, body, headers) => {
    headers = {
        'User-Agent': 'GitForWindowsHelper/0.0',
        Accept: 'application/json',
        ...headers || {}
    }
    if (body) {
        if (typeof body === 'object') body = JSON.stringify(body)
        headers['Content-Type'] = 'application/json'
        headers['Content-Length'] = body.length
    }
    const options = {
        port: 443,
        hostname: hostname || 'api.github.com',
        method: method || 'GET',
        path: requestPath,
        headers
    }
    return new Promise((resolve, reject) => {
        try {
            const https = require('https')
            const req = https.request(options, res => {
                res.on('error', e => reject(e))

                if (res.statusCode === 204) resolve({
                    statusCode: res.statusCode,
                    statusMessage: res.statusMessage,
                    headers: res.headers
                })

                const chunks = []
                res.on('data', data => chunks.push(data))
                res.on('end', () => {
                    const json = Buffer.concat(chunks).toString('utf-8')
                    if (res.statusCode > 299) {
                        reject({
                            statusCode: res.statusCode,
                            statusMessage: res.statusMessage,
                            requestMethod: options.method,
                            requestPath: options.path,
                            body: json,
                            json: gently(() => JSON.parse(json))
                        })
                        return
                    }
                    try {
                        resolve(JSON.parse(json))
                    } catch (e) {
                        reject(`Invalid JSON: ${json}`)
                    }
                })
            })
            req.on('error', err => reject(err))
            if (body) req.write(body)
            req.end()
        } catch (e) {
            reject(e)
        }
    })
}

const doesURLReturn404 = async url => {
    const match = url.match(/^https:\/\/([^/]+?)(:\d+)?(\/.*)?$/)
    if (!match) throw new Error(`Could not parse URL ${url}`)

    const https = require('https')
    const options = {
        method: 'HEAD',
        host: match[1],
        port: Number.parseInt(match[2] || '443'),
        path: match[3] || '/'
    }
    return new Promise((resolve, reject) => {
        https.request(options, res => {
            if (res.error) reject(res.error)
            else if (res.statusCode === 404) resolve(true)
            else if (res.statusCode === 200) resolve(false)
            else reject(`Unexpected statusCode: ${res.statusCode}`)
        }).end()
    })
}

module.exports = {
    httpsRequest,
    doesURLReturn404
}