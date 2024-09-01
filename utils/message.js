const axios = require('./axios.js')

// 是定时触发任务
const IS_SCHEDULE = process.env.IS_SCHEDULE || 'false'

// pushplus
const PUSHPLUS_TOKEN = process.env.PUSHPLUS_TOKEN
const PUSHPLUS_TOPIC = process.env.PUSHPLUS_TOPIC

// server酱
const SCT_SENDKEY = process.env.SCT_SENDKEY

// wxpusher
const WXPUSHER_TOKEN = process.env.WXPUSHER_TOKEN
const WXPUSHER_UID = process.env.WXPUSHER_UID	

// PushHub
const PUSHHUB_TOKEN = process.env.PUSHHUB_TOKEN

/**
 * pushplus 推送
 * 文档：http://www.pushplus.plus/doc/guide/api.html
 * @param params = { 
 *  title : 消息标题, 
 *  message : 消息内容
 * }
 * @returns 响应状态代码 
 * 200=执行成功;
 * 302=未登录;
 * 401=请求未授权;
 * 403=请求IP未授权;
 * 500=系统异常，请稍后再试;
 * 600=数据异常，操作失败;
 * 805=无权查看;888=积分不足，需要充值;
 * 900=用户账号使用受限;
 * 999=服务端验证错误;
 */
async function sent_message_by_pushplus(params) {

    if (!PUSHPLUS_TOKEN) {
        console.error("未获取到 PUSHPLUS_TOKEN, 取消推送 pushplus")
        return;
    }

    return axios("http://www.pushplus.plus/send", {
        method: 'POST',
        data: {
            token: PUSHPLUS_TOKEN,
            title: params.title,
            content: params.message,
            topic: PUSHPLUS_TOPIC
        }
    }).then(res => {

        console.log(`pushplus 推送 res.data=${JSON.stringify(res.data)}`)

        if (res.data.code !== 200)
            return Promise.reject(`${res.data.msg}`) 

        return res.data.code

    }).catch(error => {
        console.error(error)
        console.log(`pushplus 推送 失败:${error}`)
        console.log(`pushplus 推送 失败->params=${JSON.stringify(params)}`)
    })
}

/**
 * server酱 推送
 * 文档：https://sct.ftqq.com/
 * @param params = { 
 *  title : 消息标题, 
 *  message : 消息内容
 * }
 * @returns res = { pushid: '', readkey: '' }
 */
async function sent_message_by_sct(params) {

    if (!SCT_SENDKEY) {
        console.error("未获取到 SCT_SENDKEY, 取消推送 server酱")
        return;
    }

    return axios(`https://sctapi.ftqq.com/${SCT_SENDKEY}.send`, {
        method: 'POST',
        data: {
            title: params.title,
            content: params.message
        }
    }).then(res => {

        console.log(`server酱 推送 res.data=${JSON.stringify(res.data)}`)

        const { pushid, readkey } = res.data.data

        return { pushid, readkey }

    }).catch(error => {
        console.error(error)
        console.log(`server酱 推送 失败:${error}`)
        if (error.response && error.response.data) {
            console.log(`server酱 推送 失败->error.response.data=${JSON.stringify(error.response.data)}`)
        }
        console.log(`server酱 推送 失败->params=${JSON.stringify(params)}`)
    })
}

/**
 * wxpusher 推送
 * 文档：https://wxpusher.zjiecode.com/docs/
 * @param params = { 
 *  title : 消息标题, 
 *  message : 消息内容
 * }
 */
async function sent_message_by_wxpusher(params) {

    if (!WXPUSHER_TOKEN) {
        console.error("未获取到 WXPUSHER_TOKEN, 取消推送 wxpusher")
        return;
    }

    if (!WXPUSHER_UID) {
        console.error("未获取到 WXPUSHER_UID, 取消推送 wxpusher")
        return;
    }

    return axios(`https://wxpusher.zjiecode.com/api/send/message`, {
        method: 'POST',
        data: {
            appToken: WXPUSHER_TOKEN,
            content: params.message,
            summary: params.title,
            contentType: 1,
            uids: [WXPUSHER_UID]
        }
    }).then(res => {

        console.log(`wxpusher 推送 res.data=${JSON.stringify(res.data)}}`)

    }).catch(error => {
        console.error(error)
        console.log(`wxpusher 推送 失败:${error}`)
        if (error.response && error.response.data) {
            console.log(`wxpusher 推送 失败->error.response.data=${JSON.stringify(error.response.data)}`)
        }
        console.log(`wxpusher 推送 失败->params=${JSON.stringify(params)}`)
    })
}

/**
 * PushHub 推送
 * 文档：https://www.pushhub.cn/doc/
 * @param params = { 
 *  title : 消息标题, 
 *  message : 消息内容
 * }
 */
async function sent_message_by_pushhub(params) {

    if (!PUSHHUB_TOKEN) {
        console.error("未获取到 PUSHHUB_TOKEN, 取消推送 PushHub")
        return;
    }

    return axios(`https://api.pushhub.cn/send`, {
        method: 'POST',
        data: {
            token: PUSHHUB_TOKEN,
            title: params.title,
            content: params.message,
        }
    }).then(res => {

        console.log(`PushHub 推送 res.data=${JSON.stringify(res.data)}}`)

    }).catch(error => {
        console.error(error)
        console.log(`PushHub 推送 失败:${error}`)
        if (error.response && error.response.data) {
            console.log(`PushHub 推送 失败->error.response.data=${JSON.stringify(error.response.data)}`)
        }
        console.log(`PushHub 推送 失败->params=${JSON.stringify(params)}`)
    })
}

async function send_message(params) {

    if (IS_SCHEDULE === 'false') {
        console.log(`非定时触发任务, 跳过推送`)
        console.log(params)
        return;
    }

    await sent_message_by_wxpusher(params)
    
    // await sent_message_by_pushhub(params)
    
}

exports.sent_message_by_pushplus = sent_message_by_pushplus
exports.sent_message_by_sct = sent_message_by_sct
exports.sent_message_by_wxpusher = sent_message_by_wxpusher
exports.send_message = send_message
