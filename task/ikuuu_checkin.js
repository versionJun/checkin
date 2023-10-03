const axios = require("axios")
const jsdom = require("jsdom")
const path = require('path')
const { sent_message_by_pushplus } = require('../utils/message.js')

const BASE_URL = process.env.BASE_URL || "https://ikuuu.art/";

async function getIkuuuCookie() {

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
}

function go_user_url(cookie){
    return axios(`${BASE_URL}user/`, {
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.0.0 Safari/537.36',
            'Cookie': cookie
        }
    })
}

!(async () => {

    const IKUUU_COOKIE_ARR = await getIkuuuCookie()
    
    let index = 1
    const message = []
    for await (IKUUU_COOKIE of IKUUU_COOKIE_ARR) {
        let remarks = "账号" + index
        try {
            const cookieMap = new Map();

            decodeURIComponent(IKUUU_COOKIE)
                .split(/\s*;\s*/)
                .filter(item => item != '')
                .forEach((cookie) => {
                    const [key, value] = cookie.split("=");
                    cookieMap.set(key, value);
                })

            let checkin_result = await go_checkin_url(IKUUU_COOKIE)

            remarks += '---' + cookieMap.get("email")

            remarks += '---' + (checkin_result.data.msg != undefined ? checkin_result.data.msg : 'cookie已过期或无效')

            let user_result = await go_user_url(IKUUU_COOKIE)

            let html_dom = new jsdom.JSDOM(user_result.data)
            
            let unUsedTraffic = Array.from(html_dom.window.document.querySelectorAll('.card-wrap')).find(el => el.textContent.includes('剩余流量')).children[1].textContent.trim()

            remarks += `---剩余流量:${unUsedTraffic}`
            
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
