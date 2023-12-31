| 参数          | 说明                                             |
| ------------- | ------------------------------------------------ |
| GP_TOKEN | 在 Action 中运行时更新 Repository secrets|
| PUSHPLUS_TOKEN | [pushplus](http://www.pushplus.plus) Token 消息推送 |
| REFRESH_TOKENS  | [阿里云盘](https://www.aliyundrive.com/drive) refresh_token, 多个账号 `&` 隔开 |
| GLADOS_COOKIE  | [GLADOS](https://glados.rocks/console) cookie, 多个账号 `&` 隔开 |
| HIFIN_COOKIE  | [HIFIN](https://www.hifini.com/) cookie, 多个账号 `&` 隔开 |

| 目标          | 配置文件                                             |
| ------------- | ------------------------------------------------ |
| [IKUUU](https://ikuuu.org/)  | [ikuuu_accounts.js](./config/ikuuu_accounts.js)  |
| [V2FREE](https://cdn.v2free.net/user)  | [v2free_accounts.js](./config/v2free_accounts.js) |
| [CLOUD189](https://cloud.189.cn/)  |  [cloud189_accounts.js](./config/cloud189_accounts.js) |

> **获取 refresh_token 的方法**
>
>  登录阿里云盘后，可以在`开发者工具(F12)` -> `Application` -> `Local Storage` 中的 `token` 字段对应的JSON中寻找`refresh_token`。

> **获取 GP_TOKEN 的方法**
>
> 点击 GitHub **用户** 头像 -> `Settings` (注意与配置 Secrets 不是同一个
> Settings) -> `Developer settings` -> `Personal access token` -> `Tokens(classic)` -> `Generate new token`
>
> 权限选择 `repo`, 不然不能更新 Secrets. 记住生成的 token, 离开页面后无法查看

> **Mattraks/delete-workflow-runs@v2**
> 
> `Repository Settings` -> `Actions` -> `General` -> ` Read and write permissions`

#### 参考项目
- @mrabit: [mrabit/aliyundriveDailyCheck](https://github.com/mrabit/aliyundriveDailyCheck/)
- @jinchaofs: [jinchaofs/v2free-checkin](https://github.com/jinchaofs/v2free-checkin/)
- @lukesyy: [lukesyy/glados_automation](https://github.com/lukesyy/glados_automation)
