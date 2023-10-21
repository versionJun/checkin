const axios = require('axios')
const path = require('path')
const { createOrUpdateARepositorySecret } = require('../utils/github.js')
const { sent_message_by_pushplus } = require('../utils/message.js')
const dayjs = require('dayjs')
const utc = require('dayjs/plugin/utc')
const timezone = require('dayjs/plugin/timezone')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Shanghai')

const updateAccesssTokenURL = 'https://auth.aliyundrive.com/v2/account/token'
const signinURL = 'https://member.aliyundrive.com/v1/activity/sign_in_list?_rx-s=mobile'
const rewardURL = 'https://member.aliyundrive.com/v1/activity/sign_in_reward?_rx-s=mobile'

// 使用 refresh_token 更新 access_token
// error "ETIMEDOUT" 当客户端请求未设超时，同时服务端也没设超时或者超时大于Linux kernel默认的20-second TCP socket connect timeout情况下，则达到20秒没连接成功，则报出"ETIMEDOUT"错误
// ETIMEDOUT 错误意味着请求花费的时间超过了 Web 服务器配置允许的时间，并且服务器已关闭连接。
function updateAccesssToken(queryBody, remarks, param) {
    const errorMessage = [remarks, '更新 access_token 失败']
    return axios(updateAccesssTokenURL, {
        method: 'POST',
        data: queryBody,
        headers: { 'Content-Type': 'application/json' }
    })
    .then(d => d.data)
    .catch(e => {
        console.error(e)
        errorMessage.push(e.message)
        console.log(`updateAccesssToken > catch > e = ${e.message}`)
        if (e.response && e.response.data) {
            console.log(`updateAccesssToken > catch > e.response.data = ${JSON.stringify(e.response.data)}`);
            const { code, message } = e.response.data
            if (
                code === 'RefreshTokenExpired' ||
                code === 'InvalidParameter.RefreshToken'
            ) {
                errorMessage.push('refresh_token 已过期或无效')
            } else {
                errorMessage.push(message)
            }
        } 
        if (e.code && e.code === 'ETIMEDOUT' && param.updateAccesssTokenErrorReconnect < param.updateAccesssTokenErrorReconnectMax) {
            param.updateAccesssTokenErrorReconnect += 1
            console.log(`param.updateAccesssTokenErrorReconnect = ${param.updateAccesssTokenErrorReconnect}`)
            remarks += `, param.updateAccesssTokenErrorReconnect = ${param.updateAccesssTokenErrorReconnect}`
            return updateAccesssToken(queryBody, remarks, param)
        }
        return Promise.reject(errorMessage.join(', '))
    })
}

//签到列表
function sign_in(access_token, remarks) {
    const sendMessage = [remarks]
    return axios(signinURL, {
        method: 'POST',
        data: {
            isReward: false
        },
        headers: {
            Authorization: access_token,
            'Content-Type': 'application/json'
        }
    })
    .then(d => d.data)
    .then(async json => {
        if (!json.success) {
                sendMessage.push('签到失败(01)', json.message)
                return Promise.reject(sendMessage.join(', '))
        }

        sendMessage.push('签到成功')


        const { signInLogs, signInCount } = json.result
        const currentSignInfo = signInLogs[signInCount - 1] // 当天签到信息

        sendMessage.push(`本月累计签到 ${signInCount} 天`)

        // 未领取奖励列表
        const rewards = signInLogs.filter(
            v => v.status === 'normal' && !v.isReward
        )

        if (rewards.length) {
            for await (reward of rewards) {
            const signInDay = reward.day
                try {
                    const rewardInfo = await getReward(access_token, signInDay)
                    sendMessage.push(
                        `第${signInDay}天奖励领取成功: 获得${rewardInfo.name || ''}${
                            rewardInfo.description || ''
                        }`
                    )
                } catch (e) {
                        sendMessage.push(`第${signInDay}天奖励领取失败:`, e)
                }
            }
        } else if (currentSignInfo.isReward) {
            sendMessage.push(
                `今日签到获得${currentSignInfo.reward.name || ''}${
                    currentSignInfo.reward.description || ''
                }`
            )
        }

        return sendMessage.join(', ')
    })
    .catch(e => {
        console.log('sign_in > catch > e ' + e)
        console.error(e)
        sendMessage.push(e.message)
        return Promise.reject(sendMessage.join(', '))
    })
}

// 领取奖励
function getReward(access_token, signInDay) {
    return axios(rewardURL, {
        method: 'POST',
        data: { signInDay },
        headers: {
            authorization: access_token,
            'Content-Type': 'application/json'
        }
    })
    .then(d => d.data)
    .then(json => {
      if (!json.success) {
        return Promise.reject(json.message)
      }

      return json.result
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

    const message = []
    let index = 1
    const update_refreshTokenArray = []
    for await (refreshToken of refreshTokenArray) {
        let remarks = refreshToken.remarks || `账号${index}`
        const queryBody = {
            grant_type: 'refresh_token',
            refresh_token: refreshToken.value || refreshToken
        }
        const param = {
            updateAccesssTokenErrorReconnect: 0,
            updateAccesssTokenErrorReconnectMax: 3
        }
        try {
            const { nick_name, refresh_token, access_token } =
                await updateAccesssToken(queryBody, remarks, param)

            if (nick_name && nick_name !== remarks)
                remarks = `${nick_name}(${remarks})`

            const sendMessage = await sign_in(access_token, remarks)

            update_refreshTokenArray.push(refresh_token)

            console.log(sendMessage)

            message.push(sendMessage)
        } catch (e) {
            console.log('catch > e = '  + e);
            console.error(e)
            message.push(e)
        }
        index++
    }

    if (update_refreshTokenArray.length) {
        let createOrUpdateARepositorySecret_msg = '更新 REFRESH_TOKENS ';
        try {
            let res = await createOrUpdateARepositorySecret({
                // owner: OWNER, 
                // repo: REPO, 
                secret_name: 'REFRESH_TOKENS', 
                secret_value: update_refreshTokenArray.join("&")
            })
            createOrUpdateARepositorySecret_msg += '成功 res = ' + res
        } catch (e) {
            createOrUpdateARepositorySecret_msg += '失败 e = ' + e
            console.error(e);
        } finally {
            console.log(createOrUpdateARepositorySecret_msg);
            message.push(createOrUpdateARepositorySecret_msg)
        }   
    }

    await sent_message_by_pushplus({ 
        title: `${path.parse(__filename).name}_${dayjs.tz().format('YYYY-MM-DD HH:mm:ss')}`,
        message: message.join('\n') 
    });
    
})()
