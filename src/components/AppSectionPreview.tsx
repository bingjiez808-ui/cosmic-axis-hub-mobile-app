import { Link } from "@tanstack/react-router";
import { ChevronRight, LockKeyhole } from "lucide-react";
import type { ComponentType } from "react";

type PreviewItem = {
  label: string;
  value: string;
};

export function AppSectionPreview({
  icon: Icon,
  eyebrow,
  title,
  body,
  image,
  items,
  primaryLabel,
  primaryTo,
  primarySearch,
  secondaryLabel,
  secondaryTo,
  secondarySearch,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  eyebrow: string;
  title: string;
  body: string;
  image: string;
  items: PreviewItem[];
  primaryLabel: string;
  primaryTo: string;
  primarySearch?: never;
  secondaryLabel?: string;
  secondaryTo?: string;
  secondarySearch?: never;
}) {
  return (
    <main className="min-h-screen bg-[#04050a] text-amber-50">
      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#080910] px-4 pb-28 pt-[calc(env(safe-area-inset-top)+0.85rem)]">
        <section className="overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.045] shadow-[0_24px_80px_-48px_rgba(20,184,166,0.75)]">
          <div className="relative">
            <img
              src={image}
              alt=""
              className="h-56 w-full object-cover object-top opacity-88"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#080910] via-[#080910]/45 to-transparent" />
            <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-teal-100 backdrop-blur-md">
              <Icon aria-hidden className="h-4 w-4 text-teal-200" />
              {eyebrow}
            </div>
          </div>
          <div className="-mt-12 p-4 pt-0">
            <h1 className="relative text-2xl font-semibold leading-tight text-amber-50">
              {title}
            </h1>
            <p className="relative mt-3 text-sm leading-relaxed text-amber-100/66">
              {body}
            </p>
          </div>
        </section>

        <section className="mt-4 rounded-[28px] border border-amber-300/14 bg-gradient-to-br from-amber-300/10 via-white/[0.04] to-teal-300/8 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-amber-100">馆藏入口</h2>
            <span className="text-[11px] text-amber-100/45">精选</span>
          </div>
          <div className="flex snap-x gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {items.map((item, index) => (
              <div
                key={item.label}
                className="min-w-[176px] snap-start rounded-[20px] border border-white/10 bg-black/24 p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-teal-300/12 text-[11px] text-teal-100">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="text-sm font-medium text-amber-50">{item.label}</div>
                </div>
                <p className="mt-2 max-h-20 overflow-hidden text-xs leading-relaxed text-amber-100/58">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-300/12 text-amber-200">
              <LockKeyhole aria-hidden className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-medium text-amber-50">进入后保存在读者证</h2>
              <p className="mt-1 text-xs leading-relaxed text-amber-100/55">
                命盘、记录与专属解读会归入同一张读者证，之后可随时回到书架继续阅读。
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
            <Link
              to={primaryTo as never}
              search={primarySearch}
              className="flex min-h-12 items-center justify-center rounded-2xl bg-teal-300 px-4 text-sm font-semibold text-[#061312] transition active:scale-[0.98]"
            >
              {primaryLabel}
            </Link>
            {secondaryLabel && secondaryTo ? (
              <Link
                to={secondaryTo as never}
                search={secondarySearch}
                className="flex min-h-12 items-center justify-center gap-1 rounded-2xl border border-amber-300/20 px-4 text-sm font-medium text-amber-100 transition active:scale-[0.98]"
              >
                {secondaryLabel}
                <ChevronRight aria-hidden className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
