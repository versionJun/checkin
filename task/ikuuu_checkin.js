const axios = require("axios")
const jsdom = require("jsdom")
const path = require('path')
const { sent_message_by_pushplus } = require('../utils/message.js')
const dayjs = require('dayjs')
const utc = require('dayjs/plugin/utc')
const timezone = require('dayjs/plugin/timezone')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Shanghai')


const BASE_URL = "https://ikuuu.art/";

function getIkuuuCookie() {

    let IKUUU_COOKIE = process.env.IKUUU_COOKIE || ''
    
    let IKUUU_COOKIE_ARR = []

    if (IKUUU_COOKIE.indexOf('&') > -1)
        IKUUU_COOKIE_ARR = IKUUU_COOKIE.split(/\s*&\s*/).filter(item => item != '')
    else if (IKUUU_COOKIE)
        IKUUU_COOKIE_ARR = [IKUUU_COOKIE]

    if (!IKUUU_COOKIE_ARR.length) {
        console.error("未获取到 IKUUU_COOKIE , 程序终止")
        process.exit(0)
    }
    
    return IKUUU_COOKIE_ARR
}

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

function go_checkin_url(cookie){
    return axios(`${BASE_URL}user/checkin`, {
        method: 'POST',
        headers: {
            'Origin': `${BASE_URL}`,
            'referer': `${BASE_URL}user/`,
            'Cookie': cookie,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.0.0 Safari/537.36',
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

function go_user_url(cookie){
    return axios(`${BASE_URL}user/`, {
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.0.0 Safari/537.36',
            'Cookie': cookie
        }
    })
    .then(d => {

        const html_dom = new jsdom.JSDOM(d.data)

        // $('.card-wrap:contains("剩余流量") > .card-body').text().trim()
        // $('.card-wrap > .card-body:contains("GB")').text().trim() 

        // Array.from(document.querySelectorAll('.card-wrap')).find(el => el.textContent.includes('剩余流量')).children[1].textContent.trim() 
        const unUsedTraffic = Array.from(html_dom.window.document.querySelectorAll('.card-wrap')).find(el => el.textContent.includes('剩余流量')).children[1].textContent.trim()

        // Array.from(document.querySelectorAll('.card-wrap > .card-body')).find(el => el.textContent.includes('GB')).textContent.trim() 
        // let unUsedTraffic = Array.from(html_dom.window.document.querySelectorAll('.card-wrap > .card-body')).find(el => el.textContent.includes('GB')).textContent.trim()
        
        return { unUsedTraffic }
    })
}

!(async () => {

    const IKUUU_COOKIE_ARR = getIkuuuCookie()
    
    let index = 1
    const message = []
    for (IKUUU_COOKIE of IKUUU_COOKIE_ARR) {
        let account = `账号${index}`
        let remarks = `${account}`
        try {
            const cookieMap = getCookieMap(IKUUU_COOKIE)

            const checkin_result = await go_checkin_url(IKUUU_COOKIE)
            
            remarks += `---${checkin_result.msg}`

            const { unUsedTraffic } = await go_user_url(IKUUU_COOKIE)

            remarks += `---${cookieMap.get("email")}---剩余流量:${unUsedTraffic}`

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
