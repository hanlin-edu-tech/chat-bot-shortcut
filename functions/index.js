exports.convertToShortcut = (req, res) => {
    if (req.method === 'GET' || !req.body.message) {
        return res.status(403).json({
            status: 'error',
            message: 'illegal request'
        })
    }

    const message = req.body.message
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
            console.log(formInputs)

            if (!isValid) {
                body = createBugReportCard(formInputs)
                break
            }
            body = createSubmittedCard()
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

function createBugReportCard(names = { title: '', product: '', category: '', description: '' }) {
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

    return {
        sections: [{
            widgets: [
                hint,
                ...inputs
            ]
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