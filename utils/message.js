const axios = require('./axios.js')

// pushplus
const PUSHPLUS_TOKEN = process.env.PUSHPLUS_TOKEN

// server酱
const SCT_SENDKEY = process.env.SCT_SENDKEY

// 是定时触发任务
const IS_SCHEDULE = process.env.IS_SCHEDULE || 'false'

/**
 * 发生pusplus 消息 
 * 文档：http://www.pushplus.plus/doc/guide/api.html
 * @param params = { 
 *  title : 消息标题, 
 *  message : 消息内容
 * }
 * @returns 响应状态代码 200=执行成功;302=未登录;401=请求未授权;403=请求IP未授权;500=系统异常，请稍后再试;600=数据异常，操作失败;805=无权查看;888=积分不足，需要充值;900=用户账号使用受限;999=服务端验证错误;
 */
async function sent_message_by_pushplus(params) {

    if (IS_SCHEDULE === 'false') {
        console.log(`非定时触发任务, 跳过推送\n${JSON.stringify(params)}`)
        return;
    }
    
    if (!PUSHPLUS_TOKEN) {
        console.error("未获取到 PUSHPLUS_TOKEN, 取消推送")
        return;
    }

    const { title , message } = params

    return axios("http://www.pushplus.plus/send", {
        method: 'POST',
        data: {
            token: PUSHPLUS_TOKEN,
            title: title,
            content: message
        }
    }).then(res => {

        console.log(`发送pushplus res.data=${JSON.stringify(res.data)}`)

        if (res.data.code !== 200)
            return Promise.reject(`${res.data.msg}`) 

        return res.data.code

    }).catch(error => {
        console.error(error)
        console.log(`发送pushplus失败:${error}`)
        console.log(`发送pushplus失败->params=${JSON.stringify(params)}`)
    })
}

/**
 * 发送server酱 消息
 * 文档：https://sct.ftqq.com/
 * @param params = { 
 *  title : 消息标题, 
 *  message : 消息内容
 * }
 * @returns res = { pushid: '', readkey: '' }
 */
async function sent_message_by_sct(params) {

    if (!SCT_SENDKEY) {
        console.error("未获取到 SCT_SENDKEY, 取消推送")
        return;
    }

    const { title, message } = params

    return axios(`https://sctapi.ftqq.com/${SCT_SENDKEY}.send`, {
        method: 'POST',
        data: {
            title: title,
            content: message
        }
    }).then(res => {

        console.log(`发送server酱 res.data=${JSON.stringify(res.data)}`)

        const { pushid, readkey } = res.data.data

        return { pushid, readkey }

    }).catch(error => {
        console.error(error)
        console.log(`发送pserver酱失败:${error}`)
        if (error.response && error.response.data) {
            console.log(`发送pserver酱失败->error.response.data=${JSON.stringify(error.response.data)}`)
        }
        console.log(`发送pserver酱失败->params=${JSON.stringify(params)}`)
    })
}

exports.sent_message_by_pushplus = sent_message_by_pushplus
exports.sent_message_by_sct = sent_message_by_sct
