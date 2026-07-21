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
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { LanguageProvider, useLang } from "../lib/i18n";
import { AccountProvider, useAccount } from "../lib/account";
import { AccountModal } from "../components/AccountModal";
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

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-obsidian px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-2xl text-stone-warm">The ritual was interrupted.</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          A disturbance in the reading. You may try again.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-full bg-gold-dust px-6 py-3 text-xs uppercase tracking-widest text-obsidian transition-colors hover:bg-gold-light"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-full border border-gold-dust/30 px-6 py-3 text-xs uppercase tracking-widest text-gold-dust transition-colors hover:border-gold-dust"
          >
            Return home
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


function LanguageToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="flex items-center gap-1 rounded-full border border-white/10 p-0.5">
      {(["en", "zh"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          className={`rounded-full px-2.5 py-1 text-[10px] tracking-[0.28em] transition-colors ${
            lang === l
              ? "bg-gold-dust/15 text-gold-light"
              : "text-stone-warm/50 hover:text-gold-dust"
          }`}
        >
          {l === "en" ? "EN" : "中"}
        </button>
      ))}
    </div>
  );
}

function SiteNav() {
  const { t, lang } = useLang();
  const { account } = useAccount();
  const { session, isAdmin, loading } = useSupabaseSession();
  const openAcc = () => {
    if (!session) {
      window.location.assign("/auth?mode=login");
      return;
    }
    window.dispatchEvent(new Event("lod:open-account"));
  };
  const [atTop, setAtTop] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [orbActive, setOrbActive] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);
  const avatarUrl = hydrated ? account?.avatar : undefined;
  const adminLabel = lang === "zh" ? "议政厅" : "Admin";

  useEffect(() => {
    const onScroll = () => setAtTop(window.scrollY < 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Show the floating orb only briefly after the user interacts, then
  // auto-hide after 3s of no activity.
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


  // Top glass bar visible only when at the top of the page.
  const showTopBar = atTop;

  const linkClass = lang === "zh"
    ? "inline-flex min-h-11 items-center whitespace-nowrap text-[13px] tracking-normal normal-case text-stone-warm/75 transition-colors hover:text-gold-dust flex-none"
    : "inline-flex min-h-11 items-center whitespace-nowrap text-[11px] uppercase tracking-[0.28em] text-stone-warm/70 transition-colors hover:text-gold-dust flex-none";

  const accountLabel = session ? t.nav_account : t.nav_sign_in;
  const showAdmin = !loading && isAdmin;

  const orbVisible = orbActive && !showTopBar && !drawerOpen;

  return (
    <>
      {/* Collapsed floating orb — appears on interaction, hides after 3s idle */}
      <button
        type="button"
        aria-label="Open navigation"
        aria-hidden={!orbVisible}
        tabIndex={orbVisible ? 0 : -1}
        onClick={() => setDrawerOpen(true)}
        className={`fixed right-4 top-4 z-[60] flex h-11 w-11 items-center justify-center rounded-full border border-gold-dust/40 bg-obsidian/70 backdrop-blur-md transition-all duration-300 hover:border-gold-dust hover:bg-gold-dust/10 md:right-6 md:top-6 ${
          orbVisible ? "opacity-100" : "pointer-events-none scale-75 opacity-0"
        }`}
      >
        <span className="block h-2 w-2 rounded-full bg-gold-dust shadow-[0_0_10px_2px_color-mix(in_oklab,var(--gold-light)_60%,transparent)]" />
      </button>

      {/* Full top navigation bar — only at top of page */}
      <nav
        className={`fixed left-1/2 top-0 z-50 w-full max-w-[100vw] -translate-x-1/2 px-3 py-3 md:p-6 transition-all duration-500 ${
          showTopBar ? "opacity-100 translate-y-0" : "-translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <div className="glass-card mx-auto flex w-full max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full px-3 py-2 md:grid md:w-auto md:max-w-[min(96vw,72rem)] md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-4 md:px-5 md:py-2 lg:gap-8 lg:px-7">
          <Link
            to="/"
            className="min-w-0 flex-1 truncate font-serif text-sm tracking-normal text-stone-warm md:flex-none md:justify-self-start md:whitespace-nowrap md:text-base"
          >
            Destiny<span className="text-gold-dust">·</span>Library
          </Link>
          <div className="hidden items-center justify-center gap-4 md:flex md:justify-self-center lg:gap-8">
            <Link to="/traditions" className={linkClass}>{t.nav_traditions}</Link>
            <Link to="/ritual" className={linkClass}>{t.nav_ritual}</Link>
            {session && (
              <Link to="/me/home" className={linkClass + " text-gold-dust"}>{t.nav_today}</Link>
            )}
            <Link to="/community" className={linkClass}>{t.nav_community}</Link>
            <Link to="/about" className={linkClass}>{t.nav_about}</Link>
            {showAdmin && (
              <Link to="/admin" className={linkClass + " text-gold-dust"}>{adminLabel}</Link>
            )}
          </div>
          <div className="flex items-center gap-2 md:justify-self-end md:gap-3">
            {session ? (
              <button
                type="button"
                onClick={openAcc}
                className="hidden flex-none items-center gap-2 whitespace-nowrap rounded-full border border-gold-dust/40 px-3 py-1 text-[10px] tracking-[0.24em] text-gold-dust transition-colors hover:bg-gold-dust/10 md:flex"
              >
                {avatarUrl && (
                  <img
                    src={avatarUrl!}
                    alt=""
                    className="h-5 w-5 flex-none rounded-full border border-gold-dust/40 object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                )}
                <span className="whitespace-nowrap">{accountLabel}</span>
              </button>
            ) : (
              <div className="hidden items-center gap-2 md:flex">
                <Link
                  to="/auth"
                  search={{ mode: "login", redirect: undefined }}
                  className="flex-none whitespace-nowrap rounded-full border border-gold-dust/40 px-3 py-1 text-[10px] tracking-[0.24em] text-gold-dust transition-colors hover:bg-gold-dust/10"
                >
                  {lang === "zh" ? "登录" : "Sign in"}
                </Link>
                <Link
                  to="/auth"
                  search={{ mode: "signup", redirect: undefined }}
                  className="flex-none whitespace-nowrap rounded-full bg-gold-dust px-3 py-1 text-[10px] tracking-[0.24em] text-obsidian transition-colors hover:bg-gold-light"
                >
                  {lang === "zh" ? "注册" : "Sign up"}
                </Link>
              </div>
            )}
            <div className="hidden md:block"><LanguageToggle /></div>

            {/* Mobile-only account chip (compact) */}
            <button
              type="button"
              onClick={openAcc}
              aria-label={accountLabel}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-gold-dust/40 text-gold-dust md:hidden"
            >
              {avatarUrl ? (
                <img src={avatarUrl!} alt="" loading="lazy" decoding="async" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <span className="text-[10px] tracking-[0.16em]">{lang === "zh" ? "我" : "ME"}</span>
              )}
            </button>

            {/* Mobile hamburger — opens the side rail */}
            <button
              type="button"
              aria-label={lang === "zh" ? "打开菜单" : "Open menu"}
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen((v) => !v)}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-gold-dust/40 text-gold-dust md:hidden"
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

      {/* Backdrop for the side rail — mobile-only for easy dismissal */}
      <div
        aria-hidden="true"
        onClick={() => setDrawerOpen(false)}
        className={`fixed inset-0 z-[70] bg-obsidian/60 backdrop-blur-sm transition-opacity md:hidden ${
          drawerOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Slim vertical rail — slides in from the right when the dot is tapped.
          No backdrop, no dialog: just a compact column of links. */}
      <aside
        aria-label="Navigation rail"
        aria-hidden={!drawerOpen}
        onMouseLeave={() => setDrawerOpen(false)}
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
        className={`fixed right-3 top-16 z-[75] flex max-h-[calc(100dvh-5rem)] w-56 flex-col items-stretch gap-1 overflow-y-auto rounded-2xl border border-gold-dust/25 bg-obsidian/95 p-2 backdrop-blur-xl shadow-[-10px_10px_40px_rgba(0,0,0,0.5)] transition-all duration-300 md:top-20 md:w-auto md:bg-obsidian/85 ${
          drawerOpen
            ? "translate-x-0 opacity-100"
            : "pointer-events-none translate-x-6 opacity-0"
        }`}
      >
        {[
          { to: "/", label: lang === "zh" ? "首页" : "Home" },
          ...(session ? [{ to: "/me/home", label: t.nav_today }] : []),
          { to: "/traditions", label: t.nav_traditions },
          { to: "/ritual", label: t.nav_ritual },
          { to: "/community", label: t.nav_community },
          { to: "/about", label: t.nav_about },
          ...(showAdmin ? [{ to: "/admin", label: adminLabel }] : []),
        ].map((item) => (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setDrawerOpen(false)}
            className={`flex min-h-11 items-center justify-end whitespace-nowrap rounded-lg px-4 py-3 text-right text-[13px] ${
              lang === "zh"
                ? "tracking-normal text-stone-warm/85"
                : "uppercase tracking-[0.24em] text-stone-warm/75"
            } transition-colors hover:bg-gold-dust/10 hover:text-gold-light`}
          >
            {item.label}
          </Link>
        ))}
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
            <span>{accountLabel}</span>
          </button>
        ) : (
          <>
            <Link
              to="/auth"
              search={{ mode: "login", redirect: undefined }}
              onClick={() => setDrawerOpen(false)}
              className="flex min-h-11 items-center justify-end whitespace-nowrap rounded-lg px-4 py-3 text-[11px] uppercase tracking-[0.24em] text-gold-dust hover:bg-gold-dust/10"
            >
              {lang === "zh" ? "登录" : "Sign in"}
            </Link>
            <Link
              to="/auth"
              search={{ mode: "signup", redirect: undefined }}
              onClick={() => setDrawerOpen(false)}
              className="flex min-h-11 items-center justify-end whitespace-nowrap rounded-lg bg-gold-dust/10 px-4 py-3 text-[11px] uppercase tracking-[0.24em] text-gold-light hover:bg-gold-dust/20"
            >
              {lang === "zh" ? "注册" : "Sign up"}
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
  const labels = lang === "zh"
    ? { ethics: "关于", privacy: "隐私政策", terms: "服务条款", del: "删除账户", traditions: t.nav_traditions }
    : { ethics: "Ethics", privacy: "Privacy", terms: "Terms", del: "Delete account", traditions: "Traditions" };
  return (
    <footer className="relative z-10 border-t border-white/5 px-4 py-12 sm:px-6 md:px-12 md:py-16">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 text-center md:flex-row md:gap-8 md:text-left">
        <div className="font-serif text-xl text-stone-warm">
          Destiny<span className="text-gold-dust">Library</span>
        </div>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[10px] font-medium uppercase tracking-[0.28em] text-stone-warm/50 md:gap-10">
          <Link to="/traditions" className="transition-colors hover:text-gold-dust">{labels.traditions}</Link>
          <Link to="/about" className="transition-colors hover:text-gold-dust">{labels.ethics}</Link>
          <Link to="/privacy" className="transition-colors hover:text-gold-dust">{labels.privacy}</Link>
          <Link to="/terms" className="transition-colors hover:text-gold-dust">{labels.terms}</Link>
          <Link to="/delete-account" className="transition-colors hover:text-gold-dust">{labels.del}</Link>
        </div>
        <div className="text-[10px] uppercase tracking-[0.28em] italic text-stone-warm/40">
          © MMXXVI · Four civilizations, one question
        </div>
      </div>
    </footer>
  );
}
