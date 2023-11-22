(async () => {
    const fs = require('fs')

    const localSettings = JSON.parse(fs.readFileSync('local.settings.json'))
    process.env.GITHUB_APP_ID = localSettings.Values.GITHUB_APP_ID
    process.env.GITHUB_APP_PRIVATE_KEY = localSettings.Values.GITHUB_APP_PRIVATE_KEY

    const gitHubRequestAsApp = require('./GitForWindowsHelper/github-api-request-as-app')
    const answer = await gitHubRequestAsApp(console, 'GET', '/app/installations?per_page=100')
    for (const e of answer.filter(e => e.account.login !== 'git-for-windows' && e.account.login !== 'dscho')) {
        console.log(`Deleting installation ${e.id} for ${e.account.login}`)
        await gitHubRequestAsApp(console, 'DELETE', `/app/installations/${e.id}`)
    }
})().catch(console.log)