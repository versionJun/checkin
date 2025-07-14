const accounts = require('../config/hifiti_accounts.js')

const axios = require('../utils/axios.js')
const cheerio = require('cheerio')
const path = require('path')
const { logger, getLog4jsStr } = require('../utils/log4js.js')
const message = require('../utils/message.js')
const { dayjs } = require('../utils/dayjs.js')
const tough = require('tough-cookie')
const puppeteer = require("puppeteer")
const { createOrUpdateAnEnvironmentSecret } = require('../utils/github.js')


const BASE_URL = 'https://www.hifiti.com/'
const USER_LOGIN_URL = `${BASE_URL}user-login.htm`
const SG_SIGN_URL = `${BASE_URL}sg_sign.htm`
const MY_URL = `${BASE_URL}my.htm`
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function sleep(duration) {
    return new Promise(resolve => {
        console.log(`sleep ${duration}ms`)
        setTimeout(resolve, duration)
    })
}
async function run(email, password) {

    if (!email || !password) return Promise.reject(`登录失败:请填写账号和密码(by:puppeteer)`)

    const browser = await puppeteer.launch({
        // headless: false,    //这里我设置成false主要是为了让大家看到效果，设置为true就不会打开浏览器
        // headless: true,    //这里我设置成false主要是为了让大家看到效果，设置为true就不会打开浏览器
        // headless: "shell",
        // executablePath: '/usr/bin/chromium-browser',
        headless: "new",
        args: ["--no-sandbox",'--disable-extensions'],
        defaultViewport: null,
        timeout: 1000 * 100
    })

    try {
        const page = await browser.newPage()

        await page.goto(`${USER_LOGIN_URL}`, {
            timeout: 1000 * 60    //60s
        })
        console.log(`=> 打开: ${USER_LOGIN_URL}`)
        await sleep(1000)
        
        await page.$eval('input[name="email"]', (input, email) => {
            input.value = email
        }, email)
        console.log(`=> 输入: email`)
        await sleep(1000)
        
        await page.$eval('input[name="password"]', (input, password) => {
            input.value = password
        }, password)
        console.log(`=> 输入: password`)
        await sleep(1000)
        
        await page.click("#submit")
        console.log(`=> 点击: submit`)
        await sleep(3000)

        // await page.waitForNavigation()

        const ele_uname = await page.$('.nav-item.username')
        if (!ele_uname) return Promise.reject(`登录失败(by:puppeteer)`)

        const uname = await page.evaluate(element => element.innerText, ele_uname)
        console.log(`=> 登录成功: ${uname}`)


        const cookies = await page.cookies();
        const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

        // console.log(cookieString);

        return cookieString
    } catch (error) {

        return Promise.reject(`run->${error}`)

    } finally {

        browser.close()
    }

}

function goSgSign(cookie) {
    return axios(`${SG_SIGN_URL}`, {
        method: 'POST',
        headers: {
            'Cookie': cookie,
            'User-Agent': UA,
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(d => {
        // console.log(d.config)
        // console.log(d.data)
        // { code: '0', message: '成功签到！今日排名1917，总奖励2金币！' }
        // { code: '-1', message: '今天已经签过啦！' }
        // { code: '0', message: '请登录后再签到!' }

        // if (d.data.message.match(/.*登录.*/g)) 
        //     return Promise.reject(`签到失败(by:${d.data.message})`)

        return {
            ssuccess: !d.data.message.match(/.*登录.*/g),
            msg: d.data.message
        }
    })
    .catch(error => {
        console.error(error)
        return Promise.reject(`goSgSign->${error}`)
    })
}

function goMy(cookie) {
    return axios(`${MY_URL}`, {
        method: 'GET',
        headers: {
            'Cookie': cookie,
            'User-Agent': UA,
            'Content-Type': 'text/html; charset=utf-8'
        }
    })
    .then(d => {
        const $ = cheerio.load(d.data)
        if (!$('.nav-item.username').text().trim()) return Promise.reject('cookie已过期或无效')

        // const species = $('span.text-muted:contains("金币") > em').text().trim()
        const species = $('span.text-muted:contains("金币")').next('em').text().trim()

        return { species }
    })
    .catch(error => {
        console.error(error)
        return Promise.reject(`goMy->${error}`)
    })
}

async function updateCookie(userCookie, index) {
    const environment_name = 'hifiti'
    const secret_name = `HIFITI_COOKIE_${index}`
    try {
        const res = await createOrUpdateAnEnvironmentSecret({
            // owner: OWNER, 
            // repo: REPO, 
            environment_name: environment_name,
            secret_name: secret_name,
            secret_value: userCookie
        })
        logger.info(`更新 ${environment_name} ${secret_name} res=${res}`)
    } catch (error) {
        console.error(error)
        logger.info(`更新 ${environment_name} ${secret_name} 失败 error=${error}`)
    }
}

!(async () => {

    for (let index = 0; index < accounts.length; index++) {
        const user = accounts[index]
        if (!user.cookie)
            continue
        try {
            logger.addContext("user", `账号${index}`)
            let userCookie = user.cookie
            const res1 = await goSgSign(userCookie)
            if (res1.ssuccess) {
                logger.info(`${res1.msg}`)
            } else {
                logger.info(`cookie已过期或无效,开始重新登录...`)
                userCookie = await run(user.email, user.password)
                logger.info(`登录成功,cookie抓取成功...`)
                await updateCookie(userCookie, index)
                const res2 = await goSgSign(userCookie)
                logger.info(`${res2.msg}`)
            }
            const { species } = await goMy(userCookie)
            logger.info(`剩余金币:${species}`)

        } catch (error) {
            console.error(error)
            logger.error(error)
        } finally {
            logger.removeContext("user")
        }
    }

    await message.send_message({
        title: `${path.parse(__filename).name}_${dayjs.tz().format('YYYY-MM-DD HH:mm:ss')}`,
        message: getLog4jsStr('ALL')
    });

})()
