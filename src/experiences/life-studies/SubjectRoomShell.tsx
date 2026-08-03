import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

import { useLang } from "@/lib/i18n";

/**
 * Shared mobile app header + back-affordance for every subject room.
 * Every page carries a visible path back to 命运通识馆 and a subtitle
 * explaining the room's angle.
 */
export function SubjectRoomShell({
  eyebrow,
  title,
  subtitle,
  children,
  active,
}: {
  eyebrow: { zh: string; en: string };
  title: { zh: string; en: string };
  subtitle: { zh: string; en: string };
  children: ReactNode;
  active?: string;
}) {
  const { lang } = useLang();
  const isZh = lang === "zh";
  return (
    <div className="min-h-screen bg-[#090810] text-amber-50">
      <div className="mx-auto w-full max-w-[430px] px-4 pb-28 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="mb-6 flex items-center gap-3">
          <Link
            to="/life-studies"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-amber-400/20 bg-black/30 text-amber-100 transition active:scale-95"
            aria-label={isZh ? "返回命运通识馆" : "Back to Life Studies"}
            data-testid="subject-room-back"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-amber-300/55">
              {isZh ? "命运通识馆" : "Life Studies"}
            </div>
            <div className="mt-1 text-sm font-medium text-amber-100">
              {isZh ? eyebrow.zh : eyebrow.en}
            </div>
          </div>
        </div>
        <header className="mb-4 rounded-[26px] border border-amber-400/15 bg-gradient-to-br from-[#17121f] via-[#0f0d16] to-[#090810] p-4 shadow-[0_20px_60px_-42px_rgba(251,191,36,0.45)]">
          <h1 className="text-2xl font-semibold leading-tight text-amber-50">
            {isZh ? title.zh : title.en}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-amber-100/70">
            {isZh ? subtitle.zh : subtitle.en}
          </p>
        </header>
        {children}
      </div>
    </div>
  );
}
