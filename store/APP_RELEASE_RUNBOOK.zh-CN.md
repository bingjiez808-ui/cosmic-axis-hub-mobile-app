# 命运图书馆 App 真机与上架操作手册

## 当前状态

- 线上地址：`https://cosmic-axis-mobile-app.bingjiez808.chatgpt.site`
- 当前线上验证版本：版本 18，静态资源标签 `mobile-release-20260813-supabase-env`
- 原生壳：Capacitor iOS / Android 已创建。
- App ID / Bundle ID：`studio.fatenexus.library`
- App 名称：`命运图书馆`
- Android：`compileSdkVersion = 36`，`targetSdkVersion = 36`
- 已同步原生工程：`npm run cap:sync`
- 已补齐前端生产构建所需公开 Supabase 变量：`.env.production`
- 已补 iOS 隐私清单：`ios/App/App/PrivacyInfo.xcprivacy`
- 已设置 Android 禁止系统备份：`android:allowBackup="false"`
- 已设置 iOS 非豁免加密声明：`ITSAppUsesNonExemptEncryption=false`

## 本机还缺

- iOS：需要安装完整 Xcode。目前 `xcodebuild` 指向 Command Line Tools，不能归档上传。
- Android：需要安装 Android Studio 和 Android SDK。目前 Gradle 构建停在 `SDK location not found`。
- 商店账号：Apple Developer Program / Google Play Console 仍需你用自己的主体注册并完成身份验证。
- 付费：若正式开放高级报告或会员购买，上架前仍需接入 Apple In-App Purchase / Google Play Billing，或在移动 App 中暂时隐藏外部数字内容购买入口。
- 审核账号：需要创建一个可供审核员登录的测试账号，不要写入仓库。

## iOS 上架步骤

1. 安装 Xcode，并打开一次完成组件安装。
2. 加入 Apple Developer Program。
3. 打开工程：

```bash
npm run cap:open:ios
```

4. 在 Xcode 中选择 `App` Target：
   - Team：选择你的 Apple Developer 团队。
   - Bundle Identifier：保持 `studio.fatenexus.library`，或改成你最终确认的域名反写。
   - Version：`1.0`
   - Build：`1`
   - Signing & Capabilities：使用自动签名。
   - Privacy Manifest：确认 `PrivacyInfo.xcprivacy` 出现在 Copy Bundle Resources。
5. 连接 iPhone 真机运行，重点测试：
   - 首页、命盘仪式、报告、今日、通识馆、众生、读者证。
   - 登录、退出登录、隐私政策、服务条款、删除账号。
   - 弱网和首次安装。
6. Xcode 菜单选择 `Product > Archive`。
7. 在 Organizer 里上传到 App Store Connect。
8. App Store Connect 填写元信息，参考：
   - `store/app-store/metadata.zh-CN.md`
   - `store/review-notes.zh-CN.md`

## Android 上架步骤

1. 安装 Android Studio。
2. 在 Android Studio 的 SDK Manager 安装 Android SDK 36。
3. 新建 `android/local.properties`：

```properties
sdk.dir=/Users/paomobing/Library/Android/sdk
```

4. 同步并测试：

```bash
npm run cap:sync
cd android
./gradlew :app:assembleDebug
```

5. 真机安装调试：

```bash
./gradlew :app:installDebug
```

6. 生成 Google Play 上传包：

```bash
./gradlew :app:bundleRelease
```

7. 上传 `android/app/build/outputs/bundle/release/app-release.aab` 到 Play Console。
8. Google Play 元信息参考：
   - `store/google-play/metadata.zh-CN.md`
   - `store/review-notes.zh-CN.md`

## 付费与审核注意

- 如果 App 内售卖会员、深度报告或任何数字内容，正式上架时：
  - iOS 需要接入 Apple In-App Purchase。
  - Android 需要接入 Google Play Billing。
- 命盘、今日、关系、通识馆和众生内容必须保持免责声明：
  - 仅用于文化体验、娱乐和自我反思。
  - 不构成医疗、心理、法律、财务、投资或人生重大决策建议。
- 众生之厅属于社区/UGC 功能，上架前需要确保：
  - 举报入口可用。
  - 屏蔽/限制机制可用。
  - 管理员审核机制可用。
  - 隐私政策说明用户生成内容的使用方式。
- 当前 Capacitor 配置会在原生 App 内加载线上站点。提交审核前必须确保线上站点持续可用，且 App 体验保持移动端原生导航、启动页、错误页和登录流程，不要像简单网页套壳。

## 审核测试账号

提交商店前需要准备一个审核账号，建议记录在 App Store Connect / Play Console 的审核备注里，不要提交到代码仓库。

建议审核路径：

1. 打开首页。
2. 进入命盘仪式。
3. 选择一个问题并填写出生资料。
4. 查看命盘报告和章节导览。
5. 打开今日、通识馆、众生之厅。
6. 打开读者证，查看隐私政策、服务条款、免责声明和退出登录。
