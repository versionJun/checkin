const axios = require('../utils/axios.js')
const crypto = require('crypto')
const path = require('path')
const { sent_message_by_pushplus } = require('../utils/message.js')
const { dayjs } = require('../utils/dayjs.js')
const { logger, getLog4jsStr } = require('../utils/log4js.js')

const API = {
    'TBS_API': 'http://tieba.baidu.com/dc/common/tbs',
    'FOLLOW_API': 'https://tieba.baidu.com/mo/q/newmoindex',
    'SIGN_API': 'http://c.tieba.baidu.com/c/c/forum/sign'
}

const DEFAULTS_HEADERS = {
    'connection': 'keep-alive',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Host': 'tieba.baidu.com',
    'charset': 'UTF-8',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1 Edg/87.0.4280.88'
}

axios.defaults.timeout = 5 * 1000

function getTiebaCookie() {

    const TIEBA_COOKIE = process.env.TIEBA_COOKIE|| ''

    const TIEBA_COOKIE_ARR = TIEBA_COOKIE.indexOf('&') > -1
        ? TIEBA_COOKIE.split(/\s*&\s*/).filter(item => item !== '')
        : TIEBA_COOKIE ? [TIEBA_COOKIE] : [];

    if (!TIEBA_COOKIE_ARR.length) {
        console.error("未获取到 TIEBA_COOKIE , 程序终止")
        process.exit(0)
    }

    return TIEBA_COOKIE_ARR
}

function getTBS(cookie){
    return axios(API.TBS_API, {
        method: 'GET',
        headers: {
            ...DEFAULTS_HEADERS,
            'Cookie': cookie,
        },
    })
    .then(res => {
        // logger.debug(`${JSON.stringify(res.data)}`)
        if (res.data.is_login !== 1)
            return Promise.reject(`获取TBS失败 (by:${JSON.stringify(res.data)})`)
        return res.data
    })
    .catch(error => {
        console.error(error)
        return Promise.reject(`${arguments.callee.name}->${error}`)
    })
}

function getTieBaFollow(cookie){
    return axios(API.FOLLOW_API, {
        method: 'GET',
        headers: {
            ...DEFAULTS_HEADERS,
            'Cookie': cookie,
        },
    })
    .then(res => {
        // logger.debug(`${JSON.stringify(res.data)}`)
        if (!res.data.data.is_login)
            return Promise.reject(`登录信息丢失`)
        return res.data.data.like_forum.map(forum => forum.forum_name)
    })
    .catch(error => {
        console.error(error)
        return Promise.reject(`${arguments.callee.name}->${error}`)
    })
}

const cryptoMD5 = (data) => {
    // 使用MD5算法对签名字符串进行加密，然后返回加密结果的16进制字符串
    return crypto.createHash("md5").update(data, 'utf-8').digest("hex");
}

function signTieBa(forum_name, tbs, cookie){
    const sign = `kw=${forum_name}tbs=${tbs}tiebaclient!!!`
    const cryptoSign = cryptoMD5(sign)
    return axios(API.SIGN_API, {
        method: 'POST',
        headers: {
            ...DEFAULTS_HEADERS,
            'Cookie': cookie
        },
        data: {
            kw: forum_name,
            tbs: tbs,
            sign: cryptoSign
        },
    })
    .then(res => {
        // logger.debug(`${JSON.stringify(res.data)}`)
        if (res.data.error_code === 0) {
            logger.info(`[${forum_name}]签到成功, 连续签到：${res.data.user_info.cont_sign_num}天, 累计签到：${res.data.user_info.total_sign_num}天`)
        } else {
            logger.info(`[${forum_name}]签到失败`)
        }
    })
    .catch(error => {
        console.error(error)
        return Promise.reject(`${arguments.callee.name}->${error}`)
    })
}


const sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration))
const randomSleep = (min, max) => sleep(Math.floor(Math.random() * (max - min + 1)) + min)

!(async () => {

    const TIEBA_COOKIE_ARR = getTiebaCookie()

    for (let [index, cookie] of TIEBA_COOKIE_ARR.entries()) {
        if (!cookie) continue
        try {
            logger.addContext("user", `账号${index}`)
            const tbs = await getTBS(cookie)
            const followList = await getTieBaFollow(cookie)
            await randomSleep(600, 1200)
            for (const forum_name of followList) {
                await signTieBa(forum_name, tbs, cookie);
                await randomSleep(1400, 2800)
            }
        } catch (error) {
            console.error(error)
            logger.error(error)
        } finally {
            logger.removeContext("user")
        }
    }

    // console.log(`getLog4jsStr('INFO')\n${getLog4jsStr('INFO')}`)

    await sent_message_by_pushplus({ 
        title: `${path.parse(__filename).name}_${dayjs.tz().format('YYYY-MM-DD HH:mm:ss')}`,
        message: getLog4jsStr('INFO') 
    });
})()

