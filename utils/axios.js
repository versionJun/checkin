const axios = require('axios')
const { logger } = require('./log4js')


const service = axios.create({
    timeout: 8 * 1000,          // 请求超时时间（超时后还未接收到数据，就需要再次发送请求）
    retry: 3,                   // 全局重试请求次数（最多重试几次请求）
    retryDelay: 1 * 1000,       // 全局重试请求间隔
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
service.interceptors.response.use((response) => {
    
        printRequestDurationInfo(response.config)

        if(response.config?.retryCondition?.(response.data)) return handleRetry(response, false)

        return Promise.resolve(response);

    }, (error) => {

        printRequestDurationInfo(error.config)

        // 如果有响应内容，就直接返回错误信息，不再发送请求
        if (error.response && error.response.data) return Promise.reject(error)

        return handleRetry(error)

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

function handleRetry(r, isError = true){

    const axiosConfig = r.config

    // If config does not exist or the retry option is not set, reject
    if (!axiosConfig || !axiosConfig.retry) return isError ? Promise.reject(r) : Promise.resolve(r)

    // __retryCount用来记录当前是第几次发送请求
    axiosConfig.__retryCount = axiosConfig.__retryCount || 0

    // 如果当前发送的请求大于等于设置好的请求次数时，不再发送请求
    if (axiosConfig.__retryCount >= axiosConfig.retry) return isError ? Promise.reject(r) : Promise.resolve(r)

    // 记录请求次数+1
    axiosConfig.__retryCount += 1

    // 设置请求间隔 指数增长的重试策略 下一次重试的延迟时间会翻倍
    axiosConfig.retryDelay = Math.pow(2, axiosConfig.__retryCount) * 1000;

    // if (r.message && !(/^timeout of \d*ms exceeded$/).test(r.message)) console.error(r)

    const info = []
    info.push(`__retryCount=${axiosConfig.__retryCount}`)
    info.push(`retryDelay=${(axiosConfig.retryDelay / 1000)}s`)
    info.push(`${axiosConfig.method}=>${axiosConfig.isUrlExcludeParams ? urlExcludeParams(axiosConfig.url) : axiosConfig.url}`)
    // if (r.params) info.push(`${isError ? 'error':'response'}.data=${JSON.stringify(r.params)}`)
    if (r.data) info.push(`${isError ? 'error':'response'}.data=${JSON.stringify(r.data)}`)
    if (r.code) info.push(`${isError ? 'error':'response'}.code=${r.code}`)
    if (r.message) info.push(`${isError ? 'error':'response'}.message=${r.message}`)
    if (r.cause) info.push(`${isError ? 'error':'response'}.cause=${JSON.stringify(r.cause)}`)
    logger.warn(info.join(' '))

    return new Promise((resolve) => setTimeout(() => resolve(service(axiosConfig)), axiosConfig.retryDelay))
}

module.exports = service
