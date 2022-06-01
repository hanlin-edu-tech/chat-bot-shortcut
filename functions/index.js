const fetch = require('node-fetch')
const { google } = require('googleapis')
const publishStory = require('./shortcutAPI')
const keyFile = require('./key-file.json')

exports.convertToShortcut = async (req, res) => {
    if (req.method === 'GET' || !req.body.message) {
        return res.status(403).json({
            status: 'error',
            message: 'illegal request'
        })
    }

    const dialogEventType = req.body.dialogEventType ? req.body.dialogEventType : ''
    let body = {}

    switch (dialogEventType) {
        case 'REQUEST_DIALOG':
            body = createBugReportCard()
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
                const { title, product, category, description } = formInputs
                const senderEmail = req.body.message.sender.email
                const res = await publishStory(`[${product}][${category}][${title}]`, description, senderEmail)

                if (res.status !== 201) {
                    body = createBugReportCard(formInputs, true)
                    break
                }

                const { space } = req.body.message
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

function createBugReportCard(names = { title: '', product: '', category: '', description: '' }, isError = false) {
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

    const widgets = []
    if (isError) {
        widgets.push(error, hint, ...inputs)
    } else {
        widgets.push(hint, ...inputs)
    }

    return {
        sections: [{
            widgets
        }],
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