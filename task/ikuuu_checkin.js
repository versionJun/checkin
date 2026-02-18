const axios = require('../utils/axios.js')
const cheerio = require('cheerio')
const path = require('path')
const message = require('../utils/message.js')
const accounts = require('../config/ikuuu_accounts.js')
const { dayjs } = require('../utils/dayjs.js')
const { logger, getLog4jsStr } = require('../utils/log4js.js')
const tough = require('tough-cookie')
const Cookie = tough.Cookie


const BASE_URL = 'https://ikuuu.org/'
const LOGIN_URL = `${BASE_URL}auth/login`
const USER_URL = `${BASE_URL}user/`
const CHECKIN_URL = `${BASE_URL}user/checkin`
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.0.0 Safari/537.36'

const encryptEmail = (email) => { return email.replace(/^(\S{3})(?:\S*)(\S{2}@\S+)$/, '$1***$2') }

function goLogin(user){
    return axios(`${LOGIN_URL}`, {
        method: 'POST',
        headers: {
            'Origin': `${BASE_URL}`,
            'referer': `${LOGIN_URL}`,
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

function getCookieMap(cookie) {

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

function goCheckin(cookie) {
    return axios(`${CHECKIN_URL}`, {
        method: 'POST',
        headers: {
            'Origin': `${BASE_URL}`,
            'referer': `${USER_URL}`,
            'Cookie': cookie,
            'User-Agent': UA,
            'Content-Type': 'text/html; charset=utf-8'
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

function goUser(cookie) {
    return axios(`${USER_URL}`, {
        method: 'GET',
        headers: {
            'User-Agent': UA,
            'Cookie': cookie
        }
    })
    .then(d => {

        const decodeHtmlStr = getDecodeHtmlStr(d.data)
        const $ = cheerio.load(decodeHtmlStr)
        const unUsedTraffic = $('.card-wrap:contains("剩余流量") > .card-body').text().trim()

        return { unUsedTraffic }
    })
    .catch(error => {
        console.error(error)
        return Promise.reject(`goUser->${error}`)
    })
}

function getDecodeHtmlStr(encodeHtmlStr){
    // polyfill for native atob, support utf-8
    function SlowerDecodeBase64(str) {
        // Going backwards: from bytestream, to percent-encoding, to original string.
        return decodeURIComponent(atob(str).split("").map(function (c) {
            return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(""));
    }
    // modern browsers use TextDecoder faster
    function FasterDecodeBase64(base64) {
        const text = atob(base64);
        const length = text.length;
        const bytes = new Uint8Array(length);
        let i = 0;
        for (i = 0; i < length; i++) {
            bytes[i] = text.charCodeAt(i);
        }
        const decoder = new TextDecoder(); // default is utf-8
        return decoder.decode(bytes);
    }

    function decodeBase64(str) {
        try {
            return FasterDecodeBase64(str);
        } catch (e) {
            return SlowerDecodeBase64(str);
        }
    }

    const reg = /(?<=var originBody = ").*?(?=";)/g
    const originBody = encodeHtmlStr.match(reg)

    // console.log(originBody)

    return decodeBase64(originBody[0])
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
            const { unUsedTraffic } = await goUser(userCookie)
            logger.info(`${checkin_result.msg}(剩余流量:${unUsedTraffic})`)
        } catch (error) {
            console.error(error)
            logger.error(error)
        } finally {
            logger.removeContext("user")
        }
    }

    await message.send_message({ 
        title: `${path.parse(__filename).name}_${dayjs.tz().format('YYYY-MM-DD HH:mm:ss')}`,
        message: getLog4jsStr(getLog4jsStr('ERROR') != '' ? 'ALL' : 'INFO') 
    });

})()

