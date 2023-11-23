const axios = require('../utils/axios.js')
const path = require('path')
const { createOrUpdateARepositorySecret } = require('../utils/github.js')
const { sent_message_by_pushplus } = require('../utils/message.js')
const { dayjs } = require('../utils/dayjs.js')
const { logger, getLog4jsStr } = require('../utils/log4js')

// 刷新令牌 
const TOKEN_URL = 'https://auth.aliyundrive.com/v2/account/token'
// 签到接口
const SIGNINLIST_URL = 'https://member.aliyundrive.com/v1/activity/sign_in_list'
// 兑换奖励接口
const SIGNINREWARD_URL = 'https://member.aliyundrive.com/v1/activity/sign_in_reward'

// 使用 refresh_token 更新 access_token
function goToken(refresh_token) {
    return axios(TOKEN_URL, {
        method: 'POST',
        data: {
            grant_type: 'refresh_token',
            refresh_token: refresh_token
        },
        headers: { 
            'Content-Type': 'application/json' 
        }
    })
    .then(res => {

        return res.data
    })
    .catch(error => {
        const errorMsg = ['goToken->']
        if (error.response && error.response.data) {
            logger.warn(`error.response.data=${JSON.stringify(error.response.data)}`)
            const { code, message } = error.response.data
            if (code === 'RefreshTokenExpired' || code === 'InvalidParameter.RefreshToken') {
                errorMsg.push('refresh_token已过期或无效')
            } else {
                errorMsg.push(`${message}`)
            }
        } else {
            errorMsg.push(`${error}`)
        }
        return Promise.reject(errorMsg.join(''))
    })
}

//签到列表
function goSignInList(access_token) {
    return axios(SIGNINLIST_URL, {
        method: 'POST',
        data: {
            isReward: false
        },
        params: {
            '_rx-s': 'mobile'
        },
        headers: {
            Authorization: access_token,
            'Content-Type': 'application/json'
        }
    })
    .then(async res => {

        if (!res.data.success) return Promise.reject(res.data.message)

        const { signInLogs, signInCount } = res.data.result
        
        const currentSignInfo = signInLogs[signInCount - 1] // 当天签到信息
        
        logger.info(`签到成功,本月累计签到${signInCount}天`)

        if (currentSignInfo.isReward) {
            const msg = []
            msg.push(`今日(${currentSignInfo.calendarMonth}${currentSignInfo.calendarDay}号)`)
            msg.push(`签到获得:${currentSignInfo.reward.name || ''}${currentSignInfo.reward.description || '' }`)
            if (currentSignInfo.reward.notice) msg.push(`(${currentSignInfo.reward.notice})`)
            logger.info(msg.join(''))
        }

        // 未领取奖励列表
        const rewards = signInLogs.filter(
            v => v.status === 'normal' && !v.isReward
        )
        if (rewards.length) {
            for await (reward of rewards) {
                const signInDay = reward.day
                try {
                    const rewardInfo = await goSginInReward(access_token, signInDay)
                    const msg = []
                    msg.push(`第${signInDay}天`)
                    msg.push(`奖励领取成功: ${rewardInfo.name || ''}${rewardInfo.description || '' }`)
                    if (rewardInfo.notice) msg.push(`(${rewardInfo.notice})`)
                    logger.info(msg.join(''))
                } catch (e) {
                    logger.error(`第${signInDay}天奖励领取失败:`, e)
                }
            }
        }

    })
    .catch(error => {
        console.error(error)
        return Promise.reject(`goSignInList->${error}`)
    })
}

// 领取奖励
function goSginInReward(access_token, signInDay) {
    return axios(SIGNINREWARD_URL, {
        method: 'POST',
        data: { 
            'signInDay': signInDay
        },
        params: {
            '_rx-s': 'mobile'
        },
        headers: {
            authorization: access_token,
            'Content-Type': 'application/json'
        }
    })
    .then(res => {
        if (!res.data.success) {
            return Promise.reject(res.data.message)
        }
        return res.data.result
    })
    .catch(error => {
        console.error(error)
        return Promise.reject(`goSginInReward->${error}`)
    })
}

async function getRefreshTokenArray() {

    let REFRESH_TOKENS = process.env.REFRESH_TOKENS || ''

    let refreshTokenArray = []

    if (REFRESH_TOKENS.indexOf('&') > -1)
        refreshTokenArray = REFRESH_TOKENS.split(/\s*&\s*/).filter(item => item != '');
    else if (REFRESH_TOKENS)
        refreshTokenArray = [REFRESH_TOKENS]

    if (!refreshTokenArray.length) {
        console.error("未获取到 REFRESH_TOKENS, 程序终止")
        process.exit(0);
    }
    
    return refreshTokenArray
}

!(async () => {

    const refreshTokenArray = await getRefreshTokenArray()
    const update_refreshTokenArray = []
    for (let index = 0; index < refreshTokenArray.length; index++) {
        const refresh_token = refreshTokenArray[index]
        if (!refresh_token) continue
        try {
            logger.addContext("user", `账号${index}`)
            const tokenResult = await goToken(refresh_token)
            logger.addContext("user", `账号${index}(${tokenResult.nick_name})`)
            await goSignInList(tokenResult.access_token)
            update_refreshTokenArray.push(tokenResult.refresh_token)
        } catch (error) {
            console.error(error)
            logger.error(error)
        } finally {
            logger.removeContext("user")
        }
    }

    if (update_refreshTokenArray.length) {
        try {
            const res = await createOrUpdateARepositorySecret({
                // owner: OWNER, 
                // repo: REPO, 
                secret_name: 'REFRESH_TOKENS', 
                secret_value: update_refreshTokenArray.join("&")
            })
            logger.info(`更新REFRESH_TOKENS成功 res=${res}`)
        } catch (error) {
            console.error(error)
            logger.info(`更新REFRESH_TOKENS失败 error=${error}`)
        } 
    }

    // console.log(`getLog4jsStr()\n${getLog4jsStr()}`)

    await sent_message_by_pushplus({ 
        title: `${path.parse(__filename).name}_${dayjs.tz().format('YYYY-MM-DD HH:mm:ss')}`,
        message: getLog4jsStr()
    });

})()
