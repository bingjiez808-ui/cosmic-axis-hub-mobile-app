# 命运图书馆商店上架状态

## 已完成

- Web 线上版本已恢复可用：`https://cosmic-axis-mobile-app.bingjiez808.chatgpt.site`
- 已发布并验证版本 18：`mobile-release-20260813-supabase-env`
- Capacitor iOS / Android 工程已存在并已执行 `npm run cap:sync`
- iOS Bundle ID / Android applicationId：`studio.fatenexus.library`
- App 名称：`命运图书馆`
- 前端生产构建已固定公开 Supabase 配置：`.env.production`
- iOS 已加入隐私清单：`ios/App/App/PrivacyInfo.xcprivacy`
- iOS 已声明不使用非豁免加密：`ITSAppUsesNonExemptEncryption=false`
- Android 已关闭系统备份：`android:allowBackup="false"`
- App Store / Google Play 元信息草稿已准备：
  - `store/app-store/metadata.zh-CN.md`
  - `store/google-play/metadata.zh-CN.md`
  - `store/review-notes.zh-CN.md`

## 本机验证结果

- `npm run cap:sync`：通过。
- Android debug build：未完成，原因是本机缺少 Android SDK 路径。
  - 失败信息：`SDK location not found`
  - 需要安装 Android Studio，并创建 `android/local.properties`
- iOS Archive：未执行，原因是本机只有 Command Line Tools，没有完整 Xcode。
  - 失败信息：`xcodebuild requires Xcode`

## 上架前必须补齐

- 注册 Apple Developer Program，并在 Xcode 中配置 Team。
- 注册 Google Play Console，并完成身份验证。
- 安装完整 Xcode。
- 安装 Android Studio 与 Android SDK 36。
- 准备审核测试账号。
- 真机测试：首次安装、登录、退出、命盘仪式、报告、今日、通识馆、众生、读者证、隐私政策、服务条款、删除账号。
- 如果开放会员或高级报告付费，接入 Apple In-App Purchase 与 Google Play Billing；否则在 App 版本中暂时隐藏购买入口。

## 建议下一次操作顺序

1. 安装 Xcode 和 Android Studio。
2. 执行 `npm run cap:sync`。
3. 执行 Android debug 构建：

```bash
cd android
./gradlew :app:assembleDebug
```

4. 用 Xcode 打开 iOS 工程并跑真机：

```bash
npm run cap:open:ios
```

5. 真机通过后再生成 Android `.aab` 和 iOS Archive。
