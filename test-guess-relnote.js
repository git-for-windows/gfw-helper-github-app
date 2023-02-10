#!/usr/bin/env node

(async () => {
    // Expect a URL
    const url = process.argv[2]
    const match = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:issues|pulls?)\/(\d+)\/?$/)
    if (!match) throw new Error(`Unhandled URL: ${url}`)
    const [, owner, repo, number ] = match

    const githubApiRequest = require('./GitForWindowsHelper/github-api-request')
    const issue = await githubApiRequest(
        console,
        null,
        'GET',
        `/repos/${owner}/${repo}/issues/${number}`
    )

    const { guessReleaseNotes } = require('./GitForWindowsHelper/component-updates')
    const guessed = await guessReleaseNotes(console, issue)
    console.log(JSON.stringify(guessed, null, 2))
})().catch(console.log)
