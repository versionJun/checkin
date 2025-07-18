const axios = require('../utils/axios.js')
const path = require('path')
const message = require('../utils/message.js')
const { dayjs } = require('../utils/dayjs.js')
const { logger, getLog4jsStr } = require('../utils/log4js.js')
const tough = require('tough-cookie')
const Cookie = tough.Cookie

axios.defaults.isUrlExcludeParams = false

const yun139Url = "https://yun.139.com", 
    caiyunUrl2 = "https://caiyun.feixin.10086.cn", 
    mnoteUrl = "https://mnote.caiyun.feixin.10086.cn";

const encryptPhone = (phone) => { return phone.replace(/^(\S{3})(?:\S*)(\S{4})$/, '$1****$2') }

const sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration))

const DATA = {
    baseUA: "Mozilla/5.0 (Linux; Android 13; 22041216C Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/121.0.6167.178 Mobile Safari/537.36",
    mailUaEnd: "(139PE_WebView_Android_10.2.2_mcloud139)",
    mailRequested: "cn.cj.pe",
    mcloudRequested: "com.chinamobile.mcloud"
}

const DEFAULTS_HEADERS = {
    "referer": "https://yun.139.com/w/",
    "accept": "application/json, text/plain, */*",
    "content-type": "application/json",
    "accept-language": "zh-CN,zh;q=0.9",
}

function getCloud139Cookie() {

    const CLOUD139_COOKIE = process.env.CLOUD139_COOKIE || ''

    const CLOUD139_COOKIE_ARR = CLOUD139_COOKIE.indexOf('&') > -1
        ? CLOUD139_COOKIE.split(/\s*&\s*/).filter(item => item !== '')
        : CLOUD139_COOKIE ? [CLOUD139_COOKIE] : [];

    if (!CLOUD139_COOKIE_ARR.length) {
        console.error("未获取到 CLOUD139_COOKIE , 程序终止")
        process.exit(0)
    }
    
    return CLOUD139_COOKIE_ARR
}

function getCookieMap(cookie) {

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

function getAuthInfo(cookie){
    const basicToken = getCookieMap(cookie).get('authorization').replace("Basic ", "")
    const rawToken = Buffer.from(basicToken, "base64").toString("utf-8"), [platform, phone, token] = rawToken.split(":")
    if (!/^1[3-9]\d{9}$/.test(phone)) return Promise.reject(`auth 格式解析错误，请查看是否填写正确的 auth`)
    return {
        phone: phone,
        token: token,
        auth: `Basic ${basicToken}`,
        platform: platform
    }
}

function getSsoTokenApi(session, toSourceId = "001005"){
    return axios(`${yun139Url}/orchestration/auth-rebuild/token/v1.0/querySpecToken`, {
        method: 'POST',
        headers: {
            ...DEFAULTS_HEADERS,
            "authorization": session.auth
        },
        data: {
            "toSourceId": toSourceId,
            account: String(session.phone),
            commonAccountInfo: {
                account: String(session.phone),
                accountType: 1
            }
        }
    })
    .then(res => {
        // logger.debug(`${JSON.stringify(res.data)}`)
        if (!res.data.success) return Promise.reject(`获取ssoToken失败(by:${JSON.stringify(res.data)})`)
        return res.data.data.token
    })
    .catch(error => {
        return Promise.reject(`getSsoTokenApi->${error}`)
    })
}

function getJwtTokenApi(session, ssoToken){
    return axios(`${caiyunUrl2}/portal/auth/tyrzLogin.action?ssoToken=${ssoToken}`, {
        method: 'GET',
        headers: {
            "authorization": session.auth
        },
    })
    .then(res => {
        // logger.debug(`${JSON.stringify(res.data)}`)
        if (res.data.code !== 0) return Promise.reject(`获取jwtToken失败(by:${JSON.stringify(res.data)})`)
        const cookies = []
        if (Array.isArray(res.headers['set-cookie']))
            res.headers['set-cookie'].map(item => {
                cookies.push(Cookie.parse(item).cookieString()) 
            })
        else 
            cookies = [Cookie.parse(res.headers['set-cookie']).cookieString()]
        return { 
            token: res.data.result.token,
            cookie: cookies.join(';')
        }
    })
    .catch(error => {
        console.error(error)
        return Promise.reject(`getJwtTokenApi->${error}`)
    })
}

async function getJwtToken(session){
    const ssoToken = await getSsoTokenApi(session)
    if (ssoToken) return await getJwtTokenApi(session, ssoToken);
}

function signInApi(session){
    return axios(`${caiyunUrl2}/market/signin/page/info?client=app`, {
        method: 'GET',
        headers: {
            ...DEFAULTS_HEADERS,
            // "authorization": session.auth,
            "jwttoken": session.token,
            // "cookie": session.cookie
        },
    })
    .then(res => {
        // logger.debug(`${JSON.stringify(res.data)}`)
        if (res.data.code !== 0) return Promise.reject(`失败(by:${JSON.stringify(res.data)})`)
        return res.data.result
    })
    .catch(error => {
        return Promise.reject(`signInApi->${error}`)
    })
}

async function signInTask(session){
    try {
        logger.addContext("任务", `盘每日签到`)
        const { todaySignIn, total, toReceive, curMonthBackup, curMonthBackupSignAccept } = await signInApi(session)
        session.isEnableBackup = (curMonthBackup && !curMonthBackupSignAccept) ? true : false
        if (todaySignIn) {
            logger.info(`已签到成功(当前云朵:${total}${toReceive ? `,待领取${toReceive}` : ""})`)
            return
        }
        await sleep(1000)
        const signInApiRes = await signInApi(session)
        logger.info(`${signInApiRes.todaySignIn ? '成功':'失败'} (当前云朵:${signInApiRes.total}${signInApiRes.toReceive ? `,待领取${signInApiRes.toReceive}` : ""})`)
    } catch (error) {
        logger.error(`signInTask->${error}`)
    } finally {
        logger.removeContext("任务")
    }
}

function signInMultiApi(session){
    return axios(`${caiyunUrl2}/market/signin/page/multiple`, {
        method: 'GET',
        headers: {
            ...DEFAULTS_HEADERS,
            // "authorization": session.auth,
            "jwttoken": session.token,
            // "cookie": session.cookie
        },
    })
    .then(res => {
        logger.debug(`${JSON.stringify(res.data)}`)

        if (res.data.code !== 0) return Promise.reject(`失败(by:${JSON.stringify(res.data)})`)

        const { cloudCount, multiple } = res.data.result

        multiple && logger.info(`成功获得[${multiple}]倍云朵,共计[${cloudCount}]`)

    })
    .catch(error => {
        return Promise.reject(`signInMultiApi->${error}`)
    })
}

async function signInMultiTask(session){
    try {
        logger.addContext("任务", `备份签到翻倍`)
        if (!session.isEnableBackup) {
            logger.info(`跳过任务(未开启备份)`)
            return
        }
        await signInMultiApi(session)
    } catch (error) {
        logger.error(`signInMultiTask->${error}`)
    } finally {
        logger.removeContext("任务")
    }
}

function signInWxApi(session){
    return axios(`${caiyunUrl2}/market/playoffic/followSignInfo?isWx=true`, {
        method: 'GET',
        headers: {
            ...DEFAULTS_HEADERS,
            // "authorization": session.auth,
            "jwttoken": session.token,
            // "cookie": session.cookie
        },
    })
    .then(res => {
        // logger.debug(`${JSON.stringify(res.data)}`)
        if (res.data.code !== 0) return Promise.reject(`失败(by:${JSON.stringify(res.data)})`)
        const result = res.data.result
        if (!result.todaySignIn && !result.isFollow ) {
            logger.info(`当前账号没有绑定微信公众号[中国移动云盘]})`)
            return
        }
        logger.info(`成功 (当前云朵:${result.total})`)
    })
    .catch(error => {
        logger.error(`signInWxApi->${error}`)
    })
}

async function signInWxTask(session){
    try {
        logger.addContext("任务", `公众号每日签到`)
        await signInWxApi(session)
    } catch (error) {
        logger.error(`signInWxTask->${error}`)
    } finally {
        logger.removeContext("任务")
    }
}

function getWxDrawInfoApi(session){
    return axios(`${caiyunUrl2}/market/playoffic/drawInfo`, {
        method: 'GET',
        headers: {
            ...DEFAULTS_HEADERS,
            // "authorization": session.auth,
            "jwttoken": session.token,
            // "cookie": session.cookie
        },
    })
    .then(res => {
        // logger.debug(`${JSON.stringify(res.data)}`)
        if (res.data.code !== 0) return Promise.reject(`获取公众号抽奖信息:失败(by:${JSON.stringify(res.data)})`)
        return res.data
    })
    .catch(error => {
        return Promise.reject(`getWxDrawInfoApi->${error}`)
    })
}

function doWxDarwApi(session){
    return axios(`${caiyunUrl2}/market/playoffic/draw`, {
        method: 'GET',
        headers: {
            ...DEFAULTS_HEADERS,
            // "authorization": session.auth,
            "jwttoken": session.token,
            // "cookie": session.cookie
        },
    })
    .then(res => {
        // logger.debug(`${JSON.stringify(res.data)}`)
        if (res.data.code !== 0) return Promise.reject(`微信抽奖:失败(by:${JSON.stringify(res.data)})`)
        return res.data
    })
    .catch(error => {
        return Promise.reject(`doWxDarwApi->${error}`)
    })
}

async function wxDrawTask(session){
    try {
        logger.addContext("任务", `公众号抽奖`)
        const wxDrawInfo = await getWxDrawInfoApi(session)
        if (wxDrawInfo.result.surplusNumber < 50) {
            logger.info(`已用每天首抽，(今日剩余次数:${wxDrawInfo.result.surplusNumber})(云朵:${wxDrawInfo.result.surplusPoints})`);
            return
        }
        const wxDarw = await doWxDarwApi(session)
        logger.info(`成功(${dayjs.tz(dayjs(wxDarw.insertTime)).format('YYYY-MM-DD HH:mm:ss')}),获得(${wxDarw.result.prizeName})`)
    } catch (error) {
        logger.error(`wxDrawTask->${error}`)
    } finally {
        logger.removeContext("任务")
    }
}

function clickTaskApi(session, task){
    return axios(`${caiyunUrl2}/market/signin/task/click?key=task&id=${task.id}`, {
        method: 'GET',
        headers: {
            ...DEFAULTS_HEADERS,
            // "authorization": session.auth,
            "jwttoken": session.token,
            // "cookie": session.cookie
        },
    })
    .then(res => {
        // logger.debug(`${JSON.stringify(res.data)}`)

        if(res.data.code !== 0)
           return Promise.reject(`点击-失败(by:${JSON.stringify(res.data)})`)
        
    })
    .catch(error => {
        return Promise.reject(`clickTaskApi->${error}`)
    })
}

const getParentCatalogID = () => { return "00019700101000000001" }

function randomHex(length, pad = "-") {
    return Array.isArray(length) ? length.map((l) => randomHex(l, pad)).join(pad) : Array.from({
        length: length
    }).map(() => Math.floor(Math.random() * 16).toString(16)).join("");
}
function uploadFileDailyApi(session){
    const parentCatalogID = getParentCatalogID(),
        contentSize = 0, 
        contentName = `asign${randomHex(4)}.png`, 
        digest = 'd41d8cd98f00b204e9800998ecf8427e';
    return axios(`${yun139Url}/orchestration/personalCloud/uploadAndDownload/v1.0/pcUploadFileRequest`, {
        method: 'POST',
        headers: {
            ...DEFAULTS_HEADERS,
            "authorization": session.auth,
            "jwttoken": session.token,
            // "cookie": session.cookie
        },
        data: {
            commonAccountInfo: {
                account: String(session.phone),
            },
            fileCount: 1,
            totalSize: contentSize,
            uploadContentList: [
                {
                    contentName: contentName,
                    contentSize: contentSize,
                    comlexFlag: 0,
                    digest: digest
                }
            ],
            newCatalogName: "",
            parentCatalogID: parentCatalogID,
            operation: 0,
            path: "",
            manualRename: 2,
            autoCreatePath: [],
            tagID: "",
            tagType: "",
            seqNo: ""
        }
    })
    .then(res => {
        // logger.debug(`${JSON.stringify(res.data)}`)
        
        if(res.data.code !== '0')
            return Promise.reject(`上传-失败(by:${JSON.stringify(res.data)})`)

    })
    .catch(error => {
        return Promise.reject(`uploadFileDailyApi->${error}`)
    })
}

async function uploadFileDailyTask(session){
    const task = {
        id: 106,
        name: "手动上传一个文件",
    }
    try {
        logger.addContext("任务", `${task.name}`)

        await clickTaskApi(session, task) 

        await uploadFileDailyApi(session)

        logger.info(`成功`)

    } catch (error) {
        logger.error(`uploadFileDailyTask->${error}`)
    } finally {
        logger.removeContext("任务")
    }
}

function receiveApi(session){
    return axios(`${caiyunUrl2}/market/signin/page/receive`, {
        method: 'GET',
        headers: {
            ...DEFAULTS_HEADERS,
            // "authorization": session.auth,
            "jwttoken": session.token,
            // "cookie": session.cookie
        },
    })
    .then(res => {
        // logger.debug(`${JSON.stringify(res.data)}`)
        if (res.data.code !== 0) return Promise.reject(`失败(by:${JSON.stringify(res.data)})`)
        return res.data
    })
    .catch(error => {
        return Promise.reject(`receiveApi->${error}`)
    })
}

async function receiveTask(session){
    try {
        logger.addContext("任务", `领取云朵`)
        const receiveApiRes = await receiveApi(session) 
        logger.info(`${receiveApiRes.result.receive > 0 ? `领取云朵:${receiveApiRes.result.receive}`:'暂无待领取云朵'} (当前云朵:${receiveApiRes.result.total})`)
    } catch (error) {
        logger.error(`receiveTask->${error}`)
    } finally {
        logger.removeContext("任务")
    }
}

async function doTask(session){
    // 云盘每日签到
    await signInTask(session)

    // 备份签到翻倍
    await signInMultiTask(session)

    // 公众号每日签到
    await signInWxTask(session)

    // 公众号抽奖
    await wxDrawTask(session)

    // 每日任务-手动上传一个文件
    // await uploadFileDailyTask(session)    //{"success":false,"code":"101002009","message":"无接口权限,服务器拒绝执行","data":null}

    // 领取云朵
    await receiveTask(session)
}

!(async () => {

    const CLOUD139_COOKIE = await getCloud139Cookie()

    for (let [index, value] of CLOUD139_COOKIE.entries()) {
        if (!value) continue
        try {
            logger.addContext("user", `账号${index}`)
            const authInfo = await getAuthInfo(value)
            logger.addContext("user", `账号${index}(${encryptPhone(authInfo.phone)})`)
            const { token, cookie } = await getJwtToken(authInfo)
            const session = { ...authInfo, token, cookie }
            await doTask(session)
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
            message: getLog4jsStr(getLog4jsStr('ERROR') != '' ? 'ALL' : 'INFO') 
        });

})()

