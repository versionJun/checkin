const axios = require('axios')
const path = require('path')
const url = require('url') 
const JSEncrypt = require('node-jsencrypt')
const { CookieJar } = require('tough-cookie')
const { wrapper } = require('axios-cookiejar-support')
wrapper(axios)
const accounts = require('../config/cloud189_accounts.js')
const { sent_message_by_pushplus } = require('../utils/message.js')
const { dayjs } = require('../utils/dayjs.js')
const { logger, getLog4jsStr } = require('../utils/log4js')


const config = {
    clientId: '538135150693412',
    model: 'KB2000',
    version: '9.0.6',
    pre: '{NRP}',
    pubKey: 'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCZLyV4gHNDUGJMZoOcYauxmNEsKrc0TlLeBEVVIIQNzG4WqjimceOj5R9ETwDeeSN3yejAKLGHgx83lyy2wBjvnbfm/nLObyWwQD/09CmpZdxoFYCH6rdDjRpwZOZ2nXSZpgkZXoOBkfNXNxnN74aXtho2dqBynTw3NFTWyQl8BQIDAQAB', 
}

const config_headers = {
    'User-Agent': `Mozilla/5.0 (Linux; U; Android 11; ${config.model} Build/RP1A.201005.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/74.0.3729.136 Mobile Safari/537.36 Ecloud/${config.version} Android/30 clientId/${config.clientId} clientModel/${config.model} clientChannelId/qq proVersion/1.0.6`,
    Referer: 'https://m.cloud.189.cn/zhuanti/2016/sign/index.jsp?albumBackupOpened=1',
    'Accept-Encoding': 'gzip, deflate',
    Host: 'cloud.189.cn',
}

// 获取加密参数 pre pubKey
const ENCRYPTCONF_URL = 'https://open.e.189.cn/api/logbox/config/encryptConf.do'

// 获取登录参数 lt reqId
const LOGINURL_URL = 'https://cloud.189.cn/api/portal/loginUrl.action?redirectURL=https://cloud.189.cn/web/redirect.html?returnURL=/main.action'

// 获取登录参数 returnUrl paramId
const APPCONF_URL = 'https://open.e.189.cn/api/logbox/oauth2/appConf.do'

// 获取登录地址,跳转到登录页
const LOGINSUBMIT_URL = 'https://open.e.189.cn/api/logbox/oauth2/loginSubmit.do'

// 签到
const USERSIGN_URL = `https://cloud.189.cn/mkt/userSign.action?rand=${new Date().getTime()}&clientType=TELEANDROID&version=${config.version}&model=${config.model}`

// 天天抽红包
const DRAWPRIZEMARKETDETAILS_URL = [
    `https://m.cloud.189.cn/v2/drawPrizeMarketDetails.action?taskId=TASK_SIGNIN&activityId=ACT_SIGNIN`,
    `https://m.cloud.189.cn/v2/drawPrizeMarketDetails.action?taskId=TASK_SIGNIN_PHOTOS&activityId=ACT_SIGNIN`,
    `https://m.cloud.189.cn/v2/drawPrizeMarketDetails.action?taskId=TASK_2022_FLDFS_KJ&activityId=ACT_SIGNIN`,
]

//请求超时时间（5秒后还未接收到数据，就需要再次发送请求）
axios.defaults.timeout = 5 * 1000 

//设置全局重试请求次数（最多重试几次请求）
axios.defaults.retry = 3

//设置全局重试请求间隔
axios.defaults.retryDelay = 1000

//响应拦截器  
axios.interceptors.response.use((res) => {

        return Promise.resolve(res);

    }, (error) => {

        const axiosConfig = error.config

        if (!axiosConfig || !axiosConfig.retry) 
            return Promise.reject(error)

        // __retryCount用来记录当前是第几次发送请求
        axiosConfig.__retryCount = axiosConfig.__retryCount || 0

        // 如果当前发送的请求大于等于设置好的请求次数时，不再发送请求
        if (axiosConfig.__retryCount >= axiosConfig.retry) 
            return Promise.reject(error)

        // 记录请求次数+1
        axiosConfig.__retryCount += 1
                        
        // 设置请求间隔 在发送下一次请求之前停留一段时间，时间为重试请求间隔
        const backoff = new Promise(function (resolve) {
            const duration =  axiosConfig.retryDelay || 1
            logger.error(`__retryCount=${axiosConfig.__retryCount}; duration=${duration}; ${axiosConfig.method}=>${axiosConfig.url};${axiosConfig.data ? ` data=${axiosConfig.data};` : ''} Error.cause=${JSON.stringify(error.cause)};`)
            setTimeout(function () {
                resolve()
            }, duration)
        })

        // 再次发送请求
        return backoff.then(function () {
            return axios(axiosConfig)
        })
    }
)

function goEncryptConf(){
    if (config.pre && config.pubKey)
        return { 
            pre: config.pre, 
            pubKey: config.pubKey
        }
    return axios(ENCRYPTCONF_URL, {
        method: 'POST',
        data: {
            appId: 'cloud'
        }
    })
    .then(res => {
        console.log(res.data)
        if(res.data.result !== 0)
            return Promise.reject(res.data)
        return res.data.data
    })
    .catch(error => {
        console.error(error)
        return Promise.reject(`goEncryptConf->${error}`)
        // return Promise.reject(`${arguments.callee.name}->${error}`)
    })
}

function goLoginUrl() {
    return axios(LOGINURL_URL, {
        method: 'GET'
    })
    .then(res => {
        const urlStr = res.request.res.responseUrl
        const { query } = url.parse(urlStr, true)
        return query
    })
    .catch(error => {
        console.error(error)
        return Promise.reject(`goRedirect->${error}`)
    })
}

function goAppConf(username, password, pre, pubKey, query) {
    return axios(APPCONF_URL, {
        method: 'POST',
        data: {
            version: '2.0',
            appKey: 'cloud'
        },
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:74.0) Gecko/20100101 Firefox/76.0',
            'Referer': 'https://open.e.189.cn/',
            lt: query.lt,
            REQID: query.reqId,
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        }
    })
    .then(res => {

        if(res.data.result !== '0')
            return Promise.reject(`${res.data.msg}`)

        const keyData = `-----BEGIN PUBLIC KEY-----\n${pubKey}\n-----END PUBLIC KEY-----`;
        const jsencrypt = new JSEncrypt()
        jsencrypt.setPublicKey(keyData)
        const usernameEncrypt = Buffer.from(jsencrypt.encrypt(username), 'base64').toString('hex')
        const passwordEncrypt = Buffer.from(jsencrypt.encrypt(password), 'base64').toString('hex')
        const formData = {
            returnUrl: res.data.data.returnUrl,
            paramId: res.data.data.paramId,
            lt: `${query.lt}`,
            reqId: `${query.reqId}`,
            userName: `${pre}${usernameEncrypt}`,
            password: `${pre}${passwordEncrypt}`
        }

        return formData
    })
    .catch(error => {
        console.error(error)
        return Promise.reject(`goAppConf->${error}`)
    })
}

function goLoginSubmit(formData) {
    return axios(LOGINSUBMIT_URL, {
        method: 'POST',
        data: {
            appKey: 'cloud',
            version: '2.0',
            accountType: '01',
            mailSuffix: '@189.cn',
            validateCode: '',
            returnUrl: formData.returnUrl,
            paramId: formData.paramId,
            captchaToken: '',
            dynamicCheck: 'FALSE',
            clientType: '1',
            cb_SaveName: '0',
            isOauth2: false,
            userName: formData.userName,
            password: formData.password,
        },
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:74.0) Gecko/20100101 Firefox/76.0',
            'Referer': 'https://open.e.189.cn/',
            'lt': `${formData.lt}`,
            'REQID': `${formData.reqId}`,
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
    })
    .then(res => {

        if(res.data.result !== 0)
            return Promise.reject(`${res.data.msg}`)

        return res.data.toUrl
    })
    .catch(error => {
        console.error(error)
        return Promise.reject(`goLoginSubmit->${error}`)
    })

}

function goToUrl(toUrl, cookieJar){
    return axios(toUrl, {
        method: 'GET',
        headers: config_headers,
        jar: cookieJar
    })
    .then(res => {

    })
    .catch(error => {
        console.error(error)
        return Promise.reject(`goToUrl->${error}`)
    })
}

function goUserSign(cookieJar){
    return axios(USERSIGN_URL, {
        method: 'GET',
        jar: cookieJar
    })
    .then(res => {
        
        logger.info(`${res.data.isSign ? '已经签到' : '签到成功'},获得${res.data.netdiskBonus}M空间`)

    })
    .catch(error => {
        console.error(error)
        return Promise.reject(`goUserSign->${error}`) 
    })
}

async function goDrawPrizeMarketDetails(cookieJar){
    for (let index = 0; index < DRAWPRIZEMARKETDETAILS_URL.length; index++) {
        await axios(DRAWPRIZEMARKETDETAILS_URL[index], {
            method: 'GET',
            jar: cookieJar
        })
        .then(res => {
            
            if (res.data.errorCode === 'User_Not_Chance') 
                logger.info(`第${index+1}次抽奖失败,次数不足`)
            else
                logger.info(`第${index+1}次抽奖成功,抽奖获得${res.data.prizeName}`)

        })
        .catch(error => {
            console.error(error)
            return Promise.reject(`goDrawPrizeMarketDetails->${error}`)
        })
    }
}


!(async () => {

    for (let index = 0; index < accounts.length; index++) {
        const user = accounts[index]
        if(!user.username || !user.password)
            continue        
        try {
            logger.addContext("user", `账号${index}`)
            const { pre, pubKey } = await goEncryptConf()
            const query = await goLoginUrl()
            const formData = await goAppConf(user.username, user.password, pre, pubKey, query)
            const toUrl = await goLoginSubmit(formData)
            const cookieJar = new CookieJar()
            await goToUrl(toUrl, cookieJar)
            await goUserSign(cookieJar)
            await goDrawPrizeMarketDetails(cookieJar)
        } catch(error) {
            console.error(error)
            logger.error(error)
        } finally {
            logger.removeContext("user")
        }
    }
    
    // console.log(`getLog4jsStr()\n${getLog4jsStr()}`)

    await sent_message_by_pushplus({ 
        title: `${path.parse(__filename).name}_${dayjs.tz().format('YYYY-MM-DD HH:mm:ss')}`,
        message: getLog4jsStr() 
    });
})()
