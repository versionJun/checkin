const axios = require('../utils/axios.js')
const cheerio = require('cheerio')
const path = require('path')
const { sent_message_by_pushplus } = require('../utils/message.js')
const accounts = require('../config/v2free_accounts.js')
const { dayjs } = require('../utils/dayjs.js')
const { logger, getLog4jsStr } = require('../utils/log4js.js')
const tough = require('tough-cookie')
const Cookie = tough.Cookie

const BASE_URL = 'https://cdn.v2free.net/'
const LOGIN_URL = `${BASE_URL}auth/login`
const USER_URL = `${BASE_URL}user/`
const CHECKIN_URL = `${BASE_URL}user/checkin`
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.0.0 Safari/537.36'

const encryptEmail = (email) => { return email.replace(/^(\S{3})(?:\S*)(\S{2}@\S+)$/, '$1***$2') }

function getCookieMap(cookie){

    const cookieMap = new Map();

    decodeURIComponent(cookie)
        .split(/\s*;\s*/)
        .filter(item => item != '')
        .forEach((item) => {
            const [key, value] = item.split("=");
            cookieMap.set(key, value);
        })

    return cookieMap
}

function goLogin(user){
    return axios(LOGIN_URL, {
        method: 'POST',
        headers: {
            'Origin': BASE_URL,
            'referer': LOGIN_URL,
            'User-Agent': UA,
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        data: {
            email: user.email,
            passwd: user.passwd
        }
    })
    .then(d => {

        if (d.data.ret !== 1) 
            return Promise.reject(`登录失败(by:${d.data.msg})`)

        let cookies = []
        if (Array.isArray(d.headers['set-cookie'])){
            d.headers['set-cookie'].map(item => {
                cookies.push(Cookie.parse(item).cookieString()) 
            })
        }
        else {
            cookies = [Cookie.parse(d.headers['set-cookie']).cookieString()]
        }

        return cookies.join(';')
    })
    .catch(error => {
        console.error(error)
        return Promise.reject(`goLogin->${error}`)
    })
}

function goCheckin(cookie) {
    return axios(CHECKIN_URL, {
        method: 'POST',
        headers: {
            // 'Origin': BASE_URL,
            // 'referer': USER_URL,
            'User-Agent': UA,
            'Cookie': cookie
        }
    })
    .then(d => {

        if (d.data.msg == undefined) 
            return Promise.reject('cookie已过期或无效')

        return d.data
    })
    .catch(error => {
        console.error(error)
        return Promise.reject(`goCheckin->${error}`)
    })
}

function goUser(cookie){
    return axios(USER_URL, {
        method: 'GET',
        headers: {
            'User-Agent': UA,
            'Cookie': cookie
        }
    })
    .then(d => {

        const $ = cheerio.load(d.data)
        const unUsedTraffic = $('.nodename > a[href^="/user/trafficlog"]').text().trim()

        return { unUsedTraffic }
    })
    .catch(error => {
        console.error(error)
        return Promise.reject(`goUser->${error}`)
    })
}

!(async () => {

    for (let index = 0; index < accounts.length; index++) {
        const user = accounts[index]
        if(!user.email || !user.passwd)
            continue
        try {
            logger.addContext("user", `账号${index}`)
            const userCookie = await goLogin(user)
            const cookieMap = getCookieMap(userCookie)
            logger.addContext("user", `账号${index}(${encryptEmail(cookieMap.get("email"))})`)
            const checkin_result = await goCheckin(userCookie)
            if (checkin_result.ret === 1){
                logger.info(`${checkin_result.msg}(剩余流量:${checkin_result.trafficInfo.unUsedTraffic})`)
            } else {
                const { unUsedTraffic } = await goUser(userCookie)
                logger.info(`${checkin_result.msg}(剩余流量:${unUsedTraffic})`)
            }
        } catch (error) {
            console.error(error)
            logger.error(error)
        } finally {
            logger.removeContext("user")
        }
    }


    await sent_message_by_pushplus({ 
        title: `${path.parse(__filename).name}_${dayjs.tz().format('YYYY-MM-DD HH:mm:ss')}`,
        message: getLog4jsStr() 
    });

})()
