const { google } = require('googleapis')
const chat = google.chat('v1')
const { Storage } = require('@google-cloud/storage')
const { v4: uuidv4 } = require('uuid')
const { publishStory, getProjects } = require('./shortcutAPI')

const GCS_BUCKET = 'chat-bot-attachment'
const GCS_HOST = 'https://storage.googleapis.com/chat-bot-attachment'

const BUG_REPORT_SETTING = {
    template_id: 1,
    owners: ['徐嘉徽'],
    storyType: 'bug',
    workflow: '工程-執行',
    state: '待辦',
    workDays: 3
}

const COMPLAINT_REPORT_SETTING = {
    template_id: 2,
    owners: ['chhsu0421@ehanlin.com.tw'],
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
    let body = {}
    let commandId

    switch (dialogEventType) {
        case 'REQUEST_DIALOG':
            const attachment = message.attachment ? message.attachment : []
            const imageRef = getAttachmentRef(attachment, 'image')

            commandId = parseInt(message.slashCommand.commandId)
            switch (commandId) {
                case 1:
                    body = createBugReportCard({ imageRef }, commandId)
                    break
                case 2:
                    body = await createcComplaintReportCard({ imageRef }, commandId)
                    break
            }

            break
        case 'SUBMIT_DIALOG':
            const formInputs = req.body.common.formInputs
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
                if (!formInputs[key]) {
                    isValid = false
                }
            }

            if (!isValid) {
                body = await createCard(formInputs, commandId)
                break
            }

            try {
                const { title, product, category, project, type, priority, imageRef } = formInputs
                const description = await addImageIntoDescription(formInputs.description, imageRef)
                const senderEmail = message.sender.email
                let messageTitle = ''
                let res

                switch (commandId) {
                    case 1:
                        res = await publishStory(`[${product}][${category}][${title}]`, description, senderEmail, BUG_REPORT_SETTING)
                        messageTitle = `[${product}][${category}][${title}]`
                        break
                    case 2:
                        const temp = project.split(':')
                        // COMPLAINT_REPORT_SETTING.owners.push(temp[1])
                        COMPLAINT_REPORT_SETTING.storyType = type
                        COMPLAINT_REPORT_SETTING.project = temp[0]
                        COMPLAINT_REPORT_SETTING.priority = priority
                        messageTitle = title

                        res = await publishStory(title, description, senderEmail, COMPLAINT_REPORT_SETTING)
                        break
                }

                if (res.status !== 201) {
                    body = await createCard(formInputs, commandId, true)
                    break
                }

                const { space } = message
                const storyUrl = (await res.json()).app_url
                await sendMessageToSpace(`*標題:* ${messageTitle}\n*Story連結:* ${storyUrl}`, space.name)

                body = createSubmittedCard()
            } catch (err) {
                body = await createCard(formInputs, commandId, true)
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
    res.status(200).send(JSON.stringify(data))
}

function createSubmittedCard() {
    return {
        sections: [
            {
                widgets: [
                    {
                        decoratedText: {
                            topLabel: '',
                            text: '送出成功！',
                            startIcon: {
                                knownIcon: 'STAR',
                                altText: 'report submitted'
                            }
                        }
                    }
                ]
            }
        ]
    }
}

function createBugReportCard(names = { title: '', product: '', category: '', description: '', imageRef: '' }, commandId = -1, isError = false) {
    const error = {
        decoratedText: {
            topLabel: '',
            text: '回報過程發生問題，請稍後再試。',
            startIcon: {
                knownIcon: 'STAR',
                altText: 'report submitting error'
            }
        }
    }

    const hint = {
        decoratedText: {
            topLabel: '',
            text: '所有項目皆為必填！',
            startIcon: {
                knownIcon: 'STAR',
                altText: 'all fields are required'
            }
        }
    }

    const inputs = [
        {
            textInput: {
                label: '標題',
                type: 'SINGLE_LINE',
                name: 'title',
                value: names.title
            }
        },
        {
            textInput: {
                label: '產品名稱',
                type: 'SINGLE_LINE',
                name: 'product',
                value: names.product
            }
        },
        {
            textInput: {
                label: '分類',
                type: 'SINGLE_LINE',
                name: 'category',
                value: names.category
            }
        },
        {
            textInput: {
                label: '細節描述',
                type: 'MULTIPLE_LINE',
                name: 'description',
                value: names.description
            }
        }
    ]

    const commandIdTag = [
        {
            textInput: {
                label: `Command ID暫存(請勿更動)`,
                type: 'SINGLE_LINE',
                name: 'commandId',
                value: commandId
            }
        }
    ]

    const sections = []

    const widgetsSelectionInputs = []
    if (isError) {
        widgetsSelectionInputs.push(error, hint, ...inputs)
    } else {
        widgetsSelectionInputs.push(hint, ...inputs)
    }

    const widgetsImg = []
    if (names.imageRef) {
        widgetsImg.push({
            "textInput": {
                label: `圖片訊息暫存(請勿更動)`,
                type: 'SINGLE_LINE',
                name: 'imageRef',
                value: names.imageRef
            }
        })
        sections.push({ widgets: widgetsSelectionInputs }, { widgets: widgetsImg }, { widgets: commandIdTag })
    } else {
        sections.push({ widgets: widgetsSelectionInputs }, { widgets: commandIdTag })
    }

    return {
        sections,
        fixedFooter: {
            primaryButton: {
                text: '送出',
                onClick: {
                    action: {
                        function: 'SUBMIT'
                    }
                },
                altText: 'submit',
                color: {
                    red: 0.204,
                    green: 0.596,
                    blue: 0.859,
                    alpha: 1
                }
            }
        }
    }
}

async function createcComplaintReportCard(names = { project: '', type: '', priority: '', title: '', description: '', imageRef: '' }, commandId = -1, isError = false) {
    const error = {
        decoratedText: {
            topLabel: '',
            text: '回報過程發生問題，請稍後再試。',
            startIcon: {
                knownIcon: 'STAR',
                altText: 'report submitting error'
            }
        }
    }

    const hint = {
        decoratedText: {
            topLabel: '',
            text: '所有項目皆為必填！',
            startIcon: {
                knownIcon: 'STAR',
                altText: 'all fields are required'
            }
        }
    }

    const selectionInputs = [
        {
            selectionInput: {
                type: 'DROPDOWN',
                name: 'project',
                items: [
                    {
                        text: '專案',
                        value: '',
                        selected: true
                    }
                ]
            }
        },
        {
            selectionInput: {
                type: 'DROPDOWN',
                name: 'type',
                items: [
                    {
                        text: '類別',
                        value: '',
                        selected: true
                    },
                    {
                        text: '系統問題',
                        value: 'bug',
                        selected: true
                    },
                    {
                        text: '功能建議',
                        value: 'feature',
                        selected: true
                    }
                ]
            }
        },
        {
            selectionInput: {
                type: 'DROPDOWN',
                name: 'priority',
                items: [
                    {
                        text: '急迫性',
                        value: '',
                        selected: true
                    },
                    {
                        text: '特急件 (需立即處理；開卡後請同步電話通知企劃)',
                        value: 'Highest',
                        selected: false
                    },
                    {
                        text: '急件 (需三天內處理；開卡後請同步chat通知企劃)',
                        value: 'High',
                        selected: false
                    },
                    {
                        text: '正常 (依正常時程處理；不需另外通知)',
                        value: 'None',
                        selected: false
                    }
                ]
            }
        }
    ]
    const projects = await getProjects(COMPLAINT_REPORT_SETTING.workflow)
    selectionInputs[0].selectionInput.items.push(...projects)

    selectionInputs.forEach(item => {
        const selectedValue = names[item.selectionInput.name]
        item.selectionInput.items.forEach(item => {
            item.selected = item.value === selectedValue ? true : false
        })        
    })

    const inputs = [
        {
            textInput: {
                label: '標題',
                type: 'SINGLE_LINE',
                name: 'title',
                value: names.title
            }
        },
        {
            textInput: {
                label: '說明',
                type: 'MULTIPLE_LINE',
                name: 'description',
                value: names.description
            }
        }
    ]

    const commandIdTag = [
        {
            textInput: {
                label: `Command ID暫存(請勿更動)`,
                type: 'SINGLE_LINE',
                name: 'commandId',
                value: commandId
            }
        }
    ]

    const sections = []

    const widgetsSelectionInputs = []
    if (isError) {
        widgetsSelectionInputs.push(error, hint, ...selectionInputs)
    } else {
        widgetsSelectionInputs.push(hint, ...selectionInputs)
    }

    const widgetsImg = []
    if (names.imageRef) {
        widgetsImg.push({
            "textInput": {
                label: `圖片訊息暫存(請勿更動)`,
                type: 'SINGLE_LINE',
                name: 'imageRef',
                value: names.imageRef
            }
        })
        sections.push({ widgets: widgetsSelectionInputs }, { widgets: inputs }, { widgets: widgetsImg }, { widgets: commandIdTag })
    } else {
        sections.push({ widgets: widgetsSelectionInputs }, { widgets: inputs }, { widgets: commandIdTag })
    }

    return {
        sections,
        fixedFooter: {
            primaryButton: {
                text: '送出',
                onClick: {
                    action: {
                        function: 'SUBMIT'
                    }
                },
                altText: 'submit',
                color: {
                    red: 0.204,
                    green: 0.596,
                    blue: 0.859,
                    alpha: 1
                }
            }
        }
    }
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
    
    const auth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/chat.bot'] })
    const authClient = await auth.getClient()
    google.options({ auth: authClient })

    const res = await chat.media.download({ resourceName: `${imageResourceName}?alt=media` }, { responseType: 'arraybuffer' })
    
    const imageBuffer = Buffer.from(res.data)
    const destFileName = `${uuidv4()}.${imageType}`
    const storage = new Storage()

    await storage.bucket(GCS_BUCKET).file(destFileName).save(imageBuffer)

    return description += `\n![${destFileName}](${GCS_HOST}/${destFileName})`
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
