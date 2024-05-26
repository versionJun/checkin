const accounts = require('../config/glados_accounts.js')
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

axios.defaults.timeout = 5 * 1000

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
        },
    })
    .then(res => {
        // logger.debug(`${JSON.stringify(res.data)}`)

        if (res.data.code === -2)
            return Promise.reject(`cookie已过期或无效(by:${JSON.stringify(res.data)})`)

        if ((/error/).test(res.data.message))
            return Promise.reject(`错误(by:${JSON.stringify(res.data)})`)

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
        // logger.debug(`${JSON.stringify(res.data)}`)

        if (res.data.code === -2 )
            return Promise.reject(`cookie已过期或无效(by:${JSON.stringify(res.data)})`)

        return res.data
    })
    .catch(error => {
        console.error(error)
        return Promise.reject(`goStatus->${error}`)
    })
}

!(async () => {

    for (let [index, value] of accounts.entries()) {
        if (!value.cookie) continue
        try {

            logger.addContext("user", `账号${index}`)

            const checkin_result = await goCheckin(value.cookie)

            const status_result = await goStatus(value.cookie)

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
