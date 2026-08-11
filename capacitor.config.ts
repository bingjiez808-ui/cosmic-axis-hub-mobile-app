import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "studio.fatenexus.library",
  appName: "命运图书馆",
  webDir: "dist/public",
  bundledWebRuntime: false,
  server: {
    url: "https://cosmic-axis-mobile-app.bingjiez808.chatgpt.site",
    cleartext: false,
  },
  ios: {
    contentInset: "always",
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#0A0A0F",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0A0A0F",
      overlaysWebView: true,
    },
  },
};

export default config;
