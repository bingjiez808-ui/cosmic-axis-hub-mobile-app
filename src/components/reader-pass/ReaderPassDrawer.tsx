/**
 * ReaderPassDrawer — "我的借阅证" side sheet opened on tap. Reuses the
 * project's Sheet primitive; every CTA links to an existing real route
 * (no new routes invented). The Drawer is a navigation hub, NOT a copy
 * of any full-page feature.
 */
import { Link } from "@tanstack/react-router";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ReaderPassData } from "./useReaderPassData";

export type ReaderPassDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ReaderPassData;
};

export function ReaderPassDrawer({ open, onOpenChange, data }: ReaderPassDrawerProps) {
  const { lang } = useLang();
  const isZh = lang === "zh";
  const close = () => onOpenChange(false);

  const t = {
    title: isZh ? "我的借阅证" : "My Reader's Pass",
    subtitle: isZh
      ? "命运图书馆的读者档案与常用入口"
      : "Your reader profile and shortcuts inside the library",
    identity: isZh ? "身份" : "Identity",
    reader: isZh ? "读者" : "Reader",
    number: isZh ? "借阅编号" : "Reader No.",
    chart: isZh ? "主命盘" : "Primary chart",
    guestNote: isZh
      ? "登录后,图书馆会为你保存命盘、报告、今日阅读与馆内记录。"
      : "Sign in and the library keeps your chart, reports, daily reading and reader history.",
    login: isZh ? "登录并领取借阅证" : "Sign in and claim my pass",
    continueGuest: isZh ? "继续以访客身份浏览" : "Keep browsing as a guest",
    buildChart: isZh
      ? "开启仪式,建立我的第一张命盘"
      : "Open the ritual — build my first chart",
    shelf: isZh ? "进入我的书架" : "Open My Shelf",
    today: isZh ? "查看今日命运" : "See today's reading",
    membership: isZh ? "查看会员与订单" : "Membership & orders",
    disclaimer: isZh
      ? "所有命理解读用于文化娱乐与自我反思,不替代医疗、法律、投资或人生决策。"
      : "All destiny readings are for cultural enjoyment and self-reflection — not medical, legal, financial or life advice.",
  };

  const identity = isZh ? data.identityZh : data.identityEn;
  const chartLabel = isZh ? data.chartLabelZh : data.chartLabelEn;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "flex w-full max-w-full flex-col border-gold-dust/25 bg-obsidian/95 p-0 text-stone-warm",
          "sm:max-w-[420px]",
        )}
      >
        <SheetHeader className="border-b border-gold-dust/20 px-6 py-5">
          <p className="text-[10px] uppercase tracking-[0.4em] text-gold-dust/70">
            {isZh ? "命运图书馆" : "Destiny Library"}
          </p>
          <SheetTitle className="font-serif text-2xl text-stone-warm">{t.title}</SheetTitle>
          <SheetDescription className="text-sm text-stone-warm/70">
            {t.subtitle}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <dl className="space-y-3 rounded-2xl border border-gold-dust/15 bg-obsidian/60 p-4">
            <Row label={t.reader}>{data.displayName}</Row>
            <Row label={t.identity}>
              <span className="text-gold-light">{identity}</span>
            </Row>
            <Row label={t.number}>
              <span className="font-mono tracking-wider">{data.readerNumber}</span>
            </Row>
            <Row label={t.chart}>{chartLabel}</Row>
          </dl>

          {!data.isSignedIn ? (
            <div className="space-y-3">
              <p className="text-sm text-stone-warm/75">{t.guestNote}</p>
              <Link
                to="/auth"
                search={{ redirect: "/" }}
                onClick={close}
                className="block w-full rounded-full border border-gold-dust/50 bg-gold-dust/15 px-5 py-3 text-center text-xs uppercase tracking-[0.28em] text-gold-light transition hover:bg-gold-dust/25"
              >
                {t.login}
              </Link>
              <button
                type="button"
                onClick={close}
                className="w-full rounded-full border border-white/10 px-5 py-3 text-xs uppercase tracking-[0.28em] text-stone-warm/70 transition hover:text-stone-warm"
              >
                {t.continueGuest}
              </button>
            </div>
          ) : !data.hasPrimaryChart ? (
            <div className="space-y-3">
              <Link
                to="/ritual"
                onClick={close}
                className="block w-full rounded-full border border-gold-dust/50 bg-gold-dust/15 px-5 py-3 text-center text-xs uppercase tracking-[0.28em] text-gold-light transition hover:bg-gold-dust/25"
              >
                {t.buildChart}
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              <DrawerLink to="/me/home" onClose={close} label={t.shelf} />
              <DrawerLink to="/me/home" onClose={close} label={t.today} />
              <DrawerLink to="/me/membership" onClose={close} label={t.membership} />
            </div>
          )}

          <p className="pt-3 text-[11px] leading-relaxed text-stone-warm/50">
            {t.disclaimer}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <dt className="text-[11px] uppercase tracking-[0.3em] text-stone-warm/55">{label}</dt>
      <dd className="text-right text-stone-warm/95">{children}</dd>
    </div>
  );
}

function DrawerLink({
  to,
  label,
  onClose,
}: {
  to: string;
  label: string;
  onClose: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClose}
      className="flex items-center justify-between rounded-2xl border border-gold-dust/20 bg-obsidian/50 px-4 py-3 text-sm text-stone-warm/90 transition hover:border-gold-dust/40 hover:bg-obsidian/70"
    >
      <span>{label}</span>
      <span aria-hidden className="text-gold-dust/70">→</span>
    </Link>
  );
}
