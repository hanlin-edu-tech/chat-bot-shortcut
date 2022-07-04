const AWS = require('aws-sdk');
AWS.config.update({region: 'ap-northeast-1'});

const route53 = new AWS.Route53({ apiVersion: '2013-04-01'})

async function responseCheckHostExist(host) {
    const getFindData = await findRoute53Record(host)
    if (getFindData !== null){
        return 'Host is exist!!'
    }else {
        return 'Host is not exist!!'
    }
}

async function createNewRoute53HostRecord(host){
    const getFindData = await findRoute53Record(host)
    if (getFindData == null){
        console.log("====== Start to Create ======")
        return await createRoute53Record()
    }else {
        return "Host is Exist, Please DELETE it or change a hostName ~"
    }
}

async function deleteRecord(host){
    const getFindData = await findRoute53Record(host)
    if (getFindData !== null){
        console.log("====== Start to Create ======")
        return await deleteRoute53Record()
    }else {
        return "Host is not Exist, Please DELETE it or change a hostName ~"
    }
}

async function findRoute53Record(host) {
    let records = [];
    let listResult = { NextRecordName: null, NextRecordType: null };
    do {
        listResult = await route53.listResourceRecordSets({
            HostedZoneId: "ZRYUET8U21PVE",
            StartRecordName: listResult.NextRecordName,
            StartRecordType: listResult.NextRecordType
        }).promise();
        records.push(listResult.ResourceRecordSets);
    } while (listResult.IsTruncated);
    const recordName = `${host}.teams.com.tw.`;
    return records.flat().find(record => {
        return record.Type === 'A' && record.Name === recordName;
    });
}

async function createRoute53Record(host) {
    const recordName = `${host}.teams.com.tw.`;
    let recordParams = {
        HostedZoneId: "ZRYUET8U21PVE",
        ChangeBatch:{
            Changes: [
                {
                    Action: "UPSERT",
                    ResourceRecordSet: {
                        Name: recordName,
                        ResourceRecords: [{ Value: "35.190.59.174" }],
                        TTL: 300,
                        Type: "A"
                    }
                  }
              ]
          }
        };
    try {
        const changeResult = await route53.changeResourceRecordSets(recordParams).promise();
        if (changeResult == null) {
            return 'changeResult is null';
        }
        return `成功更新 ${recordName} record`;
    }catch (err) {
        return `更新 ${recordName} record 失敗`;
    }
}

async function deleteRoute53Record(host) {
    const recordName = `${host}.teams.com.tw.`;
    let recordParams = {
        HostedZoneId: "ZRYUET8U21PVE",
        ChangeBatch:{
            Changes: [
                {
                    Action: "DELETE",
                    ResourceRecordSet: {
                        Name: recordName,
                        ResourceRecords: [{ Value: "35.190.59.174" }],
                        TTL: 300,
                        Type: "A"
                    }
                }
                ]
        }
    };
    try {
        const changeResult = await route53.changeResourceRecordSets(recordParams).promise();
        if (changeResult == null) {
            return 'changeResult is null';
        }
        return `成功刪除 ${recordName} record`;
    }catch (err) {
        return `刪除 ${recordName} record 失敗`;
    }
}

module.exports.responseCheckHostExist = responseCheckHostExist
module.exports.createNewRoute53HostRecord = createNewRoute53HostRecord
module.exports.deleteRecord = deleteRecord
