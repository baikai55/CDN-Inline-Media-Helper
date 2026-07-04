# CDN Inline Media Helper

一个用于 Chrome / Edge 的 Manifest V3 浏览器扩展。它会把部分 `video.twimg.com` / `*.twimg.com` 视频链接交给浏览器内联播放，并在支持站点里提供当前页面弹窗播放器，减少可播放媒体被浏览器误判为文件保存的情况。

> 本项目与 X Corp. / Twitter 没有从属、赞助、背书或合作关系。Twitter、X 以及相关站点名称归各自权利人所有。
> 如果准备公开分发或上架扩展商店，建议使用更中性的扩展名称和图标，避免让用户误以为本项目由相关平台官方提供或认可。

## 功能

- 将 `video.twimg.com` 视频响应的 `Content-Disposition` 调整为 `inline`。
- 为 `.mp4` 视频链接设置更适合浏览器播放的 `Content-Type: video/mp4`。
- 在右键菜单中提供“内联播放媒体”入口。
- 对 `https://xxx.x/x/a/mHOXe` 这类短链接，会先解析最终的 `video.twimg.com` / `*.twimg.com` 视频地址。
- 当浏览器把可播放媒体误当作保存任务时，扩展会尝试取消该保存动作并改用播放器打开；本项目不提供批量下载、归档或内容分发功能。
- 支持在设置页添加自定义站点。自定义站点需要用户主动授权后才会启用。
- 弹窗播放器支持上一条 / 下一条、播放结束后自动下一条或循环当前视频。

## 安装

### Chrome

1. 打开 `chrome://extensions/`
2. 打开右上角“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择本项目文件夹：`twimg-inline-video-extension`

### Edge

1. 打开 `edge://extensions/`
2. 打开“开发人员模式”
3. 点击“加载解压缩的扩展”
4. 选择本项目文件夹：`twimg-inline-video-extension`

## 使用

安装后，重新打开或刷新目标网站，再点击 `video.twimg.com` / `*.twimg.com` 视频链接。

如果链接是可直接播放的 `.mp4`，浏览器通常会打开内置播放器，而不是保存为文件。也可以在视频缩略图、链接或页面上右键，选择“内联播放媒体”，这会打开扩展自带播放器，通常比直接打开原链接更稳定。

## 添加新站点

1. 点击浏览器工具栏里的扩展图标，打开设置页。
2. 在“添加站点”中输入域名，例如 `example.com`。
3. 确认浏览器弹出的站点权限授权。
4. 刷新目标网站。

添加后，扩展会在该站点启用同一套点击拦截和弹窗播放逻辑。建议只添加你信任且确实需要使用本扩展的网站。

## 权限说明

扩展声明的权限尽量围绕单一目的：识别受支持 CDN 的可播放媒体链接，并把它们交给浏览器内联播放。

- `declarativeNetRequest`：通过声明式规则修改目标视频响应头，避免直接读取或代理完整网络内容。
- `contextMenus`：提供右键菜单播放入口。
- `downloads`：检测浏览器误触发的媒体保存任务，并尝试改为在线播放。
- `scripting`：在用户授权的自定义站点上注册内容脚本。
- `storage`：保存自定义站点列表和播放器偏好。
- `tabs`：打开设置页、播放器页或必要的解析页。
- `host_permissions`：默认仅覆盖内置支持站点和受支持的视频 CDN 域名。
- `optional_host_permissions`：仅在用户主动添加自定义站点并确认授权后使用。

## 隐私说明

本扩展不包含统计、广告、远程配置或第三方 SDK。

扩展会在本地保存：

- 用户添加的自定义站点域名和匹配规则；
- 播放器的“自动下一条 / 循环当前视频”偏好。

扩展不会主动收集、上传、出售或共享用户数据。它会在支持站点页面内读取链接、图片、视频、`data-*` 属性等页面元素，用于识别可播放的视频地址；也会向目标链接发起必要请求，用于解析 `erozine.jp/x/a/...` 这类跳转链接。相关请求直接发生在用户浏览器中，不经过本项目作者的服务器。

如果准备发布到 Chrome Web Store，请按 Chrome Web Store 要求提供准确、可访问、持续更新的隐私政策，并确保商店页面、扩展说明和实际行为一致。

## 合规与风险边界

请把本扩展理解为“浏览器播放辅助工具”，而不是下载器、抓取器、归档器、镜像工具或内容分发工具。

使用者应自行确保：

- 只在有权访问和观看的内容上使用本扩展；
- 不使用本扩展绕过付费墙、登录限制、地区限制、访问控制、DRM 或其他技术保护措施；
- 不批量抓取、缓存、下载、转载、再分发、出售或公开传播他人视频内容；
- 不把本扩展用于自动化采集、内容备份、训练数据收集、规避平台限制或其他超出正常观看范围的用途；
- 不侵犯内容作者、平台、网站或任何第三方的版权、商标、隐私、肖像、公开权等权益；
- 遵守所在地区法律法规，以及相关网站和平台的服务条款、社区规则、版权政策和开发者政策。

本项目不会授予你对任何视频内容的版权、复制权、传播权或再许可权。视频内容及其权利归原作者、发布者、平台或其他权利人所有。

### 关于“24 小时内删除”


如果你在法律允许的个人学习、研究、测试或调试场景中临时接触、缓存或保存了受版权保护的内容，应尽快删除相关临时副本，并建议不晚于 24 小时内删除。该提示不代表本项目鼓励、允许或协助下载、复制、传播任何未授权内容，也不构成对任何内容的使用许可。

## 参考政策

发布、分发或继续开发前，建议至少阅读以下官方文档：

- [Chrome Web Store Program Policies](https://developer.chrome.com/docs/webstore/program-policies)
- [Chrome Web Store Developer Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies)
- [Chrome Web Store Privacy Policies](https://developer.chrome.com/docs/webstore/program-policies/privacy)
- [Chrome Web Store Limited Use policy](https://developer.chrome.com/docs/webstore/program-policies/limited-use)
- [Chrome `declarativeNetRequest` API](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)
- [X Rules and policies](https://help.x.com/en/rules-and-policies)
- [X Developer Policy](https://docs.x.com/developer-terms/policy)
- [X Terms of Service](https://x.com/en/tos)
- [法官说法：“免责声明”不能免责](https://www.xinhuanet.com/zgjx/2017-07/07/c_136421891.htm)

这些链接可能会更新。若项目公开发布，应以各平台最新版本为准。

## 免责声明

本项目按“现状”提供，不承诺一定适用于所有网站、浏览器版本或视频链接，也不承诺相关平台策略长期不变。作者不对使用本扩展导致的账号限制、内容不可用、网站功能异常、版权争议、平台条款争议或其他损失承担责任。

本 README 仅用于说明项目用途和风险边界，不构成法律意见。如需公开分发、商用、上架应用商店或面向大量用户提供服务，请先咨询具备资质的法律专业人士。

## 更新后重新加载

如果你已经加载过旧版本：

1. 打开 `chrome://extensions/` 或 `edge://extensions/`
2. 找到 `CDN Inline Media Helper`
3. 点击“重新加载”
4. 刷新目标网页

## 如果仍然被保存为文件

1. 确认扩展已启用。
2. 在视频缩略图或链接上右键，选择“内联播放媒体”。
3. 确认链接域名确实是 `video.twimg.com` 或可识别的 `*.twimg.com` 视频文件。
4. 如果目标网站通过自己的中转接口跳转到视频链接，可能需要把中转站点添加到自定义站点列表并授权。
