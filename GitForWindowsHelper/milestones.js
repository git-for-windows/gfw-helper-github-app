const getCurrentMilestone = async (context, token, owner, repo) => {
    const githubApiRequest = require('./github-api-request')
    const milestones = await githubApiRequest(context, token, 'GET', `/repos/${owner}/${repo}/milestones?state=open`)
    if (milestones.length === 2) {
        const filtered = milestones.filter(m => m.title !== 'Next release')
        if (filtered.length === 1) milestones.splice(0, 2, filtered)
    }
    if (milestones.length !== 1) throw new Error(`Expected one milestone, got ${milestones.length}`)
    return milestones[0]
}

const closeMilestone = async (context, token, owner, repo, milestoneNumber, dueOn) => {
    const githubApiRequest = require('./github-api-request')
    const payload = {
        state: 'closed'
    }
    if (dueOn) payload.due_on = dueOn
    await githubApiRequest(context, token, 'PATCH', `/repos/${owner}/${repo}/milestones/${milestoneNumber}`, payload)
}

const openNextReleaseMilestone = async (context, token, owner, repo) => {
    const githubApiRequest = require('./github-api-request')
    const milestones = await githubApiRequest(context, token, 'GET', `/repos/${owner}/${repo}/milestones?state=open`)
    const filtered = milestones.filter(m => m.title === 'Next release')
    if (filtered.length === 1) return filtered[0]

    return await githubApiRequest(context, token, 'POST', `/repos/${owner}/${repo}/milestones`, {
        title: 'Next release'
    })
}

module.exports = {
    getCurrentMilestone,
    closeMilestone,
    openNextReleaseMilestone
}