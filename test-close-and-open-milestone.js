(async () => {
    const owner = 'git-for-windows'
    const repo = 'git'

    const fs = require('fs')
    const localSettings = JSON.parse(fs.readFileSync('local.settings.json'))
    Object.entries(localSettings.Values).forEach(([key, value]) => process.env[key] = value)

    const getInstallationIdForRepo = require('./GitForWindowsHelper/get-installation-id-for-repo')
    const installationId = await getInstallationIdForRepo(console, owner, repo)

    const getInstallationAccessToken = require('./GitForWindowsHelper/get-installation-access-token')
    const token = await getInstallationAccessToken(console, installationId)

    const { getCurrentMilestone, closeMilestone, openNextReleaseMilestone } = require('./GitForWindowsHelper/milestones')
    const current = await getCurrentMilestone(console, token, owner, repo)
    if (current.open_issues > 0) throw new Error(`Milestone ${current.title} has ${current.open_issues} open issue(s)!`)
    await closeMilestone(console, token, owner, repo, current.number, current.due_on ? false : (new Date()).toISOString())
    await openNextReleaseMilestone(console, token, owner, repo)
})().catch(console.log)