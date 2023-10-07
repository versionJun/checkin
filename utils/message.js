const axios = require("axios")

// pushplus
const PUSHPLUS_TOKEN = process.env.PUSHPLUS_TOKEN

// server酱
const SCT_SENDKEY = process.env.SCT_SENDKEY

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

    if (!PUSHPLUS_TOKEN) {
        return;
    }

    const { title, message } = params

    let data = {
        token: PUSHPLUS_TOKEN,
        title: title,
        content: message
    }

    try {

        let res = await axios.post("http://www.pushplus.plus/send", data);
        
        console.log(`发送pushplus res=${JSON.stringify(res.data)}`);

        return res.data.code

    } catch (e) {
        console.log(`发送pushplus失败:${e}`);
        console.error(e);
    }
}

/**
 * 发送server酱油 消息
 * 文档：https://sct.ftqq.com/
 * @param params = { 
 *  title : 消息标题, 
 *  message : 消息内容
 * }
 * @returns res = { pushid: '', readkey: '' }
 */
async function sent_message_by_sct(params) {

    if (!SCT_SENDKEY) {
        return;
    }

    const { title, message } = params

    let url = `https://sctapi.ftqq.com/${SCT_SENDKEY}.send`;

    let data = {
        title: title,
        content: message
    }

    try {
        
        let res = await axios.post(url, data)

        console.log(`发送server酱 res=${JSON.stringify(res.data)}`)

        const { pushid, readkey } = res.data.data

        return { pushid, readkey }

    } catch (e) {
        console.log(`发送pserver酱失败:${e}`)
        console.error(e)
    }

}

exports.sent_message_by_pushplus = sent_message_by_pushplus
exports.sent_message_by_sct = sent_message_by_sct
