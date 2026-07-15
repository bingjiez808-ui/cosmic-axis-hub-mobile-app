import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
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
      { name: "viewport", content: "width=device-width, initial-scale=1" },
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
  useEffect(() => {
    const handler = () => setAccOpen(true);
    window.addEventListener("lod:open-account", handler);
    return () => window.removeEventListener("lod:open-account", handler);
  }, []);

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
        </AccountProvider>

      </LanguageProvider>
    </QueryClientProvider>
  );
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
  const openAcc = () => window.dispatchEvent(new Event("lod:open-account"));
  const [atTop, setAtTop] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const onScroll = () => setAtTop(window.scrollY < 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Show full bar when at top, or when user has clicked the dot to expand.
  const showFull = atTop || expanded;

  // Chinese labels should not be uppercase/wide-tracked — that causes the
  // "每字一行" vertical stack seen on narrow widths.
  const linkClass = lang === "zh"
    ? "whitespace-nowrap text-[13px] tracking-normal normal-case text-stone-warm/75 transition-colors hover:text-gold-dust"
    : "whitespace-nowrap text-[11px] uppercase tracking-[0.28em] text-stone-warm/70 transition-colors hover:text-gold-dust";

  return (
    <>
      {/* Collapsed floating orb — visible when not at top and not expanded */}
      <button
        type="button"
        aria-label="Open navigation"
        onClick={() => setExpanded(true)}
        className={`fixed right-4 top-4 z-[60] flex h-11 w-11 items-center justify-center rounded-full border border-gold-dust/40 bg-obsidian/70 backdrop-blur-md transition-all duration-300 hover:border-gold-dust hover:bg-gold-dust/10 md:right-6 md:top-6 ${
          showFull ? "pointer-events-none scale-75 opacity-0" : "opacity-100"
        }`}
      >
        <span className="block h-2 w-2 rounded-full bg-gold-dust shadow-[0_0_10px_2px_color-mix(in_oklab,var(--gold-light)_60%,transparent)]" />
      </button>

      {/* Full navigation bar */}
      <nav
        className={`fixed top-0 left-1/2 z-50 -translate-x-1/2 p-3 md:p-6 transition-all duration-500 ${
          showFull ? "opacity-100 translate-y-0" : "-translate-y-full opacity-0 pointer-events-none"
        }`}
        onMouseLeave={() => {
          if (!atTop) setExpanded(false);
        }}
      >
        <div className="glass-card flex max-w-[96vw] items-center gap-3 rounded-full px-3 py-2 md:gap-6 md:px-6 md:py-2.5">
          <Link
            to="/"
            className="whitespace-nowrap font-serif text-sm tracking-normal text-stone-warm"
            onClick={() => setExpanded(false)}
          >
            Destiny<span className="text-gold-dust">·</span>Library
          </Link>
          <div className="hidden items-center gap-5 md:flex lg:gap-8">
            <Link to="/traditions" className={linkClass} onClick={() => setExpanded(false)}>
              {t.nav_traditions}
            </Link>
            <Link to="/ritual" className={linkClass} onClick={() => setExpanded(false)}>
              {t.nav_ritual}
            </Link>
            <Link to="/about" className={linkClass} onClick={() => setExpanded(false)}>
              {t.nav_about}
            </Link>
            <Link to="/community" className={linkClass} onClick={() => setExpanded(false)}>
              {t.nav_community}
            </Link>
          </div>
          <button
            type="button"
            onClick={openAcc}
            className="flex items-center gap-2 whitespace-nowrap rounded-full border border-gold-dust/40 px-3 py-1 text-[10px] tracking-[0.24em] text-gold-dust transition-colors hover:bg-gold-dust/10"
          >
            {account?.avatar && (
              <img
                src={account.avatar}
                alt=""
                className="h-5 w-5 rounded-full border border-gold-dust/40 object-cover"
              />
            )}
            <span>{account ? `${t.nav_account} · ${account.name.slice(0, 8)}` : t.nav_sign_in}</span>
          </button>
          <LanguageToggle />
          {/* Collapse back into orb (only when not at top) */}
          {!atTop && (
            <button
              type="button"
              aria-label="Collapse navigation"
              onClick={() => setExpanded(false)}
              className="ml-1 hidden h-6 w-6 items-center justify-center rounded-full text-stone-warm/50 hover:text-gold-dust md:flex"
            >
              ×
            </button>
          )}
        </div>

        {/* Mobile menu row */}
        <div className="mt-2 flex justify-center md:hidden">
          <div className="glass-card flex items-center gap-4 rounded-full px-4 py-1.5">
            <Link to="/traditions" className={linkClass} onClick={() => setExpanded(false)}>
              {t.nav_traditions}
            </Link>
            <Link to="/ritual" className={linkClass} onClick={() => setExpanded(false)}>
              {t.nav_ritual}
            </Link>
            <Link to="/about" className={linkClass} onClick={() => setExpanded(false)}>
              {t.nav_about}
            </Link>
            <Link to="/community" className={linkClass} onClick={() => setExpanded(false)}>
              {t.nav_community}
            </Link>
          </div>
        </div>
      </nav>
    </>
  );
}



function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-white/5 px-6 py-16 md:px-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 md:flex-row">
        <div className="font-serif text-xl text-stone-warm">
          Destiny<span className="text-gold-dust">Library</span>
        </div>
        <div className="flex gap-10 text-[10px] font-medium uppercase tracking-[0.28em] text-stone-warm/50">
          <Link to="/traditions" className="transition-colors hover:text-gold-dust">
            Traditions
          </Link>
          <Link to="/about" className="transition-colors hover:text-gold-dust">
            Ethics
          </Link>
          <Link to="/about" className="transition-colors hover:text-gold-dust">
            Privacy
          </Link>
        </div>
        <div className="text-[10px] uppercase tracking-[0.28em] italic text-stone-warm/40">
          © MMXXVI · Four civilizations, one question
        </div>
      </div>
    </footer>
  );
}
