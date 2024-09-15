const axios = require('../utils/axios.js')
const path = require('path')
const message = require('../utils/message.js')
const { dayjs } = require('../utils/dayjs.js')
const { logger, getLog4jsStr } = require('../utils/log4js.js')


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

function signBean(cookie){
      return axios(`https://api.m.jd.com/client.action`, {
        method: 'POST',
        headers: {
            'Cookie': cookie,
            'User-Agent': 'jdapp',
            "Referer": "https://pro.m.jd.com",
        },
        params: {
            'functionId': 'signBeanAct',
            'body': '{}',
            'appid': 'signed_wh5_ihub',
            'client': 'apple',
            'clientVersion': '13.0.2',
            'h5st': '20240528100518226;5iy5yi6zngmi9yy4;9d49c;tk03w8a731b9741lMisyKzMrMjR382m8OHl6CME_42gdIK27Ztj59og7qFiXW6ANYumVHShrpZ3_ZS0YdGWqK3iY4Ppz;a791835d42061f132ff014304320d32c1e961322573832c7224985fdbbdb4a80;4.7;1716861918226;TKmWymVS34wMWdBCuoFxiVU9ZqmOQttKGrKnVObP83GJZYMza1mupKRvk-ZU6Nj4VdHOVgWbZu9qpwinIhHDWj703eS-Lz7cpZSUJmuAoevLoTGJlVk6nrDCJdsEqPdA9VL9QQJR-PzYFJipNAfyfKvauarIRTW7fGPA3pkTLjrAv_LsOFwkARWPBstGvW-pydLMlupoMyLwh15Je73wD50dMGxrcZXqP7KOLYCx4Hx-qv2YVtqPIE7qCyGHs292qExyfL-Qs_zDVBv1VTC1WM4xDMmWUHeHJUS_WWDFGYnOuVooASH9TGgekE09b_Aj42dBNZkEFasDO7ahC5QYbLg43mTNIeOt1gtErtxLkus9fR6JaZOlgE5dzuZ_tAfhzDpmY2LQb1zwv8oA91VEmsQRYtqe3KzB7K89QdjAvxWa1hwGxzRNDtBwYXJoTMRJ0YDA',
        },
        retryCondition: function(data){
            return data.code === '402' && data.message === '活动现在挤不进去呀，待会再来试试吧'
        }
    })
    .then(res => {
        logger.debug(`${JSON.stringify(res.data)}`)

        if (res.data.code !== '0') return Promise.reject(`签到失败(by:${JSON.stringify(res.data)})`)
            
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

function signIntegral(cookie){
    return axios(`https://lop-proxy.jd.com/jiFenApi/signInAndGetReward`, {
        method: 'POST',
        headers: {
            'Cookie': cookie,
            'User-Agent': 'jdapp',
            "Referer": "https://pro.m.jd.com",
            "AppParams": '{"appid":158,"ticket_type":"m"}',
            "uuid": `${(Math.floor(Date.now() / 1000) * 10 ** 13).toString()}`,
            "LOP-DN": "jingcai.jd.com"
        },
        params: {},
        data: [{"userNo": "$cooMrdGatewayUid$"}],
    })
    .then(res => {
        logger.debug(`${JSON.stringify(res.data)}`)

        const msg = ['京东快递积分签到:']
        if (res.data.code !== 1) {
            msg.push(`${res.data.msg}`)
        } else {
            msg.push(`成功`)
            msg.push(`获得(积分:${res.data.content[0].integralDTO.sendNum})`)
            msg.push(`(by:${JSON.parse(res.data.content[0].param).title})`)
        }
        logger.info(msg.join(''))
    
    })
    .catch(error => {
        console.error(error)
        return Promise.reject(`${arguments.callee.name}->${error}`)
    })
}

!(async () => {

    const JD_COOKIE_ARR = await getJdCookie()

    for (let index = 0; index < JD_COOKIE_ARR.length; index++) {
        const cookie = JD_COOKIE_ARR[index]
        if(!cookie) continue
        try {
            logger.addContext("user", `账号${index}`)
            await signBean(cookie)
            await signIntegral(cookie)
        } catch (error) {
            console.error(error)
            logger.error(error)
        } finally {
            logger.removeContext("user")
        }
    }

    // console.log(`getLog4jsStr('INFO')\n${getLog4jsStr('INFO')}`)

    await message.send_message({ 
        title: `${path.parse(__filename).name}_${dayjs.tz().format('YYYY-MM-DD HH:mm:ss')}`,
        message: getLog4jsStr(getLog4jsStr('ERROR') != '' ? 'ALL' : 'INFO') 
    });

})()

