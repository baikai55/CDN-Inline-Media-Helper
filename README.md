# Twitter/X CDN Inline Video

这个 Chrome/Edge 扩展会处理 `https://video.twimg.com/*` 视频链接：

1. 把 `Content-Disposition` 改成 `inline`，避免 `attachment` 强制下载。
2. 对 `.mp4` 链接设置 `Content-Type: video/mp4`，帮助浏览器按视频处理。
3. 给右键菜单增加“在线播放 Twitter/X 视频”。
4. 在 `twivideo.net`、`twidouga.net` 和 `erozine.jp` 页面里，拦截指向 `video.twimg.com` 的点击并在当前页弹窗播放。
   当前页弹窗内部嵌入的是扩展播放器页面，避免被原网页的媒体 CSP 限制影响。
5. 对 `https://erozine.jp/x/a/...` 这种站内短链接，先解析跳转后的 `video.twimg.com` 地址，再在线播放。
6. 如果站点仍然触发 Twitter CDN 下载，扩展会取消这个下载并用同一个链接在当前页弹窗播放。
7. 左键点击 `erozine.jp/x/a/...` 短链接时，会走和右键菜单一致的“先解析、失败再兜底”后台播放流程。
8. 可以在设置页添加自定义站点，不用再手改扩展文件。

它只声明了 `twivideo.net`、`twidouga.net`、`erozine.jp` 和 `video.twimg.com` 的站点权限。

## 安装

### Chrome

1. 打开 `chrome://extensions/`
2. 打开右上角“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择这个文件夹：`twimg-inline-video-extension`

### Edge

1. 打开 `edge://extensions/`
2. 打开左侧或右上角“开发人员模式”
3. 点击“加载解压缩的扩展”
4. 选择这个文件夹：`twimg-inline-video-extension`

## 使用

安装后，重新打开或刷新原视频网站，再点击 `video.twimg.com` 的视频链接。

如果链接是 `.mp4`，浏览器通常会直接打开内置播放器，而不是下载文件。

也可以在视频缩略图或链接上右键，选择“在线播放 Twitter/X 视频”。这个方式会打开扩展自己的播放器页面，通常比直接打开原链接更稳。

## 添加新站点

1. 点击浏览器工具栏里的扩展图标，打开设置页。
2. 在“添加站点”里输入域名，例如 `example.com`。
3. 确认 Chrome 的站点权限授权。
4. 刷新目标网站。

添加后，扩展会在该站点上启用同一套点击拦截和当前页弹窗播放器。

## 更新后重新加载

如果你已经加载过旧版本：

1. 打开 `chrome://extensions/` 或 `edge://extensions/`
2. 找到 `Twitter/X CDN Inline Video`
3. 点击“重新加载”
4. 刷新 `twivideo.net` 页面

## 如果仍然下载

1. 确认扩展已启用。
2. 在视频缩略图或链接上右键，选择“在线播放 Twitter/X 视频”。
3. 确认链接域名确实是 `video.twimg.com`。
4. 如果网站不是直接跳到 `video.twimg.com`，而是先经过自己的下载接口，可能还需要把那个中转域名也加入规则。
"# Twitter-X-CDN-Inline-Video" 
