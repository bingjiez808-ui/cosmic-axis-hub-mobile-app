import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { LanguageProvider, useLang } from "@/lib/i18n";
import { AccountProvider, useAccount } from "../lib/account";
import { AccountModal } from "../components/AccountModal";
import { LanguageToggle } from "@/components/LanguageToggle";
import { LibrarySplash } from "../components/LibrarySplash";
import { ElderCompanion } from "../components/ElderCompanion";
import { useSupabaseSession } from "../lib/session";
import libraryHallImg from "../assets/ancient-library-hall.jpg";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-obsidian px-4">
      <div className="max-w-md text-center">
        <p className="font-mono text-[10px] tracking-[0.4em] uppercase text-gold-dust mb-4">Lost in the stars</p>
        <h1 className="font-serif text-7xl text-stone-warm">404</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          The constellation you seek is not written here.
        </p>
        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full border border-gold-dust/30 px-6 py-3 text-xs uppercase tracking-widest text-gold-dust transition-colors hover:border-gold-dust hover:bg-gold-dust/10"
          >
            Return to the Library
          </Link>
        </div>
      </div>
    </div>
  );
}

function useHydrationSafeRootLang(): "zh" | "en" {
  const [lang, setLang] = useState<"zh" | "en">("en");

  useEffect(() => {
    const sync = () => {
      const htmlLang = document.documentElement.getAttribute("lang") ?? "en";
      setLang(htmlLang.toLowerCase().startsWith("zh") ? "zh" : "en");
    };
    sync();
    window.addEventListener("lod:lang-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("lod:lang-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return lang;
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const rootLang = useHydrationSafeRootLang();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  const isAuthRefresh =
    error?.name === "AuthRefreshFailedError" ||
    /authentication refresh failed/i.test(error?.message ?? "");
  // Lang provider isn't in scope for this boundary. Keep SSR + first hydrate
  // render pinned to English, then switch from <html lang> after mount.
  const isZh = rootLang === "zh";

  const title = isAuthRefresh
    ? isZh
      ? "登录状态刷新失败"
      : "Could not refresh your session"
    : isZh
      ? "仪式被中断"
      : "The ritual was interrupted.";
  const body = isAuthRefresh
    ? isZh
      ? "网络连接不稳定，未能与账户服务通讯。请检查网络后重试；你的登录状态仍然保留。"
      : "We could not reach the account service — likely a network hiccup. Your session is still valid; please retry."
    : isZh
      ? "解读过程中出现意外。你可以再试一次。"
      : "A disturbance in the reading. You may try again.";
  const retry = isZh ? "重试" : "Try again";
  const home = isZh ? "回到首页" : "Return home";
  const relogin = isZh ? "重新登录" : "Sign in again";

  return (
    <div className="flex min-h-screen items-center justify-center bg-obsidian px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-2xl text-stone-warm">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{body}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-full bg-gold-dust px-6 py-3 text-xs uppercase tracking-widest text-obsidian transition-colors hover:bg-gold-light"
          >
            {retry}
          </button>
          {isAuthRefresh && (
            <a
              href="/auth?mode=login"
              className="rounded-full border border-gold-dust/30 px-6 py-3 text-xs uppercase tracking-widest text-gold-dust transition-colors hover:border-gold-dust"
            >
              {relogin}
            </a>
          )}
          <a
            href="/"
            className="rounded-full border border-gold-dust/30 px-6 py-3 text-xs uppercase tracking-widest text-gold-dust transition-colors hover:border-gold-dust"
          >
            {home}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "google-site-verification", content: "13PjilWkpgeN2sxu9wT7KuyJignBpOksT4znLKPokus" },
      { name: "theme-color", content: "#0a0a0f" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Fate Nexus" },
      { name: "format-detection", content: "telephone=no" },
      { title: "Library of Destiny — AI synthesis of four ancient traditions" },
      {
        name: "description",
        content:
          "An immersive AI platform that weaves Western Astrology, Vedic Jyotish, Chinese BaZi and Zi Wei Dou Shu into a single reading of who you are.",
      },
      { name: "author", content: "Library of Destiny" },
      { property: "og:title", content: "Library of Destiny — AI synthesis of four ancient traditions" },
      {
        property: "og:description",
        content: "An immersive AI platform that weaves Western Astrology, Vedic Jyotish, Chinese BaZi and Zi Wei Dou Shu into a single reading of who you are.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Library of Destiny — AI synthesis of four ancient traditions" },
      { name: "twitter:description", content: "An immersive AI platform that weaves Western Astrology, Vedic Jyotish, Chinese BaZi and Zi Wei Dou Shu into a single reading of who you are." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b7aa041a-d5a1-4f34-a443-cdad414d8605/id-preview-eb144758--8dd02eb0-ad23-48d1-858e-b5eb297af57e.lovable.app-1784019704600.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b7aa041a-d5a1-4f34-a443-cdad414d8605/id-preview-eb144758--8dd02eb0-ad23-48d1-858e-b5eb297af57e.lovable.app-1784019704600.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Inter:wght@300;400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const [accOpen, setAccOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // V2 preview & isolated harnesses render their own chrome. Suppress the
  // V1 global nav / footer / library backdrop / sage companion / splash on
  // any `/dev/*` route so there is only one navigation surface on screen.
  const isIsolatedPreview = pathname.startsWith("/dev/");
  useEffect(() => {
    const handler = () => setAccOpen(true);
    window.addEventListener("lod:open-account", handler);
    void import("../lib/pwa-register").then(({ registerServiceWorker }) => registerServiceWorker());
    return () => window.removeEventListener("lod:open-account", handler);
  }, []);

  if (isIsolatedPreview) {
    return (
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <AccountProvider>
            <div className="min-h-screen bg-obsidian text-stone-warm">
              <main>
                <Outlet />
              </main>
            </div>
          </AccountProvider>
        </LanguageProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AccountProvider>
          <div className="relative min-h-screen bg-obsidian text-stone-warm">
            <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
              {/* Ancient library — image-led immersive backdrop */}
              <img
                src={libraryHallImg}
                alt=""
                width={1600}
                height={1000}
                decoding="async"
                fetchPriority="high"
                className="absolute inset-0 h-full w-full object-cover opacity-55 saturate-[0.85]"
              />
              <div className="library-shadow-aisle absolute inset-0" />
              <div className="library-parchment absolute inset-0 opacity-45" />
              <div className="library-lamplight absolute inset-0 opacity-75 animate-candle-flicker" />
              <div className="dust-motes absolute inset-0 opacity-70" />
              <div className="star-bg absolute inset-0 opacity-10" />
              <div className="library-vignette absolute inset-0" />
            </div>

            <SiteNav />

            <main className="relative z-10">
              <Outlet />
            </main>

            <SiteFooter />
          </div>
          <AccountModal open={accOpen} onClose={() => setAccOpen(false)} />
          <LibrarySplash />
          <GlobalSageCompanion />
        </AccountProvider>

      </LanguageProvider>
    </QueryClientProvider>
  );
}

function GlobalSageCompanion() {
  const { lang } = useLang();
  return <ElderCompanion lang={lang} />;
}



function SiteNav() {
  const { t, lang } = useLang();
  const { account } = useAccount();
  const { session, isAdmin, loading } = useSupabaseSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const openAcc = () => {
    if (!session) {
      window.location.assign("/auth?mode=login");
      return;
    }
    window.dispatchEvent(new Event("lod:open-account"));
  };
  const [atTop, setAtTop] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [orbActive, setOrbActive] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  useEffect(() => { setHydrated(true); }, []);

  // Publish real global-nav height as --site-nav-height so any sticky UI
  // below it (e.g. PersonalWorkspaceNav) can offset correctly instead of
  // guessing top-14/top-16 and getting covered.
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const write = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      if (h > 0) {
        document.documentElement.style.setProperty("--site-nav-height", `${h}px`);
      }
    };
    write();
    const ro = new ResizeObserver(write);
    ro.observe(el);
    window.addEventListener("resize", write);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", write);
    };
  }, []);
  const avatarUrl = hydrated ? account?.avatar : undefined;
  const isZh = lang === "zh";
  const adminLabel = isZh ? "议政厅" : "Admin";
  const libraryHomeLabel = isZh ? "导览室" : "Guide Hall";
  const libraryHomeAria = isZh ? "导览室（首页）" : "Guide Hall (Home)";
  const myLibraryLabel = isZh ? "我的书架" : "My Library";
  const moreLabel = isZh ? "了解 · 更多" : "Learn · More";


  useEffect(() => {
    const onScroll = () => setAtTop(window.scrollY < 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!moreOpen && !libraryOpen) return;
    const onDoc = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest("[data-more-menu]") || el?.closest("[data-library-menu]")) return;
      setMoreOpen(false);
      setLibraryOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMoreOpen(false);
        setLibraryOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen, libraryOpen]);


  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const reveal = () => {
      setOrbActive(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setOrbActive(false), 3000);
    };
    const events: (keyof WindowEventMap)[] = [
      "scroll",
      "pointerdown",
      "touchstart",
      "mousemove",
      "keydown",
    ];
    events.forEach((e) =>
      window.addEventListener(e, reveal, { passive: true } as AddEventListenerOptions),
    );
    return () => {
      if (timer) clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reveal));
    };
  }, []);


  const showTopBar = atTop;

  const linkBase = isZh
    ? "inline-flex min-h-11 items-center whitespace-nowrap text-[13px] tracking-normal normal-case transition-colors flex-none"
    : "inline-flex min-h-11 items-center whitespace-nowrap text-[11px] uppercase tracking-[0.28em] transition-colors flex-none";
  const linkIdle = "text-stone-warm/75 hover:text-gold-dust";
  const linkActive = "text-gold-dust";

  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/");

  const NavLink = ({ to, label, ariaLabel }: { to: string; label: string; ariaLabel?: string }) => {
    const active = isActive(to);
    // "My Home" — when signed-out, route through /auth so login lands back on /me/home.
    const needsAuthGate = !session && to.startsWith("/me");
    if (needsAuthGate) {
      return (
        <Link
          to="/auth"
          search={{ mode: "login", redirect: to }}
          aria-label={ariaLabel}
          title={ariaLabel}
          className={`${linkBase} ${linkIdle}`}
        >
          {label}
        </Link>
      );
    }
    return (
      <Link
        to={to}
        aria-current={active ? "page" : undefined}
        aria-label={ariaLabel}
        title={ariaLabel}
        className={`${linkBase} ${active ? linkActive : linkIdle}`}
      >
        {label}
      </Link>
    );
  };

  const accountLabel = session ? t.nav_account : t.nav_sign_in;
  const showAdmin = !loading && isAdmin;

  const orbVisible = orbActive && !showTopBar && !drawerOpen;

  // Global IA — identical for signed-in and signed-out. "My Library" is a
  // dropdown of the five shelf entries (mirrored by PersonalWorkspaceNav
  // once inside /me/*), never a flat set of top-level links.
  const coreEntries: Array<{ to: string; label: string; ariaLabel?: string }> = [
    { to: "/", label: libraryHomeLabel, ariaLabel: libraryHomeAria },
    { to: "/ritual", label: t.nav_ritual },
    { to: "/life-studies", label: isZh ? "命运通识馆" : "Life Studies", ariaLabel: isZh ? "命运通识馆（五种读法）" : "Life Studies (five readings)" },
    { to: "/traditions", label: t.nav_traditions },
    { to: "/community", label: t.nav_community },
  ];

  const libraryEntries: Array<{ to: "/me/home" | "/me/profile" | "/me/friends" | "/me/echoes" | "/me/membership" | "/me/sage" | "/me/oracle"; label: string; hint: string; group?: "core" | "rooms" }> = [
    { to: "/me/home", label: isZh ? "书架主页" : "Library Home", hint: isZh ? "今日命运与主线" : "Today's fate & throughline", group: "core" },
    { to: "/me/profile", label: isZh ? "命盘与报告" : "Charts & Reports", hint: isZh ? "主命盘 · 他人命盘 · 报告" : "Primary · others · reports", group: "core" },
    { to: "/me/friends", label: isZh ? "关系与适配" : "Relationships", hint: isZh ? "好友 · 邀请 · 适配分析" : "Friends · invites · match", group: "core" },
    { to: "/me/echoes", label: isZh ? "历史回声" : "Historical Echoes", hint: isZh ? "相似处境的历史人物" : "Figures with similar arcs", group: "core" },
    { to: "/me/membership", label: isZh ? "会员与订单" : "Membership & Orders", hint: isZh ? "会员 · 订单 · 工单" : "Plans · orders · tickets", group: "core" },
    { to: "/me/sage", label: isZh ? "贤者阅览室" : "Sage Reading Room", hint: isZh ? "时间轴 · 合盘 · 塔罗" : "Timeline · synastry · tarot", group: "rooms" },
    { to: "/me/oracle", label: isZh ? "神谕者阅览室" : "Oracle Reading Room", hint: isZh ? "追问 · 合盘 · 90 天" : "Follow-up · synastry · 90-day", group: "rooms" },
  ];

  // "Learn · More" — informational/policy only. Never duplicate personal features here.
  const moreEntries: Array<{ to?: string; href?: string; label: string; external?: boolean }> = [
    { to: "/about", label: t.nav_about },
    { to: "/privacy", label: isZh ? "隐私政策" : "Privacy" },
    { to: "/terms", label: isZh ? "服务条款" : "Terms" },
    { to: "/delete-account", label: isZh ? "删除账户" : "Delete account" },
    { href: "mailto:fatenexus.studio@gmail.com", label: isZh ? "联系支持" : "Contact support", external: true },
    ...(showAdmin ? [{ to: "/admin", label: adminLabel }] : []),
  ];

  const isLibraryActive = libraryEntries.some((e) => isActive(e.to));
  const gatedShelfHref = (to: string) =>
    !session ? { to: "/auth" as const, search: { mode: "login" as const, redirect: to } } : null;


  return (
    <>
      {/* Collapsed floating orb — appears on interaction, hides after 3s idle */}
      <button
        type="button"
        aria-label="Open navigation"
        aria-hidden={!orbVisible}
        tabIndex={orbVisible ? 0 : -1}
        onClick={() => setDrawerOpen(true)}
        className={`fixed right-4 top-4 z-[60] flex h-11 w-11 items-center justify-center rounded-full border border-gold-dust/40 bg-obsidian/70 backdrop-blur-md transition-all duration-300 hover:border-gold-dust hover:bg-gold-dust/10 xl:right-6 xl:top-6 ${
          orbVisible ? "opacity-100" : "pointer-events-none scale-75 opacity-0"
        }`}
      >
        <span className="block h-2 w-2 rounded-full bg-gold-dust shadow-[0_0_10px_2px_color-mix(in_oklab,var(--gold-light)_60%,transparent)]" />
      </button>

      <nav
        ref={navRef}
        className={`fixed left-1/2 top-0 z-50 w-full max-w-[100vw] -translate-x-1/2 px-3 py-3 xl:p-6 transition-all duration-500 ${
          showTopBar ? "opacity-100 translate-y-0" : "-translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <div className="glass-card mx-auto flex w-full max-w-[calc(100vw-1.5rem)] items-center justify-between gap-3 rounded-full px-3 py-2 xl:max-w-[min(98vw,84rem)] xl:gap-6 xl:px-6 xl:py-2">
          {/* Brand — returns to library home; not the only home entry */}
          <Link
            to="/"
            aria-label={libraryHomeAria}
            className="min-w-0 flex-none truncate font-serif text-sm tracking-normal text-stone-warm xl:whitespace-nowrap xl:text-base"
          >
            Destiny<span className="text-gold-dust">·</span>Library
          </Link>

          {/* Core nav (desktop) */}
          <div className="hidden min-w-0 flex-1 items-center justify-center gap-4 xl:flex xl:gap-6">
            {coreEntries.map((e) => (
              <NavLink key={e.to} to={e.to} label={e.label} ariaLabel={e.ariaLabel} />
            ))}
            <div className="relative" data-library-menu>
              <button
                type="button"
                id="library-menu-trigger"
                aria-haspopup="menu"
                aria-expanded={libraryOpen}
                aria-controls="library-menu-panel"
                onClick={() => {
                  setMoreOpen(false);
                  setLibraryOpen((v) => !v);
                }}
                className={`${linkBase} ${isLibraryActive ? linkActive : linkIdle}`}
              >
                {myLibraryLabel} <span aria-hidden className="ml-1 text-[9px]">▾</span>
              </button>
              {libraryOpen && (
                <div
                  id="library-menu-panel"
                  role="menu"
                  aria-labelledby="library-menu-trigger"
                  className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-gold-dust/25 bg-obsidian/95 p-2 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
                >
                  {libraryEntries.map((e, idx) => {
                    const prev = libraryEntries[idx - 1];
                    const showRoomsHeader = e.group === "rooms" && prev?.group !== "rooms";
                    const active = isActive(e.to);
                    const gated = gatedShelfHref(e.to);
                    const cls = `block rounded-lg px-3 py-2 ${
                      active ? "bg-gold-dust/10 text-gold-dust" : "text-stone-warm/85 hover:bg-gold-dust/10 hover:text-gold-light"
                    }`;
                    const inner = (
                      <>
                        <div className={`text-[12px] ${isZh ? "tracking-normal" : "uppercase tracking-[0.24em]"}`}>{e.label}</div>
                        <div className="mt-0.5 text-[10px] text-stone-warm/55">{e.hint}</div>
                      </>
                    );
                    const link = gated ? (
                      <Link key={e.to} to={gated.to} search={gated.search} onClick={() => setLibraryOpen(false)} className={cls} role="menuitem">
                        {inner}
                      </Link>
                    ) : (
                      <Link key={e.to} to={e.to} onClick={() => setLibraryOpen(false)} aria-current={active ? "page" : undefined} className={cls} role="menuitem">
                        {inner}
                      </Link>
                    );
                    return (
                      <div key={e.to}>
                        {showRoomsHeader && (
                          <div className="mt-2 border-t border-white/10 px-3 pb-1 pt-2 text-[9px] uppercase tracking-[0.28em] text-gold-dust/70">
                            {isZh ? "会员阅览室" : "Membership Rooms"}
                          </div>
                        )}
                        {link}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {moreEntries.length > 0 && (
              <div className="relative" data-more-menu>
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={moreOpen}
                  onClick={() => {
                    setLibraryOpen(false);
                    setMoreOpen((v) => !v);
                  }}
                  className={`${linkBase} ${linkIdle}`}
                >
                  {moreLabel} <span aria-hidden className="ml-1 text-[9px]">▾</span>
                </button>

                {moreOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-gold-dust/25 bg-obsidian/95 p-2 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
                  >
                    {moreEntries.map((e) => {
                      const key = e.to ?? e.href ?? e.label;
                      const active = e.to ? isActive(e.to) : false;
                      const cls = `block rounded-lg px-3 py-2 text-[12px] ${
                        isZh ? "tracking-normal" : "uppercase tracking-[0.24em]"
                      } ${active ? "text-gold-dust bg-gold-dust/10" : "text-stone-warm/80 hover:bg-gold-dust/10 hover:text-gold-light"}`;
                      if (e.href) {
                        return (
                          <a
                            key={key}
                            href={e.href}
                            onClick={() => setMoreOpen(false)}
                            className={cls}
                          >
                            {e.label}
                          </a>
                        );
                      }
                      return (
                        <Link
                          key={key}
                          to={e.to!}
                          onClick={() => setMoreOpen(false)}
                          aria-current={active ? "page" : undefined}
                          className={cls}
                        >
                          {e.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right side */}
          <div className="flex flex-none items-center gap-2 xl:gap-3">
            {session ? (
              <button
                type="button"
                onClick={openAcc}
                aria-label={isZh ? "账户菜单" : "Account menu"}
                className="hidden flex-none items-center gap-2 whitespace-nowrap rounded-full border border-gold-dust/40 px-3 py-1 text-[10px] tracking-[0.24em] text-gold-dust transition-colors hover:bg-gold-dust/10 xl:flex"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl!}
                    alt=""
                    className="h-5 w-5 flex-none rounded-full border border-gold-dust/40 object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span aria-hidden className="grid h-5 w-5 flex-none place-items-center rounded-full border border-gold-dust/40 text-[9px] italic">
                    {(account?.name?.[0] ?? (isZh ? "我" : "A")).toUpperCase()}
                  </span>
                )}
                <span className="whitespace-nowrap">{isZh ? "账户" : "Account"}</span>
              </button>
            ) : (
              <div className="hidden items-center gap-2 xl:flex">
                <Link
                  to="/auth"
                  search={{ mode: "login", redirect: undefined }}
                  className="flex-none whitespace-nowrap rounded-full border border-gold-dust/40 px-3 py-1 text-[10px] tracking-[0.24em] text-gold-dust transition-colors hover:bg-gold-dust/10"
                >
                  {isZh ? "登录" : "Sign in"}
                </Link>
                <Link
                  to="/auth"
                  search={{ mode: "signup", redirect: undefined }}
                  className="flex-none whitespace-nowrap rounded-full bg-gold-dust px-3 py-1 text-[10px] tracking-[0.24em] text-obsidian transition-colors hover:bg-gold-light"
                >
                  {isZh ? "注册" : "Sign up"}
                </Link>
              </div>
            )}
            <div className="hidden xl:block"><LanguageToggle /></div>

            {/* Mobile-only account chip */}
            <button
              type="button"
              onClick={openAcc}
              aria-label={accountLabel}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-gold-dust/40 text-gold-dust xl:hidden"
            >
              {avatarUrl ? (
                <img src={avatarUrl!} alt="" loading="lazy" decoding="async" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <span className="text-[10px] tracking-[0.16em]">{isZh ? "我" : "ME"}</span>
              )}
            </button>

            {/* Mobile hamburger */}
            <button
              type="button"
              aria-label={isZh ? "打开菜单" : "Open menu"}
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen((v) => !v)}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-gold-dust/40 text-gold-dust xl:hidden"
            >
              <span className="flex flex-col items-center gap-[3px]">
                <span className="block h-[1.5px] w-4 bg-current" />
                <span className="block h-[1.5px] w-4 bg-current" />
                <span className="block h-[1.5px] w-4 bg-current" />
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={() => setDrawerOpen(false)}
        className={`fixed inset-0 z-[70] bg-obsidian/60 backdrop-blur-sm transition-opacity xl:hidden ${
          drawerOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Mobile drawer — mirrors desktop IA */}
      <aside
        aria-label={isZh ? "导航" : "Navigation"}
        aria-hidden={!drawerOpen}
        onMouseLeave={() => setDrawerOpen(false)}
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
        className={`fixed right-3 top-16 z-[75] flex max-h-[calc(100dvh-5rem)] w-56 flex-col items-stretch gap-1 overflow-y-auto rounded-2xl border border-gold-dust/25 bg-obsidian/95 p-2 backdrop-blur-xl shadow-[-10px_10px_40px_rgba(0,0,0,0.5)] transition-all duration-300 xl:top-20 xl:w-auto xl:bg-obsidian/85 ${
          drawerOpen
            ? "translate-x-0 opacity-100"
            : "pointer-events-none translate-x-6 opacity-0"
        }`}
      >
        {coreEntries.map((item) => {
          const active = isActive(item.to);
          const gate = !session && item.to.startsWith("/me");
          const cls = `flex min-h-11 items-center justify-end whitespace-nowrap rounded-lg px-4 py-3 text-right text-[13px] ${
            isZh ? "tracking-normal" : "uppercase tracking-[0.24em]"
          } ${active ? "bg-gold-dust/10 text-gold-light" : "text-stone-warm/85 hover:bg-gold-dust/10 hover:text-gold-light"}`;
          if (gate) {
            return (
              <Link
                key={item.to}
                to="/auth"
                search={{ mode: "login", redirect: item.to }}
                onClick={() => setDrawerOpen(false)}
                aria-label={item.ariaLabel}
                title={item.ariaLabel}
                className={cls}
              >
                {item.label}
              </Link>
            );
          }
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setDrawerOpen(false)}
              aria-current={active ? "page" : undefined}
              aria-label={item.ariaLabel}
              title={item.ariaLabel}
              className={cls}
            >
              {item.label}
            </Link>
          );
        })}
        <div className="my-1 h-px bg-white/10" />
        <div className="px-3 pb-1 pt-1 text-right text-[9px] uppercase tracking-[0.28em] text-stone-warm/40">
          {myLibraryLabel}
        </div>
        {libraryEntries.map((e, idx) => {
          const prev = libraryEntries[idx - 1];
          const showRoomsHeader = e.group === "rooms" && prev?.group !== "rooms";
          const active = isActive(e.to);
          const gate = !session;
          const cls = `flex min-h-11 items-center justify-end whitespace-nowrap rounded-lg px-4 py-3 text-right text-[12px] ${
            isZh ? "tracking-normal" : "uppercase tracking-[0.22em]"
          } ${active ? "bg-gold-dust/10 text-gold-light" : "text-stone-warm/80 hover:bg-gold-dust/10 hover:text-gold-light"}`;
          const link = gate ? (
            <Link key={e.to} to="/auth" search={{ mode: "login", redirect: e.to }} onClick={() => setDrawerOpen(false)} className={cls}>
              {e.label}
            </Link>
          ) : (
            <Link key={e.to} to={e.to} onClick={() => setDrawerOpen(false)} aria-current={active ? "page" : undefined} className={cls}>
              {e.label}
            </Link>
          );
          return (
            <div key={e.to}>
              {showRoomsHeader && (
                <div className="mt-1 border-t border-white/10 px-3 pb-1 pt-2 text-right text-[9px] uppercase tracking-[0.28em] text-gold-dust/70">
                  {isZh ? "会员阅览室" : "Membership Rooms"}
                </div>
              )}
              {link}
            </div>
          );
        })}
        {moreEntries.length > 0 && <div className="my-1 h-px bg-white/10" />}

        {moreEntries.length > 0 && (
          <div className="px-3 pb-1 pt-1 text-right text-[9px] uppercase tracking-[0.28em] text-stone-warm/40">
            {isZh ? "了解 · 更多" : "Learn · More"}
          </div>
        )}
        {moreEntries.map((item) => {
          const key = item.to ?? item.href ?? item.label;
          const active = item.to ? isActive(item.to) : false;
          const cls = `flex min-h-11 items-center justify-end whitespace-nowrap rounded-lg px-4 py-3 text-right text-[12px] ${
            isZh ? "tracking-normal" : "uppercase tracking-[0.22em]"
          } ${active ? "bg-gold-dust/10 text-gold-light" : "text-stone-warm/70 hover:bg-gold-dust/10 hover:text-gold-light"}`;
          if (item.href) {
            return (
              <a
                key={key}
                href={item.href}
                onClick={() => setDrawerOpen(false)}
                className={cls}
              >
                {item.label}
              </a>
            );
          }
          return (
            <Link
              key={key}
              to={item.to!}
              onClick={() => setDrawerOpen(false)}
              aria-current={active ? "page" : undefined}
              className={cls}
            >
              {item.label}
            </Link>
          );
        })}
        <div className="my-1 h-px bg-white/10" />
        {session ? (
          <button
            type="button"
            onClick={() => {
              setDrawerOpen(false);
              openAcc();
            }}
            className="flex min-h-11 items-center justify-end gap-2 whitespace-nowrap rounded-lg px-4 py-3 text-[11px] uppercase tracking-[0.24em] text-gold-dust hover:bg-gold-dust/10"
          >
            {avatarUrl && (
              <img
                src={avatarUrl!}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-5 w-5 flex-none rounded-full border border-gold-dust/40 object-cover"
              />
            )}
            <span>{isZh ? "账户" : "Account"}</span>
          </button>
        ) : (
          <>
            <Link
              to="/auth"
              search={{ mode: "login", redirect: undefined }}
              onClick={() => setDrawerOpen(false)}
              className="flex min-h-11 items-center justify-end whitespace-nowrap rounded-lg px-4 py-3 text-[11px] uppercase tracking-[0.24em] text-gold-dust hover:bg-gold-dust/10"
            >
              {isZh ? "登录" : "Sign in"}
            </Link>
            <Link
              to="/auth"
              search={{ mode: "signup", redirect: undefined }}
              onClick={() => setDrawerOpen(false)}
              className="flex min-h-11 items-center justify-end whitespace-nowrap rounded-lg bg-gold-dust/10 px-4 py-3 text-[11px] uppercase tracking-[0.24em] text-gold-light hover:bg-gold-dust/20"
            >
              {isZh ? "注册" : "Sign up"}
            </Link>
          </>
        )}
        <div className="flex justify-end px-2 pb-1">
          <LanguageToggle />
        </div>
      </aside>
    </>
  );
}




function SiteFooter() {
  const { t, lang } = useLang();
  const { session } = useSupabaseSession();
  const isZh = lang === "zh";
  const shelfHref = (to: string) =>
    session ? to : `/auth?mode=login&redirect=${encodeURIComponent(to)}`;

  const groups: Array<{ title: string; items: Array<{ href: string; label: string; external?: boolean }> }> = [
    {
      title: isZh ? "探索图书馆" : "Explore the Library",
      items: [
        { href: "/", label: isZh ? "导览室" : "Guide Hall" },
        { href: "/ritual", label: t.nav_ritual },
        { href: "/traditions", label: isZh ? "四大体系" : "Four Traditions" },
        { href: "/community", label: t.nav_community },
        { href: "/about", label: isZh ? "关于与伦理" : "Ethics" },
      ],
    },
    {
      title: isZh ? "个人书架" : "Personal Library",
      items: [
        { href: shelfHref("/me/home"), label: isZh ? "主页" : "Home" },
        { href: shelfHref("/me/profile"), label: isZh ? "命盘与报告" : "Charts & Reports" },
        { href: shelfHref("/me/friends"), label: isZh ? "关系与适配" : "Relationships" },
        { href: shelfHref("/me/echoes"), label: isZh ? "历史回声" : "Echoes" },
        { href: shelfHref("/me/membership"), label: isZh ? "会员与订单" : "Membership" },
      ],
    },
    {
      title: isZh ? "帮助与条款" : "Help & Terms",
      items: [
        { href: "/privacy", label: isZh ? "隐私政策" : "Privacy" },
        { href: "/terms", label: isZh ? "服务条款" : "Terms" },
        { href: "/delete-account", label: isZh ? "删除账户" : "Delete account" },
        { href: "mailto:fatenexus.studio@gmail.com", label: "fatenexus.studio@gmail.com", external: true },
      ],
    },
  ];

  return (
    <footer className="relative z-10 border-t border-white/5 px-4 py-12 sm:px-6 md:px-12 md:py-16">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 md:grid-cols-[1.2fr_1fr_1fr_1fr] md:gap-10">
          <div>
            <div className="font-serif text-xl text-stone-warm">
              Destiny<span className="text-gold-dust">Library</span>
            </div>
            <p className="mt-3 max-w-xs text-[11px] leading-relaxed text-stone-warm/50">
              {isZh
                ? "四大命理体系，一份看见自己的方式。文化娱乐与自我反思，不替你决定人生。"
                : "Four traditions read together — a way to see the patterns in your own life. Cultural reading and self-reflection, never a verdict."}
            </p>
          </div>
          {groups.map((g) => (
            <div key={g.title}>
              <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.28em] text-gold-dust/80">
                {g.title}
              </div>
              <ul className="space-y-2 text-[11px] text-stone-warm/60">
                {g.items.map((it) => (
                  <li key={it.href}>
                    <a
                      href={it.href}
                      className="transition-colors hover:text-gold-dust"
                    >
                      {it.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/5 pt-6 text-center text-[10px] uppercase tracking-[0.28em] text-stone-warm/40 md:flex-row md:text-left">
          <span className="italic">© MMXXVI · Four civilizations, one question</span>
          <span className="normal-case tracking-normal text-stone-warm/40">
            {isZh
              ? "如需支持，也可发送邮件至 fatenexus.studio@gmail.com。请勿在邮件中分享密码或敏感个人信息。"
              : "For support, you can also email fatenexus.studio@gmail.com. Please do not share passwords or sensitive personal information."}
          </span>
        </div>
      </div>
    </footer>
  );
}
