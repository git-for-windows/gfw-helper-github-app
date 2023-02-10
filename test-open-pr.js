#!/usr/bin/env node

(async () => {
    // Expect a URL
    const url = process.argv[2]
    const match = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)\/?$/)
    if (!match) throw new Error(`Unhandled URL: ${url}`)
    const [, owner, repo, number ] = match

    const githubApiRequest = require('./GitForWindowsHelper/github-api-request')
    const { title, body } = await githubApiRequest(
        console,
        null,
        'GET',
        `/repos/${owner}/${repo}/issues/${number}`
    )

    const { guessComponentUpdateDetails } = require('./GitForWindowsHelper/component-updates')
    const details = await guessComponentUpdateDetails(title, body)
    console.log(details)
})().catch(console.log)
