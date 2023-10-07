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

async function getHifinCookie() {

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

function go_sign_url(cookie){
    return axios('https://www.hifini.com/sg_sign.htm', {
        method: 'POST',
        headers: {
            'Origin': 'https://www.hifini.com/',
            'referer': 'https://www.hifini.com/',
            'Cookie': cookie,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.0.0 Safari/537.36',
            'Content-Type': 'text/html; charset=utf-8'
        }
    })
}

function go_my_url(cookie){
    return axios('https://www.hifini.com/my.htm', {
        method: 'GET',
        headers: {
            'Cookie': cookie,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.0.0 Safari/537.36',
            'Content-Type': 'text/html; charset=utf-8'
        }
    })
}

!(async () => {

    const HIFIN_COOKIE_ARR = await getHifinCookie()

    const COOKIE_INVALIDDITY = 'cookie已过期或无效'
    
    let index = 1
    const message = []
    for await (HIFIN_COOKIE of HIFIN_COOKIE_ARR) {
        let remarks = "账号" + index
        try {

            let sign_result = await go_sign_url(HIFIN_COOKIE)

            let html_dom = new jsdom.JSDOM(sign_result.data)

            let username = html_dom.window.document.querySelector(".username") ? html_dom.window.document.querySelector(".username").textContent.trim() : COOKIE_INVALIDDITY
            
            let msg = html_dom.window.document.querySelector("#body") ? html_dom.window.document.querySelector("#body").textContent.trim() : null
            
            if (username) remarks += `---${username}`

            if (msg) remarks += `---${msg}`

            if (username != COOKIE_INVALIDDITY) {

                let my_result = await go_my_url(HIFIN_COOKIE)

                html_dom = new jsdom.JSDOM(my_result.data)

                let species = Array.from(html_dom.window.document.querySelectorAll('span.text-muted')).find(el => el.textContent.includes('金币')).children[0].textContent.trim()
    
                remarks += `---剩余金币:${species}`

            } 
            
            console.log(remarks)

            message.push(remarks)

        } catch (e) {
            console.error(e)
            message.push(remarks + "---" +e)
            console.log(message);
        }
        index++
    }

    await sent_message_by_pushplus({ 
        title: `${path.parse(__filename).name}_${dayjs.tz().format('YYYY-MM-DD HH:mm:ss')}`,
        message: message.join('\n') 
    });

})()
