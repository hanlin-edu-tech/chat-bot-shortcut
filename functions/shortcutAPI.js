const fetch = require('node-fetch')

const SHORTCUT_API = 'https://api.app.shortcut.com/api/v3'
const DEFAULT_SETTING = {
    owners: ['徐嘉徽'],
    storyType: 'bug',
    workflow: '工程-執行',
    state: '待辦',
    workDays: 3
}

async function publishStory(name, description, requesterMail = '') {
    const members = await getMembers()
    DEFAULT_SETTING.owners = getMemberIdFrompProfileKey(DEFAULT_SETTING.owners, members)
    if (requesterMail) {
        DEFAULT_SETTING.followers = getMemberIdFrompProfileKey([requesterMail], members, 'email_address')
        DEFAULT_SETTING.requester = DEFAULT_SETTING.followers[0]
    }
    const data = await generateStoryData(name, description, DEFAULT_SETTING)

    const res = await fetch(`${SHORTCUT_API}/stories`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'shortcut-token': process.env.SHORTCUT_API_TOKEN
        },
        body: JSON.stringify(data)
    })
    // console.log(data)
    // const res = { status: 201 }

    return res
}

async function getMembers() {
    const res = await fetch(`${SHORTCUT_API}/members`, {
        method: 'GET',
        headers: {
            'content-type': 'application/json',
            'shortcut-token': process.env.SHORTCUT_API_TOKEN
        }
    })
    return await res.json()
}

function getMemberIdFrompProfileKey(list, members, key = 'name') {
    const memberId = []

    for (let member of members) {
        if (list.includes(member.profile[key])) {
            memberId.push(member.id)
        }
    }
    return memberId
}

async function generateStoryData(name, description, { owners = [], followers = [], requester = '', storyType, workflow, state, startAt = new Date(), workDays }) {
    const states = await getWorkflowStates(workflow)
    const stateId = states.find(s => s.name === state).id || ''
    const started_at_override = startAt.toISOString()
    const msPerDay = 24 * 60 * 60 * 1000
    const deadline = (new Date(startAt.getTime() + workDays * msPerDay)).toISOString()

    return {
        deadline,
        description,
        follower_ids: followers,
        name,
        owner_ids: owners,
        requested_by_id: requester,
        started_at_override,
        story_type: storyType,
        workflow_state_id: stateId
    }
}

async function getWorkflowStates(workflowName = '') {
    const res = await fetch(`${SHORTCUT_API}/workflows`, {
        method: 'GET',
        headers: {
            'content-type': 'application/json',
            'shortcut-token': process.env.SHORTCUT_API_TOKEN
        }
    })
    const workflows = await res.json()
    const states = []

    for (let key in workflows) {
        if (!workflowName || workflows[key].name === workflowName) {
            states.push(...workflows[key].states)
        }
    }

    return states
}

module.exports = publishStory