const axios = require('../utils/axios.js')
const path = require('path')
const message = require('../utils/message.js')
const { dayjs } = require('../utils/dayjs.js')
const { logger, getLog4jsStr } = require('../utils/log4js.js')


// 签到 - vivo官网社区签到抽签活动
const SIGNIN_URL = `https://bbs.vivo.com.cn/api/community/signIn/querySignInfo`
// 抽奖
const LOTTERY_URL = "https://bbs.vivo.com.cn/api/community/signIn/signInLottery"

const DEFAULTS_HEADERS = {
    'Host': 'bbs.vivo.com.cn',
    'charset': 'UTF-8',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2486.0 Safari/537.36 Edge/13.10586'
}

/*
备注：需要Cookie。cookie填写vivo社区网页版中获取的refresh_token。F12 -> NetWork -> 按一下Ctrl+R -> newbbs/ -> cookie
vivo社区网址：https://bbs.vivo.com.cn/newbbs/
*/
async function getCookie() {

    const COOKIE = process.env.VIVO_COOKIE || ''

    const COOKIE_ARR = COOKIE.indexOf('&') > -1
        ? COOKIE.split(/\s*&\s*/).filter(item => item !== '')
        : COOKIE ? [COOKIE] : [];

    if (!COOKIE_ARR.length) {
        console.error("未获取到 VIVO_COOKIE , 程序终止")
        process.exit(0)
    }
    
    return COOKIE_ARR
}

/**
 * 签到
 * 参考:https://github.com/imoki/sign_script/blob/main/polymerization/vivo.js#L479
 */
function signin(cookie){
    return axios(`${SIGNIN_URL}`, {
        method: 'POST',
        headers: {
            ...DEFAULTS_HEADERS,
            'Cookie': cookie,
        },
        data: {
            'signInId': '1',
        },
    })
    .then(res => {
        // console.log(res)
        // console.log(`${JSON.stringify(res.data)}`)

        if (res.data.code !== 0) return Promise.reject(`签到失败(by:${JSON.stringify(res.data)})`)

        logger.info(`签到成功`)
    })
    .catch(error => {
        console.error(error)
        return Promise.reject(`${arguments.callee.name}->${error}`)
    })
}

/**
 * 抽奖
 * 参考:https://github.com/imoki/sign_script/blob/main/polymerization/vivo.js#L435
 */
async function lottery(cookie){
    // 抽奖次数，默认3次
    const lotteryNum = 3

    for (let i = 0; i < lotteryNum; i++) {
        
        await axios(`${LOTTERY_URL}`, {
            method: 'POST',
            headers: {
                ...DEFAULTS_HEADERS,
                'Cookie': cookie,
            },
            data: {
                'lotteryActivityId': '1',
                'lotteryType': '0'
            },
        })
        .then(res => {
            // console.log(res)
            console.log(`${JSON.stringify(res.data)}`)
        
            if (res.data.code === 0) 
                logger.info(`第${i+1}抽奖成功: ${res.data.data.data.prizeName}`)
            else
                logger.info(`第${i+1}抽奖失败: ${res.data.msg}`)
        })
        .catch(error => {
            console.error(error)
            logger.error(`第${i+1}次抽奖失败错误,(by_error:${error})`)
        })
    }
}


!(async () => {

    const COOKIE_ARR = await getCookie()

    for (let index = 0; index < COOKIE_ARR.length; index++) {
        const cookie = COOKIE_ARR[index]
        if(!cookie) continue
        try {
            logger.addContext("user", `账号${index}`)
            await signin(cookie)
            await lottery(cookie)
        } catch (error) {
            console.error(error)
            logger.error(error)
        } finally {
            logger.removeContext("user")
        }
    }

    // console.log(`getLog4jsStr('INFO')\n${getLog4jsStr('INFO')}`)

    if (getLog4jsStr('ERROR') != '')
        await message.send_message({ 
            title: `${path.parse(__filename).name}_${dayjs.tz().format('YYYY-MM-DD HH:mm:ss')}`,
            message: getLog4jsStr('ALL')
        });

})()

