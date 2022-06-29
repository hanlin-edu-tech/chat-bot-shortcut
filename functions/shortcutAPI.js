const fetch = require('node-fetch')

const SHORTCUT_API = 'https://api.app.shortcut.com/api/v3'

async function publishStory(name, description, requesterMail = '', setting) {
    const members = await getMembers()
    setting.owners = getMemberIdFrompProfileKey(setting.owners, members)
    if (requesterMail) {
        setting.followers = getMemberIdFrompProfileKey([requesterMail], members, 'email_address')
        setting.requester = setting.followers[0]
    }
    const data = await generateStoryData(name, description, setting)

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

async function getProjects(workflowName = '') {
    const resWorkflow = await fetch('https://api.app.shortcut.com/api/v3/workflows', {
        method: 'GET',
        headers: {
            'content-type': 'application/json',
            'shortcut-token': process.env.SHORTCUT_API_TOKEN
        }
    })
    const workflows = await resWorkflow.json()
    const workflowId = workflows.filter(workflow => workflow.name === workflowName)[0].id

    const res = await fetch('https://api.app.shortcut.com/api/v3/projects', {
        method: 'GET',
        headers: {
            'content-type': 'application/json',
            'shortcut-token': process.env.SHORTCUT_API_TOKEN
        }
    })
    const projects = (await res.json()).filter(project => project.workflow_id === workflowId)
    const projectItems = projects.map(project => {
        let owner = project.description.match(/[\w\-.]*@ehanlin.com.tw/) || []
        owner = owner.length ? owner[0] : ''

        return {
            text: project.name,
            value: `${project.id}:${owner}`,
            selected: false
        }
    })

    return projectItems
}

module.exports.publishStory = publishStory
module.exports.getProjects = getProjects