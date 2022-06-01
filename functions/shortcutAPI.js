const fetch = require('node-fetch')
const SHORTCUT_API = 'https://api.app.shortcut.com/api/v3'
const DEFAULT_SETTING = {
    owners: ['熱狗', '徐嘉徽'],
    storyType: 'bug',
    workflow: '工程-執行',
    state: '待辦',
    workDays: 3
}

async function publishStory(name, description) {
    DEFAULT_SETTING.owners = await getMemberIdFromName(DEFAULT_SETTING.owners)
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

async function getMemberIdFromName(names) {
    const res = await fetch(`${SHORTCUT_API}/members`, {
        method: 'GET',
        headers: {
            'content-type': 'application/json',
            'shortcut-token': process.env.SHORTCUT_API_TOKEN
        }
    })
    const members = await res.json()
    const memberId = []

    for (let member of members) {
        if (names.includes(member.profile.name)) {
            memberId.push(member.id)
        }
    }
    return memberId
}

async function generateStoryData(name, description, { owners = [], storyType, workflow, state, startAt = new Date(Date.now()), workDays }) {
    const states = await getWorkflowStates(workflow)
    const stateId = getStateIdFromName(states, state)
    const started_at_override = startAt.toISOString()
    const deadline = (new Date(startAt.getTime() + workDays * 86400 * 1000)).toISOString()

    return {
        deadline,
        description,
        name,
        owner_ids: owners,
        started_at_override,
        story_type: storyType,
        workflow_state_id: stateId
    }
}

function getStateIdFromName(states, name) {
    for (let state of states) {
        if (state.name === name) {
            return state.id
        }
    }
    return -1
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