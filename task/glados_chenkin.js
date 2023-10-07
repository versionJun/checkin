const axios = require('axios')
const path = require('path')
const { sent_message_by_pushplus } = require('../utils/message.js')
const dayjs = require('dayjs')
const utc = require('dayjs/plugin/utc')
const timezone = require('dayjs/plugin/timezone')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Shanghai')


const checkin_url = "https://glados.rocks/api/user/checkin"
const status_url = "https://glados.rocks/api/user/status"
const referer = 'https://glados.rocks/console/checkin'
const origin = "https://glados.rocks"
const useragent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.0.0 Safari/537.36"
const payload = { 
        'token': 'glados.one'
      }

function go_checkin_url(cookie){
    return axios(checkin_url, {
        method: 'POST',
        data: payload,
        headers: {
            'Cookie': cookie,
            'referer': referer,
            'Origin': origin,
            'User-Agent': useragent,
            'Content-Type': 'application/json;charset=UTF-8'
        }
    })
    .then(d => {
        // console.log(JSON.stringify(d.data))
        // { code: -2, message: '没有权限' }

        if (d.data.code == -2 )
            return Promise.reject(`cookie已过期或无效(${d.data.message})`)

        return d.data
    })

}

function go_status_url(cookie){
    return axios(status_url, {
        method: 'GET',
        headers: {
            'Cookie': cookie,
            'referer': referer,
            'Origin': origin,
            'User-Agent': useragent
        }
    })
    .then(d => d.data)
}

function getGladosCookie() {

    let GLADOS_COOKIE = process.env.GLADOS_COOKIE || ''

    let GLADOS_COOKIE_ARR = []

    if (GLADOS_COOKIE.indexOf('&') > -1)
        GLADOS_COOKIE_ARR = GLADOS_COOKIE.split(/\s*&\s*/).filter(item => item != '')
    else if (GLADOS_COOKIE)
        GLADOS_COOKIE_ARR = [GLADOS_COOKIE]

    if (!GLADOS_COOKIE_ARR.length) {
        console.error("未获取到GLADOS_COOKIE, 程序终止")
        process.exit(0);
    }
    
    return GLADOS_COOKIE_ARR
}

!(async () => {

    const GLADOS_COOKIE_ARR = getGladosCookie()
    let index = 1
    const message = []
    for (GLADOS_COOKIE of GLADOS_COOKIE_ARR) {
        let account = `账号${index}`
        let remarks = `${account}`
        try {

            const checkin_result = await go_checkin_url(GLADOS_COOKIE);

            const statis_result = await go_status_url(GLADOS_COOKIE);

            const msg = checkin_result.message

            const balance = parseInt(checkin_result.list[0].balance)

            const leftdays = parseInt(statis_result.data.leftDays)

            const email = statis_result.data.email

            remarks += `---${email}---结果:${msg}---天数:${leftdays}---点数:${balance}`

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
