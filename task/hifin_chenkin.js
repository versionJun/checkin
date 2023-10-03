const axios = require("axios")
const jsdom = require("jsdom")
const path = require('path')
const { sent_message_by_pushplus } = require('../utils/message.js')

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

!(async () => {

    const HIFIN_COOKIE_ARR = await getHifinCookie()
    
    let index = 1
    const message = []
    for await (HIFIN_COOKIE of HIFIN_COOKIE_ARR) {
        let remarks = "账号" + index
        try {

            let sign_result = await go_sign_url(HIFIN_COOKIE)

            let html_str = sign_result.data

            let html_dom = new jsdom.JSDOM(html_str)

            let username = html_dom.window.document.querySelector(".username") ? html_dom.window.document.querySelector(".username").textContent.trim() : 'cookie已过期或无效'
            
            let msg = html_dom.window.document.querySelector("#body") ? html_dom.window.document.querySelector("#body").textContent.trim() : null
            
            if(username) remarks += "---" + username

            if(msg) remarks += "---" + msg
            
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
        title: `${path.parse(__filename).name}_${new Date().toLocaleString()}`,
        message: message.join('\n') 
    });

})()