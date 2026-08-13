import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const checks = [];

function add(name, ok, detail) {
  checks.push({ name, ok, detail });
}

function commandOutput(command, args) {
  try {
    return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    const stderr = error?.stderr?.toString?.().trim();
    const stdout = error?.stdout?.toString?.().trim();
    return stderr || stdout || String(error);
  }
}

const envProd = join(root, ".env.production");
const envText = existsSync(envProd) ? readFileSync(envProd, "utf8") : "";
add(".env.production", existsSync(envProd), envProd);
add("VITE_SUPABASE_URL", envText.includes("VITE_SUPABASE_URL=https://"), "frontend build env");
add("VITE_SUPABASE_PUBLISHABLE_KEY", envText.includes("VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_"), "frontend build env");

const iosPrivacy = join(root, "ios/App/App/PrivacyInfo.xcprivacy");
const iosInfo = join(root, "ios/App/App/Info.plist");
const iosProject = join(root, "ios/App/App.xcodeproj/project.pbxproj");
add("iOS PrivacyInfo.xcprivacy", existsSync(iosPrivacy), iosPrivacy);
add("iOS Info.plist", existsSync(iosInfo), iosInfo);
add("iOS project references privacy manifest", existsSync(iosProject) && readFileSync(iosProject, "utf8").includes("PrivacyInfo.xcprivacy in Resources"), iosProject);
add("iOS encryption declaration", existsSync(iosInfo) && readFileSync(iosInfo, "utf8").includes("ITSAppUsesNonExemptEncryption"), iosInfo);

const xcodeSelect = commandOutput("xcode-select", ["-p"]);
const xcodeVersion = commandOutput("xcodebuild", ["-version"]);
add("Full Xcode installed", !xcodeVersion.includes("requires Xcode"), xcodeVersion || xcodeSelect);

const androidManifest = join(root, "android/app/src/main/AndroidManifest.xml");
const manifestText = existsSync(androidManifest) ? readFileSync(androidManifest, "utf8") : "";
add("AndroidManifest.xml", existsSync(androidManifest), androidManifest);
add("Android backup disabled", manifestText.includes('android:allowBackup="false"'), androidManifest);

const androidLocal = join(root, "android/local.properties");
const localText = existsSync(androidLocal) ? readFileSync(androidLocal, "utf8") : "";
const sdkDir = localText.match(/^sdk\.dir=(.+)$/m)?.[1];
add("Android SDK configured", !!sdkDir && existsSync(sdkDir), sdkDir || "missing android/local.properties sdk.dir");

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? "OK " : "MISS"} ${check.name} - ${check.detail}`);
}

if (failed.length) {
  console.error(`\n${failed.length} native readiness check(s) still need attention.`);
  process.exit(1);
}

console.log("\nNative readiness checks passed.");
