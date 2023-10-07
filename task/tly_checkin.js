const axios = require('axios')
const path = require('path')
const fs = require('fs')
const jsdom = require("jsdom")
const { getBaiduAccessToken, getBaiduOCR } = require('../utils/baidu.js')
const { sent_message_by_pushplus } = require('../utils/message.js')
const dayjs = require('dayjs')
const utc = require('dayjs/plugin/utc')
const timezone = require('dayjs/plugin/timezone')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Shanghai')


const TLY_BASE_URL = 'https://tly31.com/'
const TLY_LOGIN_URL = `${TLY_BASE_URL}modules/index.php`
const TLY_CAPTCHA_URL = `${TLY_BASE_URL}other/captcha.php`
const TLY_CHECKIN_URL = `${TLY_BASE_URL}modules/_checkin.php?captcha=`
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.0.0 Safari/537.36'

async function getTlyCookie() {

    let cookie = process.env.TLY_COOKIE || ''
    
    let cookie_arr = []

    if (cookie.indexOf('&') > -1)
        cookie_arr = cookie.split(/\s*&\s*/).filter(item => item != '')
    else if (cookie)
        cookie_arr = [cookie]

    if (!cookie_arr.length) {
        console.error("未获取到 TLY_COOKIE , 程序终止")
        process.exit(0)
    }
    
    return cookie_arr
}


async function login(cookie) {
    return axios(TLY_LOGIN_URL, {
        method: 'POST',
        headers: {
            'User-Agent': UA,
            'Cookie': cookie
        }
    })
    .then(d => {
        let html_dom = new jsdom.JSDOM(d.data);

        let last_sign_time_element = html_dom.window.document.querySelector("#checkin-msg + p > code")

        if(!last_sign_time_element){
          
            return Promise.reject('cookie已过期或无效')
          
        }

        return last_sign_time_element.textContent.trim()
    })
}

async function captcha_arraybuffer_down(cookie) {
    return axios(TLY_CAPTCHA_URL, {
        method: 'GET',
        responseType: 'arraybuffer',
        headers: {
            'User-Agent': UA,
            'Cookie': cookie
        }
    })
    .then(d => {
      
        const dir = path.resolve(__dirname, '../temp', 'captcha.jpg')
      
        fs.writeFileSync(dir, d.data)

        const base64_prefix = 'data:image/png;base64,'

        // // btoa 创建一个 base-64 编码的字符串
        // // Uint8Array 创建8位无符号整型数组
        // // fromCharCode 将 Unicode 编码转为一个字符
        // const base64_data = btoa(
        //     new Uint8Array(d.data).reduce((data, byte) => data + String.fromCharCode(byte), '')
        // )

        const base64_data = Buffer.from(d.data, 'base64').toString('base64')

        const base64_img = `${base64_prefix}${base64_data}`

        // console.log(base64_img)

        return base64_img
    })
}


async function checkin(cookie, captcha) {
    return axios(`${TLY_CHECKIN_URL}${captcha}`, {
        method: 'GET',
        headers: {
            'User-Agent': UA,
            'Cookie': cookie
        }
    })
    .then(d => {

        let msg = d.data.replace(/^<script>alert..|..;self.location=document.referrer;<\/script>$/g,"")
        
        let isCheckin = !msg.includes('验证码错误')

        return { isCheckin, msg }

    })
}

async function flow_checkin(flow){
    
    if (flow.count_num >= 5) {

        flow.msg += `---签到失败---已达设定最高请求次数:(${flow.count_num})`

        return false
    }

    flow.count_num += 1;

    console.log(`flow.count_num = ${flow.count_num}`)

    // 获取验证码图
    let base64_img = await captcha_arraybuffer_down(flow.cookie)

    // 获取百度access_token
    if (!flow.baidu_access_token) {

        flow.baidu_access_token = await getBaiduAccessToken()
    
    }

    // 根据 百度access_token 验证码图, 获取OCR后的验证码
    let captcha_code = await getBaiduOCR(flow.baidu_access_token, base64_img)

    if (!captcha_code || captcha_code.length != 4) {

        return flow_checkin(flow)

    }

    // 根据验证码, 请求签到
    let resul_checkin = await checkin(flow.cookie, captcha_code)

    if (!resul_checkin.isCheckin) {

        return flow_checkin(flow)

    }

    flow.msg += resul_checkin.msg

    return true

}

!(async () => {

    const ILY_COOKIE_ARR = await getTlyCookie()

    let index = 1
    const message = []
    for await (ILY_COOKIE of ILY_COOKIE_ARR) {
        let account = `账号${index}`
        let remarks = `${account}`
        try {

            const cookieMap = new Map();

            decodeURIComponent(ILY_COOKIE)
                .split(/\s*;\s*/)
                .filter(item => item != '')
                .forEach((cookie) => {
                    const [key, value] = cookie.split("=");
                    cookieMap.set(key, value);
                })
            
            if(cookieMap.get("user_email"))
                remarks += `---${cookieMap.get("user_email")}`

            let flow = { count_num: 0, msg: '' ,cookie: ILY_COOKIE, baidu_access_token:'' }
    
            let last_sign_time = await login(flow.cookie)

            let last_dayjs = dayjs(last_sign_time, 'YYYY-MM-DD HH:mm:ss')
            
            let now_dayjs = dayjs.tz()

            let time_str = `(上次签到时间:${last_sign_time})(本次触发时间:${now_dayjs.format('YYYY-MM-DD HH:mm:ss')})`

            if (now_dayjs.diff(last_dayjs, 'day') >= 1 ) {

                console.log(`距上次签到时间大于24小时啦,可签到${time_str}`)

                await flow_checkin(flow)

                remarks += `---${flow.msg}`

            } else {

               remarks += `还未到时间！${time_str}`
                
            }
            
            console.log(`remarks = ${remarks}`)
            
            message.push(remarks)

        } catch (e) {
            console.log(`${account} catch > e = ${e}`);
            console.error(e)
            message.push(remarks + "---" +e)
        }
        index++
    }

    console.log(message)
    
    // await sent_message_by_pushplus({ 
    //     title: `${path.parse(__filename).name}_${new Date().toLocaleString()}`,
    //     message: message.join('\n') 
    // });
})()


