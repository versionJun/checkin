const axios = require("axios")
// const jsdom = require("jsdom")
const cheerio = require('cheerio')
const path = require('path')
const { sent_message_by_pushplus } = require('../utils/message.js')
const dayjs = require('dayjs')
const utc = require('dayjs/plugin/utc')
const timezone = require('dayjs/plugin/timezone')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Shanghai')
const tough = require('tough-cookie')
const Cookie = tough.Cookie

const BASE_URL = 'https://ikuuu.org/'
const LOGIN_URL = `${BASE_URL}auth/login`
const USER_URL = `${BASE_URL}user/`
const CHECKIN_URL = `${BASE_URL}user/checkin`
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.0.0 Safari/537.36'


function getUser() {

    const userJsonStr = process.env.IKUUU_USER || ''

    if (!userJsonStr) {
        console.error("未获取到 IKUUU_USER , 程序终止")
        process.exit(0)
    }

    let userJson = JSON.parse(userJsonStr)

    if (!Array.isArray(userJson))
        userJson = [userJson]

    return userJson
}

function login(user){
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
        // console.log(d)

        // console.log(d.data)
        // { ret: 1, msg: '登录成功' }
        // { ret: 0, msg: '邮箱不存在' }
        // { ret: 0, msg: '邮箱或者密码错误' }
        if (d.data.ret !== 1) 
            return Promise.reject(`登录失败(by:${JSON.stringify(d.data)})`)

        // console.log(d.headers)
        let cookies = []
        if (Array.isArray(d.headers['set-cookie'])){
            d.headers['set-cookie'].map(item => {
                cookies.push(Cookie.parse(item).cookieString()) 
            })
        }
        else {
            cookies = [Cookie.parse(d.headers['set-cookie']).cookieString()]
        }

        // console.log(cookies)

        return cookies.join(';')
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

function go_checkin_url(cookie) {
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
        // console.log(d.data)
        // { ret: 0, msg: '您似乎已经签到过了...' }
        // { ret: 1, msg: '你获得了 1792 MB流量' }

        if (d.data.msg == undefined)
            return Promise.reject('cookie已过期或无效')

        return d.data
    })
}

function go_user_url(cookie) {
    return axios(`${USER_URL}`, {
        method: 'GET',
        headers: {
            'User-Agent': UA,
            'Cookie': cookie
        }
    })
    .then(d => {

        const $ = cheerio.load(d.data)

        // $('.card-wrap:contains("剩余流量") > .card-body').text().trim()
        const unUsedTraffic = $('.card-wrap:contains("剩余流量") > .card-body').text().trim()

        // $('.card-wrap > .card-body:contains("GB")').text().trim() 
        // const unUsedTraffic = $('.card-wrap > .card-body:contains("GB")').text().trim() 
        

        // const html_dom = new jsdom.JSDOM(d.data)
        
        // Array.from(document.querySelectorAll('.card-wrap')).find(el => el.textContent.includes('剩余流量')).children[1].textContent.trim() 
        // const unUsedTraffic = Array.from(html_dom.window.document.querySelectorAll('.card-wrap')).find(el => el.textContent.includes('剩余流量')).children[1].textContent.trim()

        // Array.from(document.querySelectorAll('.card-wrap > .card-body')).find(el => el.textContent.includes('GB')).textContent.trim() 
        // const unUsedTraffic = Array.from(html_dom.window.document.querySelectorAll('.card-wrap > .card-body')).find(el => el.textContent.includes('GB')).textContent.trim()

        return { unUsedTraffic }
    })
}

!(async () => {

    const userArr = getUser()

    let index = 1
    const message = []
    for (user of userArr) {
        let account = `账号${index}`
        let remarks = `${account}`
        try {

            const userCookie = await login(user)

            const cookieMap = getCookieMap(userCookie)

            const checkin_result = await go_checkin_url(userCookie)

            const { unUsedTraffic } = await go_user_url(userCookie)

            remarks += `---${checkin_result.msg}---${cookieMap.get("email")}---剩余流量:${unUsedTraffic}`

            console.log(remarks)

            message.push(remarks)

        } catch (e) {
            console.log(`${account} catch > e = ${e}`);
            console.error(e)
            message.push(remarks + "---" +e)
        }
        index++
    }

    // console.log(message)

    await sent_message_by_pushplus({ 
        title: `${path.parse(__filename).name}_${dayjs.tz().format('YYYY-MM-DD HH:mm:ss')}`,
        message: message.join('\n') 
    });

})()
