const axios = require('axios')

const API_KEY = process.env.BAIDU_API_KEY
const SERCRET_KEY = process.env.BAIDU_SERCRET_KEY 


/**
 * 百度OCR通用文字识别API
 * 文档:https://cloud.baidu.com/doc/OCR/s/zk3h7xz52
 * @param {*} access_token 百度access_token
 * @param {*} base64_img   base64图片
 * @returns 
 */
async function getBaiduOCR(access_token, base64_img){
    // general_basic  标准版 免费额度：1000次/月
    // general        标准含位置版 免费额度：1000次/月
    // accurate_basic 高精度版 免费额度：1000次/月
    // accurate       高精度含位置版 免费额度：500次/月
    return axios(`https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic?access_token=${access_token}`, {
        method: 'POST',
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        data: {
            'image': base64_img
        }
    })
    .then(d => {
        // console.log(d.data)
        let result = ''
        d.data.words_result.forEach((item) => {
            result += item.words.replace(/\s/g,"")
        })
        console.log(`getBaiduOCR result = ${result}`)
        return result
    })
    .catch(e => {
        console.log('getBaiduORC > catch > e = '  + e);
        console.error(e);
    })

}


/**
 * 利用百度AppKey、百度SecretKey, 生成百度access_token
 * 文档:https://ai.baidu.com/ai-doc/REFERENCE/Ck3dwjhhu
 * @returns 
 */
async function getBaiduAccessToken(){
    return axios(`https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${API_KEY}&client_secret=${SERCRET_KEY}`, {
        method: 'POST',
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        }
    })
    .then(d => {
        // console.log(d.data)
        // console.log(d.data.access_token)
        return d.data.access_token
    })
    .catch(e => {
        console.log('getBaiduAccessToken > catch > e = '  + e);
        console.error(e);
    })
}

exports.getBaiduAccessToken = getBaiduAccessToken
exports.getBaiduOCR = getBaiduOCR
