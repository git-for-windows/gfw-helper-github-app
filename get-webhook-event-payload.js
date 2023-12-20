(async () => {
    const fs = require('fs')

    let eventType = undefined
    let aroundDate = undefined

    // parse arguments, e.g. --event-type=check_run --date='Tue, 21 Nov 2023 11:13:12 GMT'
    const args = process.argv.slice(2)
    while (args.length) {
        let option = args.shift()

        const optionWithArgument = option.match(/^(--[^=]+)=(.*)$/)
        if (optionWithArgument) {
            option = optionWithArgument[1]
            args.unshift(optionWithArgument[2])
        }

        const getArg = () => {
            if (!args.length) throw new Error(`'${option} requires an argument!`)
            return args.shift()
        }

        if (option === '--event-type') eventType = getArg()
        else if (option === '--date') {
            const arg = getArg()
            if (isNaN(Date.parse(arg))) throw new Error(`--date requires a valid date (got '${arg}')`)
            aroundDate = new Date(arg)
        } else
            throw new Error(`Unhandled option: '${option}`)
    }

    const since = aroundDate ? aroundDate.getTime() - 5 * 60 * 1000 : undefined // 5 minutes before
    const until = aroundDate ? aroundDate.getTime() + 5 * 60 * 1000 : undefined // 5 minutes after

    const localSettings = JSON.parse(fs.readFileSync('local.settings.json'))
    process.env.GITHUB_APP_ID = localSettings.Values.GITHUB_APP_ID
    process.env.GITHUB_APP_PRIVATE_KEY = localSettings.Values.GITHUB_APP_PRIVATE_KEY

    const gitHubRequestAsApp = require('./GitForWindowsHelper/github-api-request-as-app')

    const getAtCursor = async cursor => {
        const answer = await gitHubRequestAsApp(console, 'GET', `/app/hook/deliveries?per_page=30${cursor ? `&cursor=${cursor}` : ''}`)
        answer.forEach(e => {
            e.epoch = (new Date(e.delivered_at)).getTime()
        })
        // sort newest to oldest
        answer.sort((a, b) => b.epoch - a.epoch)
        const events = answer.filter(e => {
            if (eventType && e.event !== eventType) return false
            if (since && e.epoch < since) return false
            if (until && e.epoch > until) return false
            return true
        })
        const newest = answer.shift()
        const oldest = answer.pop() || newest
        return {
            events, newest, oldest
        }
    }

    const getMatchingEvents = async () => {
        let answer = await getAtCursor()

        if (!since || !until || answer.newest === answer.oldest) return answer.events

        if (answer.oldest.epoch < since) return answer.events

        if (answer.oldest.epoch > until) {
            let tooNew = answer.oldest
            // first find a good starting cursor
            while (answer.oldest.epoch > until) {
                tooNew = answer.oldest

                const rate = (answer.newest.id - answer.oldest.id) / (answer.newest.epoch - answer.oldest.epoch)
                let cursor = Math.floor(answer.oldest.id - rate * (answer.oldest.epoch - until))
                answer = await getAtCursor(cursor)
            }

            while (answer.newest.epoch < until) {
                const tooOldID = answer.newest.id
                // we overshot, now the time window does not include `until`, backtrack via bisecting
                const rate = (tooNew.id - answer.newest.id) / (tooNew.epoch - answer.newest.epoch)
                let cursor = Math.floor(tooNew.id - rate * (tooNew.epoch - until))
                answer = await getAtCursor(cursor)
                // if we received events from the same time window, shift back by the same amount
                while (tooOldID === answer.newest.id) {
                    cursor += (cursor - tooOldID)
                    answer = await getAtCursor(cursor)
                }
            }

            while (answer.oldest.epoch > until) {
                // we overshot, maybe again, now even the oldest is too new
                answer = await getAtCursor(answer.oldest.id - 1)
            }
        }

        const events = [...answer.events]
        while (answer.oldest.epoch > since) {
            answer = await getAtCursor(answer.oldest.id - 1)
            events.push([...answer.events])
        }

        return events
    }

    const events = await getMatchingEvents()
    for (const e of events) {
        const fullEvent = await gitHubRequestAsApp(console, 'GET', `/app/hook/deliveries/${e.id}`)
        console.log(`id: ${e.id}\naction: ${e.action}\nevent: ${JSON.stringify(fullEvent, null, 2)}`)
    }
})().catch(console.log)