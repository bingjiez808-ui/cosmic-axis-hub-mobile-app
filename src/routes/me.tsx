import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  BookOpen,
  ChartNoAxesCombined,
  ChevronRight,
  Download,
  FileText,
  History,
  Info,
  LockKeyhole,
  LogOut,
  Moon,
  ScrollText,
  Settings,
  ShieldCheck,
  Trash2,
  UserRound,
  WalletCards,
  WandSparkles,
} from "lucide-react";
import { useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { useSupabaseSession } from "@/lib/session";

export const Route = createFileRoute("/me")({
  head: () => ({
    meta: [
      { title: "读者证 · 命运书房 App" },
      { name: "description", content: "读者证：命盘、报告、缓存、会员、隐私设置和退出登录。" },
    ],
  }),
  component: MeHomePage,
});

function MeHomePage() {
  const { lang } = useLang();
  const zh = lang === "zh";
  const { user, loading } = useSupabaseSession();
  const navigate = useNavigate();
  const [cacheCleared, setCacheCleared] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const displayName = useMemo(() => {
    const metadata = user?.user_metadata as { full_name?: string; name?: string } | undefined;
    return metadata?.full_name || metadata?.name || user?.email?.split("@")[0] || (zh ? "未登录用户" : "Guest");
  }, [user, zh]);

  const signedIn = Boolean(user);
  const email = user?.email ?? (zh ? "登录后同步你的命盘与报告" : "Sign in to sync charts and reports");

  const primaryTiles = [
    {
      icon: ChartNoAxesCombined,
      label: zh ? "我的命盘" : "My charts",
      value: signedIn ? (zh ? "主命盘、关系档案" : "Primary chart, bond profiles") : (zh ? "登录后保存" : "Save after login"),
      to: signedIn ? "/me/profile" : "/ritual",
      search: signedIn ? undefined : ({ returnTo: "/me/profile" } as never),
    },
    {
      icon: ScrollText,
      label: zh ? "命盘报告" : "Reports",
      value: zh ? "综合解读、章节阅读" : "Panorama and chapters",
      to: "/report",
    },
    {
      icon: BookOpen,
      label: zh ? "我的书架" : "My shelf",
      value: zh ? "书签、历史回声、通识馆" : "Bookmarks, echoes, studies",
      to: signedIn ? "/me/literature" : "/life-studies",
    },
    {
      icon: WalletCards,
      label: zh ? "会员计划" : "Membership",
      value: signedIn ? (zh ? "权益、升级、订单" : "Benefits, upgrade, orders") : (zh ? "可先预览权益" : "Preview benefits"),
      to: signedIn ? "/me/membership" : "/auth",
      search: signedIn ? undefined : ({ redirect: "/me/membership" } as never),
    },
  ];

  const publicRows = [
    {
      icon: History,
      label: zh ? "缓存浏览" : "Browsing cache",
      body: cacheCleared
        ? zh ? "已清理本机临时浏览缓存" : "Local temporary cache cleared"
        : zh ? "清理本机临时预览、草稿和页面状态" : "Clear local previews, drafts and page state",
      action: zh ? "清理" : "Clear",
      onClick: () => {
        if (typeof window !== "undefined") {
          window.sessionStorage.clear();
          for (const key of Object.keys(window.localStorage)) {
            if (key.startsWith("fate-") || key.includes("draft") || key.includes("preview")) {
              window.localStorage.removeItem(key);
            }
          }
        }
        setCacheCleared(true);
      },
    },
    {
      icon: FileText,
      label: zh ? "隐私政策" : "Privacy Policy",
      body: zh ? "查看我们如何处理出生资料、账号数据和社区内容" : "How we handle birth data, account data and community content",
      to: "/privacy",
    },
    {
      icon: ScrollText,
      label: zh ? "服务条款" : "Terms of Service",
      body: zh ? "查看账号、付费功能、社区使用和平台规则" : "Account, paid features, community use and platform rules",
      to: "/terms",
    },
    {
      icon: Info,
      label: zh ? "产品免责声明" : "Product disclaimer",
      body: zh
        ? "命盘分析仅用于文化体验、娱乐和自我反思，不替代医疗、心理、法律、财务或重大人生决策建议"
        : "Readings are for cultural reflection and entertainment only, not medical, psychological, legal, financial or major life-decision advice",
      to: "/about",
    },
  ];

  const accountRows = [
    {
      icon: Bell,
      label: zh ? "通知提醒" : "Notifications",
      body: zh ? "今日提醒、回信提醒和报告更新" : "Today, replies and report updates",
      to: signedIn ? "/community/notices" : "/auth",
      search: signedIn ? undefined : ({ redirect: "/community/notices" } as never),
    },
    {
      icon: ShieldCheck,
      label: zh ? "隐私与安全" : "Privacy & safety",
      body: signedIn
        ? zh ? "社交同意、屏蔽、数据与账号安全" : "Consent, blocking, data and account safety"
        : zh ? "登录后管理社交同意、屏蔽和账号安全" : "Login to manage consent, blocking and account safety",
      to: signedIn ? "/me/community" : "/auth",
      search: signedIn ? undefined : ({ redirect: "/me/community" } as never),
    },
    {
      icon: Settings,
      label: zh ? "账号设置" : "Account settings",
      body: zh ? "邮箱、登录方式和个人资料" : "Email, login methods and profile",
      to: signedIn ? "/me/profile" : "/auth",
      search: signedIn ? undefined : ({ redirect: "/me/profile" } as never),
    },
  ];

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    setSigningOut(false);
    await navigate({ to: "/me" });
  }

  return (
    <main className="min-h-screen bg-[#04050a] text-amber-50">
      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#080910] px-4 pb-28 pt-[calc(env(safe-area-inset-top)+0.85rem)]">
        <section className="overflow-hidden rounded-[32px] border border-amber-300/14 bg-gradient-to-br from-amber-300/12 via-white/[0.045] to-teal-300/8 p-4 shadow-[0_24px_80px_-48px_rgba(20,184,166,0.72)]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-[24px] border border-teal-300/25 bg-teal-300/10 text-teal-100">
                <UserRound aria-hidden className="h-8 w-8" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.24em] text-amber-300/65">
                  {zh ? "读者证" : "Reader Pass"}
                </p>
                <h1 className="mt-1 truncate text-2xl font-semibold text-amber-50">
                  {loading ? (zh ? "同步中" : "Syncing") : displayName}
                </h1>
                <p className="mt-1 truncate text-xs text-amber-100/55">{email}</p>
              </div>
            </div>
            <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] ${
              signedIn
                ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
                : "border-amber-300/20 bg-amber-300/8 text-amber-100/70"
            }`}>
              {signedIn ? (zh ? "已登录" : "Signed in") : (zh ? "游客" : "Guest")}
            </span>
          </div>

          {!signedIn ? (
            <div className="mt-4 rounded-[24px] border border-white/10 bg-black/24 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-50">
                <LockKeyhole aria-hidden className="h-4 w-4 text-amber-300" />
                {zh ? "登录后会变成你的真实读者证" : "Sign in for your reader pass"}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-amber-100/56">
                {zh
                  ? "当前仍可浏览命盘示例、进入仪式和清理本机缓存；登录后会显示你的命盘、报告、会员权益和社交设置。"
                  : "You can still browse samples, start the ritual and clear local cache. Sign in to show your charts, reports, pass and settings."}
              </p>
              <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                <Link
                  to="/auth"
                  search={{ redirect: "/me" } as never}
                  className="flex min-h-12 items-center justify-center rounded-2xl bg-amber-300 px-4 text-sm font-semibold text-[#111016] transition active:scale-[0.98]"
                >
                  {zh ? "登录 / 注册" : "Login / Sign up"}
                </Link>
                <Link
                  to="/ritual"
                  search={{ returnTo: "/me/profile" } as never}
                  className="grid min-h-12 min-w-12 place-items-center rounded-2xl border border-teal-300/25 text-teal-100 transition active:scale-[0.96]"
                  aria-label={zh ? "先建命盘" : "Build chart"}
                >
                  <WandSparkles aria-hidden className="h-5 w-5" />
                </Link>
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          {primaryTiles.map((tile) => (
            <Link
              key={tile.label}
              to={tile.to as never}
              search={tile.search}
              className="group relative min-h-[122px] overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.045] p-4 transition active:scale-[0.98]"
            >
              <span className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-teal-300/10 blur-xl transition group-active:scale-110" />
              <tile.icon aria-hidden className="relative h-6 w-6 text-amber-300/85" />
              <div className="mt-4 text-sm font-semibold text-amber-50">{tile.label}</div>
              <p className="mt-1 text-xs leading-relaxed text-amber-100/52">{tile.value}</p>
            </Link>
          ))}
        </section>

        <section className="mt-4 overflow-hidden rounded-[30px] border border-amber-300/16 bg-gradient-to-br from-amber-300/14 via-white/[0.045] to-teal-300/10 p-4 shadow-[0_22px_70px_-52px_rgba(251,191,36,0.85)]">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[20px] border border-amber-200/25 bg-amber-200/12 text-amber-100">
              <WalletCards aria-hidden className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300/62">
                    {zh ? "会员阅览室" : "Member rooms"}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-amber-50">
                    {zh ? "升级你的读者证" : "Upgrade your pass"}
                  </h2>
                </div>
                <span className="shrink-0 rounded-full border border-teal-200/20 bg-teal-200/10 px-2.5 py-1 text-[10px] font-medium text-teal-100">
                  {signedIn ? (zh ? "可升级" : "Ready") : (zh ? "可预览" : "Preview")}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-amber-100/58">
                {zh
                  ? "贤者与神谕者会解锁今日延展、关系适配、90 天时间窗口和更多会员阅览室；订单与权益都保存在读者证里。"
                  : "Sage and Oracle unlock Today extensions, relationship matching, 90-day windows and member reading rooms. Orders and benefits live here."}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {(zh
              ? ["今日延展", "关系适配", "时间窗口"]
              : ["Today+", "Synastry", "Timing"]
            ).map((item) => (
              <span
                key={item}
                className="rounded-2xl border border-white/10 bg-black/20 px-2 py-2 text-center text-[11px] font-medium text-amber-100/74"
              >
                {item}
              </span>
            ))}
          </div>
          <Link
            to={signedIn ? "/me/membership" : "/auth"}
            search={signedIn ? undefined : ({ redirect: "/me/membership" } as never)}
            className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-amber-300 px-4 text-sm font-semibold text-[#111016] transition active:scale-[0.98]"
          >
            {signedIn ? (zh ? "查看会员计划" : "View plans") : (zh ? "登录查看会员计划" : "Login to view plans")}
            <ChevronRight aria-hidden className="h-4 w-4" />
          </Link>
        </section>

        <section className="mt-4 rounded-[28px] border border-amber-300/12 bg-white/[0.035] p-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-sm font-medium text-amber-100">
              {zh ? "主页设置" : "Home settings"}
            </h2>
            <Moon aria-hidden className="h-4 w-4 text-amber-100/45" />
          </div>
          <div className="divide-y divide-amber-300/10">
            {publicRows.map((row) => {
              const content = (
                <>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-teal-300/10 text-teal-100">
                    <row.icon aria-hidden className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-amber-50">{row.label}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-amber-100/45">{row.body}</span>
                  </span>
                </>
              );
              return "onClick" in row && row.onClick ? (
                <button
                  key={row.label}
                  type="button"
                  onClick={row.onClick}
                  className="flex w-full min-h-16 items-center gap-3 px-1 py-3 text-left transition active:scale-[0.99]"
                >
                  {content}
                  <span className="text-xs font-medium text-amber-200">{row.action}</span>
                </button>
              ) : (
                <Link
                  key={row.label}
                  to={row.to as never}
                  className="flex min-h-16 items-center gap-3 px-1 py-3 transition active:scale-[0.99]"
                >
                  {content}
                  <ChevronRight aria-hidden className="h-5 w-5 text-amber-100/35" />
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mt-4 rounded-[28px] border border-amber-300/12 bg-white/[0.035] p-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-sm font-medium text-amber-100">
              {zh ? "账号与安全" : "Account and safety"}
            </h2>
            {!signedIn ? (
              <span className="rounded-full border border-amber-300/15 px-2 py-0.5 text-[10px] text-amber-100/45">
                {zh ? "需登录" : "Login"}
              </span>
            ) : null}
          </div>
          <div className="divide-y divide-amber-300/10">
            {accountRows.map((row) => {
              const content = (
                <>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-teal-300/10 text-teal-100">
                    <row.icon aria-hidden className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-amber-50">{row.label}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-amber-100/45">{row.body}</span>
                  </span>
                </>
              );
              return (
                <Link
                  key={row.label}
                  to={row.to as never}
                  search={row.search}
                  className="flex min-h-16 items-center gap-3 px-1 py-3 transition active:scale-[0.99]"
                >
                  {content}
                  <ChevronRight aria-hidden className="h-5 w-5 text-amber-100/35" />
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <Link
            to="/report"
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-amber-300/18 bg-white/[0.04] px-4 text-sm font-medium text-amber-100 transition active:scale-[0.98]"
          >
            <Download aria-hidden className="h-4 w-4" />
            {zh ? "报告下载" : "Downloads"}
          </Link>
          {signedIn ? (
            <Link
              to="/delete-account"
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-rose-300/18 bg-rose-300/[0.055] px-4 text-sm font-medium text-rose-100 transition active:scale-[0.98]"
            >
              <Trash2 aria-hidden className="h-4 w-4" />
              {zh ? "账号数据" : "Account data"}
            </Link>
          ) : (
            <Link
              to="/auth"
              search={{ redirect: "/delete-account" } as never}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-amber-300/18 bg-white/[0.04] px-4 text-sm font-medium text-amber-100 transition active:scale-[0.98]"
            >
              <LockKeyhole aria-hidden className="h-4 w-4" />
              {zh ? "登录管理数据" : "Login for data"}
            </Link>
          )}
        </section>

        {signedIn ? (
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-rose-300/22 bg-rose-300/[0.07] px-4 text-sm font-semibold text-rose-100 transition active:scale-[0.98] disabled:opacity-60"
          >
            <LogOut aria-hidden className="h-4 w-4" />
            {signingOut ? (zh ? "正在退出" : "Signing out") : (zh ? "退出登录" : "Sign out")}
          </button>
        ) : null}
      </div>
    </main>
  );
}
