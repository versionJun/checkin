| 公共参数              | 说明                                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------------------- |
| GP_TOKEN              | 在 Action 中运行时更新 Repository secrets                                                                      |
| <s>PUSHPLUS_TOKEN</s> | <s>[pushplus](http://www.pushplus.plus) Token 消息推送</s> `弃用于2024-08-01开始收费`                          |
| WXPUSHER_TOKEN        | [wxpusher文档](https://wxpusher.zjiecode.com/docs/) 创建应用并获取appToken即可                                 |
| WXPUSHER_UID          | [wxpusher管理后台](https://wxpusher.zjiecode.com/admin) 扫码关注了应用之后，在公众号，我的 -> 我的UID 即可获取 |

| 任务                                                                                                                                                        | 状态 | 参数                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------- |
| [阿里云盘](https://www.alipan.com/)<sup>[[task](./task/aliyundriver_checkin.js)]</sup><sup>[[workflow](./.github/workflows/aliyundriver_checkin.yml)]</sup> | ✅    | `REFRESH_TOKENS` 多账号 `&` 隔开                      |
| [天翼云盘](https://cloud.189.cn/)<sup>[[task](./task/cloud189_checkin.js)]</sup><sup>[[workflow](./.github/workflows/cloud189_checkin.yml)]</sup>           | ✅    | [cloud189_accounts.js](./config/cloud189_accounts.js) |
| [移动云盘](https://yun.139.com/)<sup>[[task](./task/cloud139_checkin.js)]</sup><sup>[[workflow](./.github/workflows/cloud139_checkin.yml)]</sup>            | ✅    | `CLOUD139_COOKIE ` 多账号 `&` 隔开                    |
| [夸克网盘](https://pan.quark.cn/)<sup>[[task](./task/quarkdriver_checkin.js)]</sup><sup>[[workflow](./.github/workflows/quarkdriver_checkin.yml)]</sup>     | ❌    | `QUARK_COOKIE ` 多账号 `&` 隔开                       |
| [京东](https://www.jd.com/)<sup>[[task](./task/jd_checkin.js)]</sup><sup>[[workflow](./.github/workflows/jd_checkin.yml)]</sup>                             | ❌    | `JD_COOKIE` 多账号 `&` 隔开                           |
| [百度贴吧](https://tieba.baidu.com)<sup>[[task](./task/baiduTieba_checkin.js)]</sup><sup>[[workflow](./.github/workflows/baiduTieba_checkin.yml)]</sup>     | ✅    | `BAIDUTIEBA_COOKIE` 多账号 `&` 隔开                   |
| [GLADOS](https://glados.rocks/console)<sup>[[task](./task/glados_checkin.js)]</sup><sup>[[workflow](./.github/workflows/glados_checkin.yml)]</sup>          | ✅    | [glados_accounts.js](./config/glados_accounts.js)     |
| [HIFIN](https://www.hifini.com/)<sup>[[task](./task/hifin_checkin.js)]</sup><sup>[[workflow](./.github/workflows/hifin_checkin.yml)]</sup>                  | ❌    | `HIFIN_COOKIE` 多账号 `&` 隔开                        |
| [IKUUU](https://ikuuu.org/)<sup>[[task](./task/ikuuu_checkin.js)]</sup><sup>[[workflow](./.github/workflows/ikuuu_checkin.yml)]</sup>                       | ✅    | [ikuuu_accounts.js](./config/ikuuu_accounts.js)       |
| [V2FREE](https://v2free.net/)<sup>[[task](./task/v2free_checkin.js)]</sup><sup>[[workflow](./.github/workflows/v2free_checkin.yml)]</sup>                   | ❌    | [v2free_accounts.js](./config/v2free_accounts.js)     |
| [TLY](https://tly31.com/)<sup>[[task](./task/tly_checkin.js)]</sup><sup>[[workflow](./.github/workflows/tly_checkin.yml)]</sup>                             | ❌    | `TLY_COOKIE ` 多账号 `&` 隔开                         |
| [VIVO](https://bbs.vivo.com.cn/newbbs/)<sup>[[task](./task/vivo_checkin.js)]</sup><sup>[[workflow](./.github/workflows/vivo_checkin.yml)]</sup>             | ✅    | `VIVO_COOKIE ` 多账号 `&` 隔开                        |

> **[Mattraks/delete-workflow-runs](https://github.com/Mattraks/delete-workflow-runs)@v2**
> 
> `Repository Settings` -> `Actions` -> `General` -> ` Read and write permissions`

> **获取 `GP_TOKEN` 的方法**
>
> 点击 GitHub **用户** 头像 -> `Settings` (注意与配置 Secrets 不是同一个
> Settings) -> `Developer settings` -> `Personal access token` -> `Tokens(classic)` -> `Generate new token`
>
> 权限选择 `repo`, 不然不能更新 Secrets. 记住生成的 token, 离开页面后无法查看

> **获取 `REFRESH_TOKENS` 的方法**
>
>  登录[阿里云盘](https://www.alipan.com/)后，可以在`开发者工具(F12)` -> `Application` -> `Local Storage` 中的 `token` 字段对应的JSON中寻找`refresh_token`。

> **获取 `CLOUD139_COOKIE` 的方法**
>
>  登录[移动云盘](https://yun.139.com/) 格式为`authorization=x;`

> **获取 `JD_COOKIE` 的方法**
>
>  登录[京东移动版](https://m.jd.com/) 格式为`pt_key=x;pt_pin=x;`
> 
>  `有效期一个月左右`

> **获取 `BAIDUTIEBA_COOKIE` 的方法**
>
>  登录[百度贴吧](https://tieba.baidu.com/) 格式为`BDUSS=x;`

#### 参考项目
- @mrabit: [mrabit/aliyundriveDailyCheck](https://github.com/mrabit/aliyundriveDailyCheck/)
- @jinchaofs: [jinchaofs/v2free-checkin](https://github.com/jinchaofs/v2free-checkin/)
- @lukesyy: [lukesyy/glados_automation](https://github.com/lukesyy/glados_automation)
- @wes-lin: [wes-lin/Cloud189Checkin](https://github.com/wes-lin/Cloud189Checkin)
- @HeiDaotu: [HeiDaotu/WFRobertQL](https://github.com/HeiDaotu/WFRobertQL)
- @nibabashilkk: [nibabashilkk/alipan_auto_sign](https://github.com/nibabashilkk/alipan_auto_sign)
- @imoki: [imoki/sign_script](https://github.com/imoki/sign_script)
- @Litre-WU: [Litre-WU/Sign](https://github.com/Litre-WU/Sign)
- @sudojia: [sudojia/scripts](https://github.com/sudojia/scripts)
