const axios = require('axios')
const { logger } = require('./log4js')


const service = axios.create({
    timeout: 10 * 1000,         // 请求超时时间（超时后还未接收到数据，就需要再次发送请求）
    retry: 3,                   // 重试请求次数（最多重试几次请求）
    retryDelay: 1 * 1000,       // 重试请求间隔
    isUrlExcludeParams: true,   
});

// 请求拦截器
service.interceptors.request.use(
    config => {
        // Do something before request is sent

        config['request-startTime'] = new Date().getTime()

        return config
    },
    error => {
        // Do something with request error

        return Promise.reject(error)
    }
)

// 响应拦截器  
service.interceptors.response.use(async (response) => {
    
        printRequestDurationInfo(response.config)

        if(response.config?.retryCondition?.(response.data)) await handleRetry(response)

        return Promise.resolve(response);

    }, async (error) => {

        printRequestDurationInfo(error.config)

        // 如果有响应内容，就直接返回错误信息，不再发送请求
        if (error.response && error.response.data) return Promise.reject(error)

        await handleRetry(error) 

        return Promise.reject(error)
    }
)

const urlExcludeParams = (url) => { return url.replace(/^([^\?]*).*$/, '$1') }

function printRequestDurationInfo(config){
    const startTime = config['request-startTime']
    const currentTime = new Date().getTime()
    const requestDuration = ((currentTime - startTime) / 1000).toFixed(2)
    
    const logInfo = []
    logInfo.push(`${config.method}=>${config.isUrlExcludeParams ? urlExcludeParams(config.url) : config.url}`)
    logInfo.push(`requestDuration=${requestDuration}s`)
    logger.trace(logInfo.join(' '))
}

function handleRetry(r){

    const axiosConfig = r.config

    // If config does not exist or the retry option is not set, reject
    if (!axiosConfig || !axiosConfig.retry) return 

    // __retryCount用来记录当前是第几次发送请求
    axiosConfig.__retryCount = axiosConfig.__retryCount || 0

    // 如果当前发送的请求大于等于设置好的请求次数时，不再发送请求
    if (axiosConfig.__retryCount >= axiosConfig.retry) return 

    // 记录请求次数+1
    axiosConfig.__retryCount += 1

    // 设置请求间隔 指数增长的重试策略 下一次重试的延迟时间会翻倍
    axiosConfig.retryDelay = Math.pow(2, axiosConfig.__retryCount) * 1000;

    if (r.message && !(/^timeout of \d*ms exceeded$/).test(r.message)) console.error(r)

    const info = []
    info.push(`__retryCount=${axiosConfig.__retryCount}`)
    info.push(`retryDelay=${(axiosConfig.retryDelay / 1000)}s`)
    info.push(`${axiosConfig.method}=>${axiosConfig.isUrlExcludeParams ? urlExcludeParams(axiosConfig.url) : axiosConfig.url}`)
    // if (axiosConfig.params) info.push(`params=${axiosConfig.params}`)
    // if (axiosConfig.data) info.push(`data=${axiosConfig.data}`)
    if (r.data) info.push(`response.data=${JSON.stringify(r.data)}`)
    if (r.message) info.push(`error.message=${r.message}`)
    if (r.cause) info.push(`error.cause=${JSON.stringify(r.cause)}`)
    logger.warn(info.join(' '))

    const backoff = new Promise(function (resolve) {
        setTimeout(function () {
            resolve()
        }, axiosConfig.retryDelay)
    })

    return backoff.then(function () {
        return service(axiosConfig)
    })
}

module.exports = service
