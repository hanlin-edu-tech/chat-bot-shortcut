const { getProjects } = require('./shortcutAPI')

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

function createBugReportCard(names = { title: '', product: '', category: '', description: '', imageRef: '' }, { commandId = -1, isError = false }) {
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

async function createcComplaintReportCard(names = { workflow: '', project: '', type: '', priority: '', title: '', description: '', imageRef: '' }, { commandId = -1, isFirst = false, isError = false }) {
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
                label: '',
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
                label: '',
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
                label: '',
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
    const projects = await getProjects(names.workflow)
    selectionInputs[0].selectionInput.items.push(...projects)

    selectionInputs.forEach(input => {
        input.selectionInput.items.forEach(item => {
            item.selected = item.value === names[input.selectionInput.name] ? true : false
        })        
    })

    const defaultContent = '**提問者**:\n\n**問題**:\n\n**建議**:'
    const inputs = [
        {
            textInput: {
                label: '標題',
                type: 'SINGLE_LINE',
                name: 'title',
                hintText: '',
                value: names.title
            }
        },
        {
            textInput: {
                label: '說明',
                type: 'MULTIPLE_LINE',
                name: 'description',
                hintText: '',
                value: names.description ? names.description : defaultContent
            }
        }
    ]

    const required = ['project', 'type', 'priority', 'title', 'description']
    const hintText = '此欄位為必填！'
    const splitId = 3
    if (!isFirst) {
        required.forEach((input, id) => {
            if (input === 'description' && names.description.replace(/\s/g, '') === defaultContent.replace(/\s/g, '')) {
                return inputs[id - splitId].textInput.hintText = hintText
            }
            if (!names[input]) {
                if (id < splitId) {
                    return selectionInputs[id].selectionInput.label = hintText
                }
                return inputs[id - splitId].textInput.hintText = hintText
            }
        })
    }

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

module.exports.createSubmittedCard = createSubmittedCard
module.exports.createBugReportCard = createBugReportCard
module.exports.createcComplaintReportCard = createcComplaintReportCard
