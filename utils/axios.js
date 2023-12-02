const axios = require('axios')
const { logger } = require('./log4js')


//请求超时时间（超时后还未接收到数据，就需要再次发送请求）
axios.defaults.timeout = 10 * 1000 

//设置全局重试请求次数（最多重试几次请求）
axios.defaults.retry = 3

//设置全局重试请求间隔
axios.defaults.retryDelay = 1000

//响应拦截器  
axios.interceptors.response.use((res) => {

        return Promise.resolve(res);

    }, (error) => {

        // console.error(error)

        const axiosConfig = error.config

        // If config does not exist or the retry option is not set, reject
        if (!axiosConfig || !axiosConfig.retry) return Promise.reject(error)

        // 如果有响应内容，就直接返回错误信息，不再发送请求
        if(error.response && error.response.data) return Promise.reject(error)

        // __retryCount用来记录当前是第几次发送请求
        axiosConfig.__retryCount = axiosConfig.__retryCount || 0

        // 如果当前发送的请求大于等于设置好的请求次数时，不再发送请求
        if (axiosConfig.__retryCount >= axiosConfig.retry)  return Promise.reject(error)

        // 记录请求次数+1
        axiosConfig.__retryCount += 1
                        
        // 设置请求间隔 在发送下一次请求之前停留一段时间，时间为重试请求间隔
        const backoff = new Promise(function (resolve) {
            console.error(error)
            const retryDelay =  axiosConfig.retryDelay || 1
            const errorInfo = []
            errorInfo.push(`__retryCount=${axiosConfig.__retryCount}`)
            errorInfo.push(`retryDelay=${retryDelay}`)
            errorInfo.push(`${axiosConfig.method}=>${axiosConfig.url}`)
            // if (axiosConfig.params) errorInfo.push(`params=${axiosConfig.params}`)
            // if (axiosConfig.data) errorInfo.push(`data=${axiosConfig.data}`)
            if (error.message) errorInfo.push(`error.message=${error.message}`)
            if (error.cause) errorInfo.push(`error.cause=${JSON.stringify(error.cause)}`)
            logger.error(errorInfo.join('; '))
            setTimeout(function () {
                resolve()
            }, retryDelay)
        })

        // 再次发送请求
        return backoff.then(function () {
            return axios(axiosConfig)
        })
    }
)

module.exports = axios
