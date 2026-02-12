const { google } = require('googleapis')
const chat = google.chat('v1')
const { Storage } = require('@google-cloud/storage')
const { v4: uuidv4 } = require('uuid')
const { publishStory, isMemberExist } = require('./shortcutAPI')
const { createSubmittedCard, createBugReportCard, createcComplaintReportCard } = require('./cards')

const GCS_BUCKET = 'chat-bot-attachment'
const GCS_HOST = 'https://storage.googleapis.com/chat-bot-attachment'

const BUG_REPORT_SETTING = {
    template_id: 1,
    owners: ['熱狗'],
    storyType: 'bug',
    workflow: '工程-執行',
    state: '待辦',
    workDays: 3
}

const COMPLAINT_REPORT_SETTING = {
    template_id: 2,
    owners: [],
    storyType: '',
    workflow: '專案主板',
    state: '客訴區',
    project: '',
    priority: ''
}

exports.convertToShortcut = async (req, res) => {
    if (req.method === 'GET' || !req.body.message) {
        return res.status(403).json({
            status: 'error',
            message: 'illegal request'
        })
    }

    const dialogEventType = req.body.dialogEventType ? req.body.dialogEventType : ''
    const message = req.body.message
    const { space } = message
    const senderEmail = message.sender.email
    let body = {}
    let commandId

    switch (dialogEventType) {
        case 'REQUEST_DIALOG':
            if (!(await isMemberExist(senderEmail))) {
                await sendMessageToSpace('開卡前請先向主管申請 Shortcut 帳號。', space.name)
                break
            }

            const attachment = message.attachment ? message.attachment : []
            const imageRef = getAttachmentRef(attachment, 'image')

            commandId = parseInt(message.slashCommand.commandId)
            switch (commandId) {
                case 1:
                    body = createBugReportCard({ imageRef }, { commandId })
                    break
                case 2:
                    body = await createcComplaintReportCard({ workflow: COMPLAINT_REPORT_SETTING.workflow, imageRef }, { commandId, isFirst: true })
                    break
            }

            break
        case 'SUBMIT_DIALOG':
            const formInputs = req.body.common.formInputs
            const invokedFunction = (req.body.common && req.body.common.invokedFunction) ? req.body.common.invokedFunction : 'SUBMIT'
            let isValid = true
            let createCard

            commandId = parseInt(formInputs.commandId.stringInputs.value[0])
            switch (commandId) {
                case 1:
                    createCard = createBugReportCard
                    break
                case 2:
                    createCard = createcComplaintReportCard
                    break
            }

            for (let key in formInputs) {
                formInputs[key] = formInputs[key].stringInputs.value[0]
            }
            formInputs.workflow = COMPLAINT_REPORT_SETTING.workflow

            // 若是搜尋專案（REFRESH），僅重繪卡片，不做驗證
            if (invokedFunction !== 'SUBMIT') {
                body = await createcComplaintReportCard(formInputs, { commandId, isFirst: true })
                break
            }

            // 送出時才驗證必填
            for (let key in formInputs) {
                if (!formInputs[key]) {
                    isValid = false
                }
            }

            if (!isValid) {
                body = await createCard(formInputs, { commandId })
                break
            }

            try {
                const { title, product, category, project, type, priority, imageRef } = formInputs
                const description = await addImageIntoDescription(formInputs.description, imageRef)
                let res

                switch (commandId) {
                    case 1:
                        res = await publishStory(`[${product}][${category}][${title}]`, description, senderEmail, BUG_REPORT_SETTING)
                        
                        break
                    case 2:
                        const temp = project.split(':')
                        COMPLAINT_REPORT_SETTING.owners = [temp[1]]
                        COMPLAINT_REPORT_SETTING.storyType = type
                        COMPLAINT_REPORT_SETTING.project = temp[0]
                        COMPLAINT_REPORT_SETTING.priority = priority

                        res = await publishStory(title, description, senderEmail, COMPLAINT_REPORT_SETTING)
                        break
                }

                if (res.status !== 201) {
                    body = await createCard(formInputs, { commandId, isError: true })
                    break
                }

                const storyUrl = (await res.json()).app_url
                // const storyUrl = ''
                let messageContent = ''

                switch (commandId) {
                    case 1:
                        messageContent = `*標題:* [${product}][${category}][${title}]\n*Story連結:* ${storyUrl}`
                        break
                    case 2:
                        messageContent = `已完成開卡\n\n*標題:* ${title}\n*Story連結:* ${storyUrl}\n\n卡片進度將會通過E-mail通知，請留意信件。`
                        break
                }

                try {
                    await sendMessageToSpace(messageContent, space.name)
                } catch (err) {
                    console.log(err)
                    body = createSubmittedCard(messageContent)
                }
            } catch (err) {
                body = await createCard(formInputs, { commandId, isError: true })
                console.log(err)
            }

            break
        default:
            return
    }

    const data = {
        action_response: {
            dialog_action: {
                dialog: {
                    body
                }
            },
            type: 'DIALOG'
        }
    }

    if (Object.keys(body).length) {
        return res.status(200).json(JSON.stringify(data))    
    }
    res.status(200).json(JSON.stringify({
        action_response: {
            dialog_action: {
                action_status: 'OK'
            },
            type: 'DIALOG'
        }
    }))
}

function getAttachmentRef(attachment, type = '') {
    if (attachment.length > 0 && attachment[0].contentType.includes(type)) {
        return `${attachment[0].contentType}:${attachment[0].attachmentDataRef.resourceName}`
    }
    return ''
}

async function addImageIntoDescription(description, imageRef = '') {
    if (!imageRef) {
        return description
    }

    const temp = imageRef.split(':')
    const imageType = temp[0].split('/')[1]
    const imageResourceName = temp[1]

    try {
        const auth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/chat.bot'] })
        const authClient = await auth.getClient()
        google.options({ auth: authClient })

        const res = await chat.media.download({ resourceName: `${imageResourceName}?alt=media` }, { responseType: 'arraybuffer' })
        
        const imageBuffer = Buffer.from(res.data)
        const destFileName = `${uuidv4()}.${imageType}`
        const storage = new Storage()

        await storage.bucket(GCS_BUCKET).file(destFileName).save(imageBuffer)

        return description += `\n![${destFileName}](${GCS_HOST}/${destFileName})`
    } catch (err) {
        console.log(err)
        return description
    }
}

async function sendMessageToSpace(message, space) {
    const auth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/chat.bot'] })
    const authClient = await auth.getClient()
    google.options({ auth: authClient })

    const res = await chat.spaces.messages.create({
        parent: space,
        requestBody: {
            text: message
        }
    })

    return res
}
