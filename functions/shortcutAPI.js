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

async function getProjects(workflowName = '', keyword = '') {
    try {
        const resWorkflow = await fetch('https://api.app.shortcut.com/api/v3/workflows', {
            method: 'GET',
            headers: {
                'content-type': 'application/json',
                'shortcut-token': process.env.SHORTCUT_API_TOKEN
            }
        })
        const workflows = await resWorkflow.json()

        const workflow = Array.isArray(workflows)
            ? workflows.find(w => w && w.name === workflowName)
            : null

        if (!workflow || !workflow.id) {
            return []
        }

        const res = await fetch('https://api.app.shortcut.com/api/v3/projects', {
            method: 'GET',
            headers: {
                'content-type': 'application/json',
                'shortcut-token': process.env.SHORTCUT_API_TOKEN
            }
        })
        const allProjects = await res.json()
        const projects = (Array.isArray(allProjects) ? allProjects : [])
            .filter(project => project && project.workflow_id === workflow.id)
            .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))

        // 關鍵字過濾（比對名稱，包含即可）
        const filtered = keyword
            ? projects.filter(p => String(p.name || '').toLowerCase().includes(String(keyword).toLowerCase()))
            : projects

        // 限制下拉項目數量，避免超過 Chat 對話框限制
        const LIMIT = 10
        const count = filtered.length
        const limited = filtered.slice(0, LIMIT)
        const projectItems = limited.map(project => {
            const desc = (project && project.description) ? project.description : ''
            let owner = desc ? (desc.match(emailRegex) || []) : []
            owner = owner.length ? owner[0] : ''

            return {
                text: String(project.name).slice(0, 80),
                value: `${project.id}:${owner}`,
                selected: false
            }
        })

        return { items: projectItems, hasMore: count > LIMIT, count }
    } catch (err) {
        return { items: [], hasMore: false, count: 0 }
    }
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
