const axios = require('../utils/axios.js')
const path = require('path')
const { sent_message_by_pushplus } = require('../utils/message.js')
const { dayjs } = require('../utils/dayjs.js')
const { logger, getLog4jsStr } = require('../utils/log4js.js')

const BASE_URL = 'https://glados.rocks'
const CHECKIN_URL = `${BASE_URL}/api/user/checkin`
const STATUS_URL = `${BASE_URL}/api/user/status`
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.0.0 Safari/537.36"

const encryptEmail = (email) => { return email.replace(/^(\S{3})(?:\S*)(\S{2}@\S+)$/, '$1***$2') }

function goCheckin(cookie){
    return axios(CHECKIN_URL, {
        method: 'POST',
        data: { 
            'token': 'glados.one' 
        },
        headers: {
            'Cookie': cookie,
            'User-Agent': UA,
            'Content-Type': 'application/json;charset=UTF-8'
        }
    })
    .then(res => {

        // console.log(res.data)

        if (res.data.code === -2 )
            return Promise.reject(`cookie已过期或无效(by:${res.data.message})`)

        return res.data
    })
    .catch(error => {
        console.error(error)
        return Promise.reject(`goCheckin->${error}`)
    })
}

function goStatus(cookie){
    return axios(STATUS_URL, {
        method: 'GET',
        headers: {
            'Cookie': cookie,
            'User-Agent': UA
        }
    })
    .then(res => {

        // console.log(res.data)

        if (res.data.code === -2 )
            return Promise.reject(`cookie已过期或无效(by:${res.data.message})`)

        return res.data
    })
    .catch(error => {
        console.error(error)
        return Promise.reject(`goStatus->${error}`)
    })
}

function getGladosCookie() {

    let GLADOS_COOKIE = process.env.GLADOS_COOKIE || ''

    let GLADOS_COOKIE_ARR = []

    if (GLADOS_COOKIE.indexOf('&') > -1)
        GLADOS_COOKIE_ARR = GLADOS_COOKIE.split(/\s*&\s*/).filter(item => item != '')
    else if (GLADOS_COOKIE)
        GLADOS_COOKIE_ARR = [GLADOS_COOKIE]

    if (!GLADOS_COOKIE_ARR.length) {
        console.error("未获取到GLADOS_COOKIE, 程序终止")
        process.exit(0);
    }
    
    return GLADOS_COOKIE_ARR
}

!(async () => {

    const GLADOS_COOKIE_ARR = getGladosCookie()

    for (let index = 0; index < GLADOS_COOKIE_ARR.length; index++) {
        const cookie = GLADOS_COOKIE_ARR[index]
        if(!cookie) continue
        try {

            logger.addContext("user", `账号${index}`)

            const checkin_result = await goCheckin(cookie)

            const status_result = await goStatus(cookie)

            logger.addContext("user", `账号${index}(${encryptEmail(status_result.data.email)})`)

            const balance = parseInt(checkin_result.list[0].balance)

            const leftdays = parseInt(status_result.data.leftDays)
            
            logger.info(`签到结果:${checkin_result.message} (点数:${balance}) (天数:${leftdays})`)

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
