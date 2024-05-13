const axios = require('../utils/axios.js')
const path = require('path')
const { sent_message_by_pushplus } = require('../utils/message.js')
const { dayjs } = require('../utils/dayjs.js')
const { logger, getLog4jsStr } = require('../utils/log4js.js')


const CHECKIN_URL = `https://api.m.jd.com/client.action?functionId=signBeanAct&body=%7B%22fp%22%3A%22-1%22%2C%22shshshfp%22%3A%22-1%22%2C%22shshshfpa%22%3A%22-1%22%2C%22referUrl%22%3A%22-1%22%2C%22userAgent%22%3A%22-1%22%2C%22jda%22%3A%22-1%22%2C%22rnVersion%22%3A%223.9%22%7D&appid=ld&client=apple&clientVersion=10.0.4&networkType=wifi&osVersion=14.8.1"`

async function getJdCookie() {

    const JD_COOKIE = process.env.JD_COOKIE || ''

    const JD_COOKIE_ARR = JD_COOKIE.indexOf('&') > -1
        ? JD_COOKIE.split(/\s*&\s*/).filter(item => item !== '')
        : JD_COOKIE ? [JD_COOKIE] : [];

    if (!JD_COOKIE_ARR.length) {
        console.error("未获取到 JD_COOKIE , 程序终止")
        process.exit(0)
    }
    
    return JD_COOKIE_ARR
}

function goCheckin(cookie){
    return axios(`${CHECKIN_URL}`, {
        method: 'POST',
        headers: {
            'Cookie': cookie,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        }
    })
    .then(res => {
        logger.debug(`${JSON.stringify(res.data)}`)

        if (res.data.code !== '0') return Promise.reject(`签到失败(by:${res.data.errorMessage})`)
            
        const msg = []
        const dailyAward = res.data.data.dailyAward || res.data.data.continuityAward || res.data.data.newUserAward
        if (dailyAward.title) 
            msg.push(`${dailyAward.title}`) 
        if (dailyAward.subTitle) 
            msg.push(`${dailyAward.subTitle}`) 
        const beanCount = dailyAward.beanAward.beanCount || dailyAward.awardList[0].beanCount
        if (beanCount) 
            msg.push(`(京豆:${beanCount})`)
        const continuousDays = res.data.data.continuousDays
        if (continuousDays)
            msg.push(`(连续签到天数:${continuousDays})`)
        const totalUserBean = res.data.data.totalUserBean
        if (totalUserBean) 
            msg.push(`(总京豆:${totalUserBean})`)
        logger.info(msg.join(''))
    })
    .catch(error => {
        console.error(error)
        return Promise.reject(`goCheckin->${error}`)
    })
}

!(async () => {

    const JD_COOKIE_ARR = await getJdCookie()

    for (let index = 0; index < JD_COOKIE_ARR.length; index++) {
        const cookie = JD_COOKIE_ARR[index]
        if(!cookie) continue
        try {
            logger.addContext("user", `账号${index}`)
            await goCheckin(cookie)
        } catch (error) {
            console.error(error)
            logger.error(error)
        } finally {
            logger.removeContext("user")
        }
    }

    // console.log(`getLog4jsStr('INFO')\n${getLog4jsStr('INFO')}`)

    await sent_message_by_pushplus({ 
        title: `${path.parse(__filename).name}_${dayjs.tz().format('YYYY-MM-DD HH:mm:ss')}`,
        message: getLog4jsStr('INFO')
    });

})()

