const fetch = require('node-fetch')

const SHORTCUT_API = 'https://api.app.shortcut.com/api/v3'
const emailRegex = /[\w\-.]*@\w*\.com\.tw/

async function publishStory(name, description, requesterMail = '', setting) {
    const members = await getMembers()

    if (setting.owners[0].match(emailRegex)) {
        setting.owners = getMemberIdFrompProfileKey(setting.owners, members, 'email_address')
    } else {
        setting.owners = getMemberIdFrompProfileKey(setting.owners, members)
    }

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

async function generateStoryData(name, description, { template_id, owners = [], followers = [], requester = '', storyType, workflow, state, project = '', priority, startAt = new Date(), workDays }) {
    const states = await getWorkflowStates(workflow)
    const stateId = states.find(s => s.name === state).id || ''
    const started_at_override = startAt.toISOString()
    const msPerDay = 24 * 60 * 60 * 1000
    const deadline = workDays ? (new Date(startAt.getTime() + workDays * msPerDay)).toISOString() : ''
    const custom_fields = []

    if (priority && priority !== 'None') {
        const priorityField = await getCustomField('Priority')
        custom_fields.push({
            field_id: priorityField.id,
            value: priority,
            value_id: priorityField.values.filter(i => i.value === priority)[0].id
        })
    }

    switch (template_id) {
        case 1:
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
        case 2:
            return {
                custom_fields,
                description,
                follower_ids: followers,
                name,
                owner_ids: owners,
                project_id: project,
                requested_by_id: requester,
                started_at_override,
                story_type: storyType,
                workflow_state_id: stateId
            }
        default:
            return {}
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

async function getCustomField(fieldName = '') {
    const res = await fetch('https://api.app.shortcut.com/api/v3/custom-fields', {
        method: 'GET',
        headers: {
            'content-type': 'application/json',
            'shortcut-token': process.env.SHORTCUT_API_TOKEN
        }
    })
    const fields = await res.json()
    const field = fields.filter(field => field.name === fieldName)[0]

    return {
        id: field.id,
        values: field.values
    }
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
        let owner = project.description.match(emailRegex) || []
        owner = owner.length ? owner[0] : ''

        return {
            text: project.name,
            value: `${project.id}:${owner}`,
            selected: false
        }
    })

    return projectItems
}

async function isMemberExist(email) {
    const members = await getMembers()

    for (let member of members) {
        if (member.profile.email_address === email) {
            return true
        }
    }
    return false
}

module.exports.publishStory = publishStory
module.exports.getProjects = getProjects
module.exports.isMemberExist = isMemberExist
