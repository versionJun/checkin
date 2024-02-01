const axios = require('../utils/axios.js')
const cheerio = require('cheerio')
const path = require('path')
const { sent_message_by_pushplus } = require('../utils/message.js')
const { dayjs } = require('../utils/dayjs.js')
const { logger, getLog4jsStr } = require('../utils/log4js.js')

const BASE_URL = 'https://www.hifini.com/'
const SG_SIGN_URL = `${BASE_URL}sg_sign.htm`
const MY_URL = `${BASE_URL}my.htm`
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.0.0 Safari/537.36'


function getHifinCookie() {

    let HIFIN_COOKIE = process.env.HIFIN_COOKIE || ''

    let HIFIN_COOKIE_ARR = []

    if (HIFIN_COOKIE.indexOf('&') > -1)
        HIFIN_COOKIE_ARR = HIFIN_COOKIE.split(/\s*&\s*/).filter(item => item != '')
    else if (HIFIN_COOKIE)
        HIFIN_COOKIE_ARR = [HIFIN_COOKIE]

    if (!HIFIN_COOKIE_ARR.length) {
        console.error("未获取到 HIFIN_COOKIE , 程序终止")
        process.exit(0)
    }
    
    return HIFIN_COOKIE_ARR
}

function goSgSign(cookie){
    return axios(`${SG_SIGN_URL}`, {
        method: 'POST',
        headers: {
            'Origin': `${BASE_URL}`,
            'referer': `${BASE_URL}`,
            'Cookie': cookie,
            'User-Agent': UA,
            'Content-Type': 'text/html; charset=utf-8'
        }
    })
    .then(d => {

        const $ = cheerio.load(d.data)

        const username_element = $('.nav-item.username')

        if (!username_element) 
            return Promise.reject('cookie已过期或无效')

        const username = username_element.text().trim()
        
        const msg_element = $('#body')
        
        const msg = msg_element ? msg_element.text().trim() : null

        return { username, msg }
    })
    .catch(error => {
        console.error(error)
        return Promise.reject(`goSgSign->${error}`)
    })
}

function goMy(cookie){
    return axios(`${MY_URL}`, {
        method: 'GET',
        headers: {
            'Cookie': cookie,
            'User-Agent': UA,
            'Content-Type': 'text/html; charset=utf-8'
        }
    })
    .then(d => {

        const $ = cheerio.load(d.data)
        const species = $('span.text-muted:contains("金币") > em').text().trim()

        return { species }
    })
    .catch(error => {
        console.error(error)
        return Promise.reject(`goMy->${error}`)
    })
}

!(async () => {

    const HIFIN_COOKIE_ARR = await getHifinCookie()
    
    for (let index = 0; index < HIFIN_COOKIE_ARR.length; index++) {
        const cookie = HIFIN_COOKIE_ARR[index]
        if(!cookie) continue
        try {
            logger.addContext("user", `账号${index}`)

            const { username, msg } = await goSgSign(cookie)

            logger.addContext("user", `账号${index}(${username})`)

            const { species } = await goMy(cookie)

            logger.info(`${msg}(剩余金币:${species})`)

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
