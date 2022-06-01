const fetch = require('node-fetch')
const { google } = require('googleapis')
const { Storage } = require('@google-cloud/storage')
const { v4: uuidv4 } = require('uuid')
const publishStory = require('./shortcutAPI')
const keyFile = require('./key-file.json')

const GCS_BUCKET = 'chat-bot-attachment'
const GCS_HOST = 'https://storage.googleapis.com/chat-bot-attachment'

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

    switch (dialogEventType) {
        case 'REQUEST_DIALOG':
            const attachment = message.attachment ? message.attachment : []
            const imageId = getAttachmentId(attachment, 'image')

            body = createBugReportCard({ imageId })
            break
        case 'SUBMIT_DIALOG':
            const formInputs = req.body.common.formInputs
            let isValid = true

            for (let key in formInputs) {
                formInputs[key] = formInputs[key].stringInputs.value[0]
                if (!formInputs[key]) {
                    isValid = false
                }
            }

            if (!isValid) {
                body = createBugReportCard(formInputs)
                break
            }

            try {
                const { title, product, category, imageId } = formInputs
                const description = await addImageIntoDescription(formInputs.description, message.name, imageId)
                const senderEmail = message.sender.email
                const res = await publishStory(`[${product}][${category}][${title}]`, description, senderEmail)

                if (res.status !== 201) {
                    body = createBugReportCard(formInputs, true)
                    break
                }

                const { space } = message
                const storyUrl = (await res.json()).app_url
                await sendMessageToSpace(`*標題:* [${product}][${category}][${title}]\n*Story連結:* ${storyUrl}`, space.name)

                body = createSubmittedCard()
            } catch (err) {
                body = createBugReportCard(formInputs, true)
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

function createBugReportCard(names = { title: '', product: '', category: '', description: '', imageId: '' }, isError = false) {
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

    const widgetsInputs = []
    if (isError) {
        widgetsInputs.push(error, hint, ...inputs)
    } else {
        widgetsInputs.push(hint, ...inputs)
    }

    const widgetsImg = []
    if (names.imageId) {
        widgetsImg.push({
            "textInput": {
                label: `圖片暫存`,
                type: 'SINGLE_LINE',
                name: 'imageId',
                value: names.imageId
            }
        })
    }

    return {
        sections: [
            { widgets: widgetsInputs },
            { widgets: widgetsImg }
        ],
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

function getAttachmentId(attachment, type = '') {
    if (attachment.length > 0 && attachment[0].contentType.includes(type)) {
        return attachment[0].name.split('/attachments/')[1]
    }
    return ''
}

async function addImageIntoDescription(description, messageName, imageId = '') {
    const jwtClient = new google.auth.JWT(keyFile.client_email, null, keyFile.private_key, ['https://www.googleapis.com/auth/chat.bot'])
    const token = (await jwtClient.authorize()).access_token

    const resImage = await fetch(`https://chat.googleapis.com/v1/${messageName}/attachments/${imageId}`, {
        method: 'GET',
        headers: {
            'content-type': 'application/json',
            'authorization': `Bearer ${token}`
        }
    })

    const image = await resImage.json()
    const imageDataRef = image.attachmentDataRef.resourceName
    const resData = await fetch(`https://chat.googleapis.com/v1/media/${imageDataRef}?alt=media`, {
        method: 'GET',
        headers: {
            'authorization': `Bearer ${token}`
        }
    })

    const imageBuffer = Buffer.from(await (await resData.blob()).arrayBuffer())
    const destFileName = `${uuidv4()}.png`
    const storage = new Storage({ keyFilename: 'key-file.json' })

    await storage.bucket(GCS_BUCKET).file(destFileName).save(imageBuffer)

    return description += `\n![${destFileName}](${GCS_HOST}/${destFileName})`
}

async function sendMessageToSpace(message, space) {
    const jwtClient = new google.auth.JWT(keyFile.client_email, null, keyFile.private_key, ['https://www.googleapis.com/auth/chat.bot'])
    const token = (await jwtClient.authorize()).access_token

    const res = await fetch(`https://chat.googleapis.com/v1/${space}/messages`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text: message })
    })

    return res
}