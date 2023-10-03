const axios = require("axios")
const jsdom = require("jsdom")
const path = require('path')
const { sent_message_by_pushplus } = require('../utils/message.js')

async function getV2freeCookie() {

    let V2FREE_COOKIE = process.env.V2FREE_COOKIE || ''
    
    let V2FREE_COOKIE_ARR = []

    if (V2FREE_COOKIE.indexOf('&') > -1)
        V2FREE_COOKIE_ARR = V2FREE_COOKIE.split(/\s*&\s*/).filter(item => item != '')
    else if (V2FREE_COOKIE)
        V2FREE_COOKIE_ARR = [V2FREE_COOKIE]

    if (!V2FREE_COOKIE_ARR.length) {
        console.error("未获取到 V2FREE_COOKIE , 程序终止")
        process.exit(0)
    }

    return V2FREE_COOKIE_ARR
}

function go_checkin_url(cookie) {
    return axios('https://cdn.v2free.net/user/checkin', {
        method: 'POST',
        headers: {
            'Origin': 'https://cdn.v2free.net',
            'referer': 'https://cdn.v2free.net/user',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.0.0 Safari/537.36',
            'Cookie': cookie
        }
    })
}

function go_user_url(cookie){
    return axios('https://cdn.v2free.net/user/', {
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.0.0 Safari/537.36',
            'Cookie': cookie
        }
    })
}

!(async () => {

    const V2FREE_COOKIE_ARR = await getV2freeCookie()

    let index = 1
    const message = []
    for await (V2FREE_COOKIE of V2FREE_COOKIE_ARR) {
        let remarks = "账号" + index
        try {
            const cookieMap = new Map();

            decodeURIComponent(V2FREE_COOKIE)
                .split(/\s*;\s*/)
                .filter(item => item != '')
                .forEach((cookie) => {
                    const [key, value] = cookie.split("=");
                    cookieMap.set(key, value);
                })

            let checkin_result = await go_checkin_url(V2FREE_COOKIE)

            remarks += `---${cookieMap.get("email")}---${checkin_result.data.msg}`

            if (checkin_result.data.ret == 1){

                 remarks += `---剩余流量:${checkin_result.data.trafficInfo.unUsedTraffic}`
                
            } else {

                let user_result = await go_user_url(V2FREE_COOKIE)

                let html_dom = new jsdom.JSDOM(user_result.data)

                let unUsedTraffic = html_dom.window.document.querySelector('.nodename > a[href^="/user/trafficlog"]').textContent.trim()

                remarks += `---剩余流量:${unUsedTraffic}`

            }

            console.log(remarks)

            message.push(remarks)

        } catch (e) {
            console.error(e)
            message.push(remarks + "---" + e)
        }
        index++
    }

    await sent_message_by_pushplus({ 
        title: `${path.parse(__filename).name}_${new Date().toLocaleString()}`,
        message: message.join('\n') 
    });

})()
