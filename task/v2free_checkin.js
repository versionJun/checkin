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


function getV2freeCookie() {

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
    .then(d => {
        // console.log(checkin_result.data)
        // { ret: 0, msg: '您似乎已经签到过了...' }
        // {
        //     msg: '获得了 313MB 流量.',
        //     unflowtraffic: 1401946112,
        //     traffic: '1.31GB',
        //     trafficInfo: {
        //         todayUsedTraffic: '0B',
        //         lastUsedTraffic: '0B',
        //         unUsedTraffic: '1.31GB'
        //     },
        //     ret: 1
        // }

        if (d.data.msg == undefined) 
            return Promise.reject('cookie已过期或无效')

        return d.data
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
    .then(d => {

        const html_dom = new jsdom.JSDOM(d.data)

        const unUsedTraffic = html_dom.window.document.querySelector('.nodename > a[href^="/user/trafficlog"]').textContent.trim()

        return { unUsedTraffic }
    })
}

!(async () => {

    const V2FREE_COOKIE_ARR = getV2freeCookie()

    let index = 1
    const message = []
    for (V2FREE_COOKIE of V2FREE_COOKIE_ARR) {
        let account = `账号${index}`
        let remarks = `${account}`
        try {
            const cookieMap = getCookieMap(V2FREE_COOKIE);

            const checkin_result = await go_checkin_url(V2FREE_COOKIE)

            remarks += `---${checkin_result.msg}`

            remarks += `---${cookieMap.get("email")}`

            if (checkin_result.ret == 1){

                remarks += `---剩余流量:${checkin_result.trafficInfo.unUsedTraffic}`

            } else {

                const { unUsedTraffic } = await go_user_url(V2FREE_COOKIE)

                remarks += `---剩余流量:${unUsedTraffic}`

            }

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
