const axios = require('../utils/axios.js')
const path = require('path')
const { sent_message_by_pushplus } = require('../utils/message.js')
const { dayjs } = require('../utils/dayjs.js')
const { logger, getLog4jsStr } = require('../utils/log4js')

// 登陆
const LOGIN_URL = 'https://pan.quark.cn/account/info'

// 查看当前签到状态 
const STATE_URL = 'https://drive-m.quark.cn/1/clouddrive/capacity/growth/info?pr=ucpro&fr=pc&uc_param_str='

// 签到
const SIGN_URL = 'https://drive-m.quark.cn/1/clouddrive/capacity/growth/sign?pr=ucpro&fr=pc&uc_param_str='

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.0.0 Safari/537.36'

async function getQuarkCookie() {

    const QUARK_COOKIE = process.env.QUARK_COOKIE || ''

    const QUARK_COOKIE_ARR = QUARK_COOKIE.indexOf('&') > -1
        ? QUARK_COOKIE.split(/\s*&\s*/).filter(item => item !== '')
        : QUARK_COOKIE ? [QUARK_COOKIE] : [];

    if (!QUARK_COOKIE_ARR.length) {
        console.error("未获取到 QUARK_COOKIE , 程序终止")
        process.exit(0)
    }
    
    return QUARK_COOKIE_ARR
}

function goLogin(cookie){
    return axios(`${LOGIN_URL}`, {
        method: 'GET',
        headers: {
            'Cookie': cookie,
            'User-Agent': UA,
        }
    })
    .then(res => {
    
       return {
            nickname : res.data.data.nickname
       }

    })
    .catch(error => {
        console.error(error)
        return Promise.reject(`goLogin->${error}`)
    })
}

function goState(cookie){
    return axios(`${STATE_URL}`, {
        method: 'GET',
        headers: {
            'Cookie': cookie,
            'User-Agent': UA,
        },
    })
    .then(res => {

        return res.data.data
    })
    .catch(error => {
        console.error(error)
        return Promise.reject(`goState->${error}`)
    })

}
function goSign(cookie){
    return axios(`${SIGN_URL}`, {
        method: 'POST',
        headers: {
            'Cookie': cookie,
            'User-Agent': UA,
        },
        data: {
            'sign_cyclic': 'True'
        }
    })
    .then(res => {
    
        return res.data.data
    })
    .catch(error => {
        console.error(error)
        return Promise.reject(`goSign->${error}`)
    })
}

!(async () => {

    const QUARK_COOKIE_ARR = await getQuarkCookie()

    for (let index = 0; index < QUARK_COOKIE_ARR.length; index++) {
        const cookie = QUARK_COOKIE_ARR[index]
        if(!cookie) continue
        try {
            logger.addContext("user", `账号${index}`)
            const { nickname } = await goLogin(cookie)
            logger.addContext("user", `账号${index}(${nickname})`)
            const stateResult = await goState(cookie)
            if (stateResult.cap_sign.sign_daily) {
                const today_sign_rewards = stateResult.cap_sign.sign_rewards[stateResult.cap_sign.sign_progress-1]
                const today_sign_rewards_mb = today_sign_rewards.reward_cap / 1024 / 1024
                const total_capacity_g = (stateResult.total_capacity / 1024 / 1024 / 1024).toFixed(1)
                logger.info(`今日已签到获取${today_sign_rewards_mb}MB (总容量: ${total_capacity_g}G)`)
            } else {
                const signResult = await goSign(cookie)
                const sign_daily_reward_mb = signResult.sign_daily_reward / 1024 / 1024
                logger.info(`今日签到获取${sign_daily_reward_mb}MB`)
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

