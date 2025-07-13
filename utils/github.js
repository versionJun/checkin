//参考:
//  https://docs.github.com/zh/rest/actions/secrets
//  https://juejin.cn/post/7201332537338462264

const { Octokit } = require("@octokit/core")
const sodium = require("libsodium-wrappers")

const GP_TOKEN = process.env.GP_TOKEN
const OWNER = process.env.GITHUB_REPOSITORY.split('/')[0]
const REPO = process.env.GITHUB_REPOSITORY.split('/')[1]

const DEFAULT_HEADERS = {
    'X-GitHub-Api-Version': '2022-11-28'
}

// https://github.com/octokit/core.js#readme
const octokit = new Octokit({
    // auth = GitHub token，参考 https://github.com/settings/tokens ，其中至少要有 repo 或 public_repo 权限才能修改 Actions Secrets
    auth: GP_TOKEN,
    request: {
        timeout: 10 * 1000, // 记得设置超时，否则会无限等待
    }
})


/**
 * 获取 存储库 公共密钥
 * 文档：https://docs.github.com/en/rest/actions/secrets?apiVersion=2022-11-28#get-a-repository-public-key
 * @param owner GitHub用户名
 * @param repo 仓库的名称
 * @returns 格式 { "key_id": "", "key": "" }
 */
async function getARepositoryPublicKey(owner, repo) {
    return (await octokit.request('GET /repos/{owner}/{repo}/actions/secrets/public-key', {
        owner: owner,
        repo: repo,
        headers: DEFAULT_HEADERS
    })).data
}

/**
 * 创建或更新 Repository Secret
 * 文档：https://docs.github.com/en/rest/actions/secrets?apiVersion=2022-11-28#create-or-update-a-repository-secret
 * @param data = { 
 *  owner : GitHub用户名(默认:获取当前值), 
 *  repo : 仓库的名称(默认:获取当前值), 
 *  secret_name : 要更改的secret的名称, 
 *  secret_value : 要更改的secret的原始值
 * }
 * @returns 响应状态代码 201=creating;204=updating;
 */
 async function createOrUpdateARepositorySecret(data) {

    const { owner = OWNER, repo = REPO, secret_name, secret_value } = data

    // Convert Secret & Base64 key to Uint8Array.
    const { key, key_id } = await getARepositoryPublicKey(owner, repo) // 获取公钥

    const binkey = sodium.from_base64(key, sodium.base64_variants.ORIGINAL)
    const binsec = sodium.from_string(secret_value)

    // Encrypt the secret using LibSodium
    const encBytes = sodium.crypto_box_seal(binsec, binkey)

    // Convert encrypted Uint8Array to Base64
    const encrypted_value = sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL) // 根据公钥计算加密后的值

    const newData = {
        owner,
        repo,
        secret_name,
        encrypted_value,
        key_id,
        headers: DEFAULT_HEADERS
    }

    return (await octokit.request('PUT /repos/{owner}/{repo}/actions/secrets/{secret_name}', newData)).status
}

/**
 * 获取 环境 公钥
 * 文档：https://docs.github.com/en/rest/actions/secrets?apiVersion=2022-11-28#get-an-environment-public-key
 * @param owner GitHub用户名
 * @param repo 仓库的名称
 * @returns 格式 { "key_id": "", "key": "" }
 */
async function getAnEnvironmentPublicKey(owner, repo, environment_name) {
    return (await octokit.request('GET /repos/{owner}/{repo}/environments/{environment_name}/secrets/public-key', {
        owner: owner,
        repo: repo,
        environment_name: environment_name,
        headers: DEFAULT_HEADERS
    })).data
}

/**
 * 创建或更新 environment secret
 * 文档：https://docs.github.com/zh/rest/actions/secrets?apiVersion=2022-11-28#create-or-update-an-environment-secret
 * @param data = { 
 *  owner : GitHub用户名(默认:获取当前值), 
 *  repo : 仓库的名称(默认:获取当前值), 
 *  environment_name : 环境名称,
 *  secret_name : 要更改的secret的名称, 
 *  secret_value : 要更改的secret的原始值
 * }
 * @returns 响应状态代码 201=creating;204=updating;
 */
 async function createOrUpdateAnEnvironmentSecret(data) {

    const { owner = OWNER, repo = REPO, environment_name, secret_name, secret_value } = data

    // Convert Secret & Base64 key to Uint8Array.
    const { key, key_id } = await getAnEnvironmentPublicKey(owner, repo, environment_name) // 获取公钥

    const binkey = sodium.from_base64(key, sodium.base64_variants.ORIGINAL)
    const binsec = sodium.from_string(secret_value)

    // Encrypt the secret using LibSodium
    const encBytes = sodium.crypto_box_seal(binsec, binkey)

    // Convert encrypted Uint8Array to Base64
    const encrypted_value = sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL) // 根据公钥计算加密后的值

    const newData = {
        owner,
        repo,
        environment_name,
        secret_name,
        encrypted_value,
        key_id,
        headers: DEFAULT_HEADERS
    }

    return (await octokit.request('PUT /repos/{owner}/{repo}/environments/{environment_name}/secrets/{secret_name}', newData)).status
}

exports.createOrUpdateARepositorySecret = createOrUpdateARepositorySecret
exports.createOrUpdateAnEnvironmentSecret = createOrUpdateAnEnvironmentSecret

