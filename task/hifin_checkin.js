const axios = require('../utils/axios.js')
const cheerio = require('cheerio')
const path = require('path')
const { logger, getLog4jsStr } = require('../utils/log4js.js')
const message = require('../utils/message.js')
const { dayjs } = require('../utils/dayjs.js')


const BASE_URL = 'https://www.hifini.com/'
const SG_SIGN_URL = `${BASE_URL}sg_sign.htm`
const MY_URL = `${BASE_URL}my.htm`
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function getHifinCookie() {

    const HIFIN_COOKIE = process.env.HIFIN_COOKIE || ''

    const HIFIN_COOKIE_ARR = HIFIN_COOKIE.indexOf('&') > -1
        ? HIFIN_COOKIE.split(/\s*&\s*/).filter(item => item !== '')
        : HIFIN_COOKIE ? [HIFIN_COOKIE] : [];

    if (!HIFIN_COOKIE_ARR.length) {
        console.error("未获取到 HIFIN_COOKIE , 程序终止")
        process.exit(0)
    }

    return HIFIN_COOKIE_ARR
}

function getSign(cookie) {
    return axios(`${SG_SIGN_URL}`, {
        method: 'GET',
        headers: {
            'Cookie': cookie,
            'User-Agent': UA,
            'Content-Type': 'text/html; charset=utf-8'
        }
    })
    .then(d => {

        const $ = cheerio.load(d.data)

        const username = $('.nav-item.username').text().trim()

        if (!username) return Promise.reject('cookie已过期或无效')

        const signReg = /(?<=var sign = ").*?(?=";)/g

        const sign = d.data.match(signReg)

        if (sign == null) return Promise.reject(`sign 获取失败`)

        return {
            username: username,
            sign: sign[0]
        }

    })
    .catch(error => {
        console.error(error)
        return Promise.reject(`goBase->${error}`)
    })
}

function goSgSign(cookie, sign) {
    return axios(`${SG_SIGN_URL}`, {
        method: 'POST',
        headers: {
            'Cookie': cookie,
            'User-Agent': UA,
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        data: {
            'sign': sign
        }
    })
    .then(d => {

        const $ = cheerio.load(d.data)

        const msg_element = $('#body')

        const msg = msg_element ? msg_element.text().trim() : null

        if ((/^\S*请登录后再签到!\S*$/).test(msg))
            return Promise.reject(`cookie已过期或无效(by:${msg}))`)

        return { msg }
    })
    .catch(error => {
        console.error(error)
        return Promise.reject(`goSgSign->${error}`)
    })
}

function goMy(cookie) {
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
        if (!cookie) continue
        try {
            logger.addContext("user", `账号${index}`)
            const { username, sign } = await getSign(cookie)
            logger.addContext("user", `账号${index}(${username})`)
            const { msg } = await goSgSign(cookie, sign)
            logger.info(`${msg}`)
            const { species } = await goMy(cookie)
            logger.info(`剩余金币:${species}`)
        } catch (error) {
            console.error(error)
            logger.error(error)
        } finally {
            logger.removeContext("user")
        }
    }

    // console.log(`getLog4jsStr('INFO')\n${getLog4jsStr('INFO')}`)

    if (getLog4jsStr('ERROR') != '')
        await message.send_message({ 
            title: `${path.parse(__filename).name}_${dayjs.tz().format('YYYY-MM-DD HH:mm:ss')}`,
            message: getLog4jsStr('ALL')
        });

})()
