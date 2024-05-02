const axios = require('../utils/axios.js')
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
const crypto = require("crypto")


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
    // `https://m.cloud.189.cn/v2/drawPrizeMarketDetails.action?taskId=TASK_SIGNIN_PHOTOS&activityId=ACT_SIGNIN`,
    // `https://m.cloud.189.cn/v2/drawPrizeMarketDetails.action?taskId=TASK_2022_FLDFS_KJ&activityId=ACT_SIGNIN`,
]

// sessionKey
const GETUSERBRIEFINFO_URL = `https://cloud.189.cn/api/portal/v2/getUserBriefInfo.action`

// accessToken
const GETACCESSTOKENBYSSKEY_URL = `https://cloud.189.cn/api/open/oauth2/getAccessTokenBySsKey.action`

// familyId
const GETFAMILYLIST_URL = `https://api.cloud.189.cn/open/family/manage/getFamilyList.action`

// 家庭容量任务签到
const EXEFAMILYUSERSIGN_URL = `https://api.cloud.189.cn/open/family/manage/exeFamilyUserSign.action`

// 获取用户网盘容量信息
const GETUSERSIZEINFO_URL = `https://cloud.189.cn/api/portal/getUserSizeInfo.action`

axios.defaults.timeout = 5 * 1000
axios.defaults.retry = 5

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
        return Promise.reject(`goLoginUrl->${error}`)
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

        // console.log(res)

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

        logger.info(`${res.data.isSign ? '已经签到' : '签到成功'}(${dayjs.tz(dayjs(res.data.signTime)).format('YYYY-MM-DD HH:mm:ss')}),获得${res.data.netdiskBonus}M空间`)

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
            jar: cookieJar,
            isUrlExcludeParams: false
        })
        .then(res => {
            console.log(res.data)
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

function goGetUserBriefInfo(cookieJar){
    return axios(GETUSERBRIEFINFO_URL, {
        method: 'GET',
        jar: cookieJar
    })
    .then(res => {

        return res.data
    })
    .catch(error => {
        console.error(error)
        return Promise.reject(`goGetUserBriefInfo->${error}`) 
    })
}

/**
 * 将给定的数据对象转换为查询字符串格式。
 * @param {Object} data - 包含要转换为查询字符串的键值对的数据对象。
 * @returns {string} - 返回格式化的查询字符串，如果输入数据为空则返回空对象。
 */
const parameter = (data) => {
    // 当传入的数据为空时，直接返回一个空对象
    if (!data) {
        return {};
    }
    // 将数据对象转换为键值对数组，并通过“=”连接键和值
    const e = Object.entries(data).map((t) => t.join("="));
    // 对键值对数组按字典顺序进行排序
    e.sort((a, b) => (a > b ? 1 : a < b ? -1 : 0));
    // 将排序后的键值对数组通过“&”连接为查询字符串
    return e.join("&");
}
  
/**
 * 生成数据的签名
 * @param {Object} data - 需要签名的数据对象。
 * @returns {string} 返回经过MD5加密算法计算出的签名字符串。
 */
const getSignature = (data) => {
    // 通过parameter函数处理数据，生成签名字符串
    const sig = parameter(data)
    // 使用MD5算法对签名字符串进行加密，然后返回加密结果的16进制字符串
    return crypto.createHash("md5").update(sig).digest("hex");
}

function goGetAccessTokenBySsKey(cookieJar, sessionKey){
    const appkey = "600100422"
    const time = String(Date.now())
    const signature = getSignature({
        sessionKey,
        Timestamp: time,
        AppKey: appkey,
    })
    return axios(GETACCESSTOKENBYSSKEY_URL, {
        method: 'GET',
        headers: {
            'Sign-Type': '1',
            'Signature': signature,
            'Timestamp': time,
            'Appkey': appkey
        },
        params: {
            sessionKey: sessionKey
        },
        jar: cookieJar
    })
    .then(res => {

        return res.data
    })
    .catch(error => {
        console.error(error)
        return Promise.reject(`goGetAccessTokenBySsKey->${error}`) 
    })
}

function goGetFamilyList(cookieJar, accessToken){
    const time = String(Date.now())
    const signature = getSignature({
        Timestamp: time,
        AccessToken: accessToken,
    })
    return axios(GETFAMILYLIST_URL, {
        method: 'GET',
        headers: {
            'Sign-Type': '1',
            'Signature': signature,
            'Timestamp': time,
            'Accesstoken': accessToken,
            'Accept': 'application/json;charset=UTF-8',
        },
        jar: cookieJar
    })
    .then(res => {

        return res.data
    })
    .catch(error => {
        console.error(error)
        return Promise.reject(`goGetFamilyList->${error}`) 
    })
}

function goExeFamilyUserSign(cookieJar, familyId, accessToken){
    const time = String(Date.now())
    const signature = getSignature({
        familyId,
        Timestamp: time,
        AccessToken: accessToken,
    })
    return axios(EXEFAMILYUSERSIGN_URL, {
        method: 'GET',
        headers: {
            'Sign-Type': '1',
            'Signature': signature,
            'Timestamp': time,
            'Accesstoken': accessToken,
            'Accept': 'application/json;charset=UTF-8',
        },
        params: {
            'familyId': familyId
        },
        jar: cookieJar
    })
    .then(res => {

        return res.data
    })
    .catch(error => {
        console.error(error)
        return Promise.reject(`goExeFamilyUserSign->${error}`) 
    })
}

async function doFamilyTask(cookieJar){
    const { sessionKey } = await goGetUserBriefInfo(cookieJar)
    const { accessToken } = await goGetAccessTokenBySsKey(cookieJar, sessionKey)
    const { familyInfoResp } = await goGetFamilyList(cookieJar, accessToken)
    if (familyInfoResp) {
        for (let index = 0; index < familyInfoResp.length; index += 1) {
            const { familyId } = familyInfoResp[index]
            const res = await goExeFamilyUserSign(cookieJar, familyId, accessToken)
            logger.info(`家庭任务:${res.signStatus ? "已经签到过了" : "签到成功"}(${res.signTime}),签到获得${res.bonusSpace}M空间`)
        }
    }
}

function goGetUserSizeInfo(cookieJar){
    return axios(GETUSERSIZEINFO_URL, {
        method: 'GET',
        headers: {
            'Accept': 'application/json;charset=UTF-8',
        },
        jar: cookieJar
    })
    .then(res => {

        const userTotaiSize = (res.data.cloudCapacityInfo.totalSize / 1024 / 1024 / 1024).toFixed(2)
        const familyTotaiSize = (res.data.familyCapacityInfo.totalSize / 1024 / 1024 / 1024).toFixed(2)

        logger.info(`个人总容量:${userTotaiSize}G,家庭总容量:${familyTotaiSize}G`)
    })
    .catch(error => {
        console.error(error)
        return Promise.reject(`goGetUserSizeInfo->${error}`) 
    })
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
            await doFamilyTask(cookieJar)
            await goGetUserSizeInfo(cookieJar)
        } catch(error) {
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
