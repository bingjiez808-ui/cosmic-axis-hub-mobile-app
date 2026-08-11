# 命运图书馆 App 上架准备清单

## 当前已完成

- 已支持 PWA 安装：手机浏览器打开生产链接后，可添加到主屏幕。
- 已加入 Capacitor 原生壳配置：可生成 iOS / Android 工程，用于真机安装、TestFlight、Google Play 内测。
- 已生成 `ios/` 和 `android/` 原生工程，并完成 `npm run cap:sync` 同步。
- 默认语言已改为中文：生产页面会以 `zh-CN` 作为默认语言。
- 已有隐私政策、服务条款、删除账号入口和免责声明页面。

## 还需要准备

- Apple Developer Program：需要公司或个人开发者账号。
- Google Play Console：需要开发者账号。
- 应用图标：1024 x 1024 PNG，无透明背景，用于 App Store / Google Play。
- 商店截图：iPhone 6.7 寸、iPhone 6.5 寸、Android 手机截图各 3-8 张。
- 审核测试账号：提供可登录账号，或说明无需登录即可体验的路径。
- 隐私表单：填写收集的数据类型、用途、是否用于追踪。
- 免责声明：商店描述和 App 内都要说明命盘内容仅用于文化体验、娱乐和自我反思，不构成医疗、法律、财务、投资或人生重大决策建议。
- 会员与付费：如在 App 内售卖会员或深度报告，iOS 通常需要接入 Apple In-App Purchase，Android 需要 Google Play Billing。
- 原生构建环境：Mac + Xcode 用于 iOS；Android Studio + JDK 用于 Android。

## 本地真机测试路径

1. 安装依赖：`npm install`
2. 同步原生项目：`npm run cap:sync`
3. iOS：`npm run cap:open:ios`
4. Android：`npm run cap:open:android`
5. 在 Xcode 或 Android Studio 里连接手机运行。

## 当前本机环境缺口

- iOS：当前机器只有 Xcode Command Line Tools，`xcodebuild` 提示需要完整 Xcode。安装 Xcode 后再打开 `ios/App/App.xcodeproj` 配置团队、Bundle ID 和签名。
- Android：当前机器未找到 `/Users/paomobing/Library/Android/sdk`，Gradle 打包失败于 `SDK location not found`。安装 Android Studio 后打开 SDK Manager 安装 Android SDK，再在 `android/local.properties` 写入 `sdk.dir=/Users/paomobing/Library/Android/sdk`。

## 审核注意

- 当前第一阶段是“线上移动 Web App 的原生容器”。这适合快速内测和手机安装验证。
- 正式提交 App Store 前，建议加入至少一部分原生能力，例如原生支付、推送通知、分享、离线缓存或账号安全能力，降低被判定为纯网页壳的风险。
- 命理/占星类内容需要避免承诺确定结果，避免医疗、法律、投资、财务等高风险建议。
