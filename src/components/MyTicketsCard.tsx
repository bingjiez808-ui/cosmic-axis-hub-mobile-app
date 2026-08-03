import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { listMyTickets, type MyTicket, type TicketStatus } from "@/lib/tickets.functions";

const STATUS_ZH: Record<TicketStatus, string> = {
  new: "新建",
  in_progress: "处理中",
  waiting_user: "等待你补充",
  resolved: "已解决",
  closed: "已关闭",
};
const STATUS_EN: Record<TicketStatus, string> = {
  new: "New",
  in_progress: "In progress",
  waiting_user: "Awaiting your reply",
  resolved: "Resolved",
  closed: "Closed",
};

const STATUS_STYLE: Record<TicketStatus, string> = {
  new: "border-sky-400/40 bg-sky-950/25 text-sky-200",
  in_progress: "border-gold-dust/40 bg-gold-dust/10 text-gold-light",
  waiting_user: "border-amber-400/40 bg-amber-950/25 text-amber-200",
  resolved: "border-emerald-400/40 bg-emerald-950/25 text-emerald-200",
  closed: "border-white/15 bg-white/[0.03] text-stone-warm/60",
};

const MAILTO =
  "mailto:fatenexus.studio@gmail.com" +
  "?subject=" +
  encodeURIComponent("Fate Nexus 订单问题 / 工单号");

export function MyTicketsCard({ lang }: { lang: "en" | "zh" }) {
  const zh = lang === "zh";
  const list = useServerFn(listMyTickets);
  const [rows, setRows] = useState<MyTicket[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    list()
      .then((data) => !cancel && setRows(data))
      .catch((e: Error) => !cancel && setErr(e.message));
    return () => {
      cancel = true;
    };
  }, [list]);

  const label = zh ? STATUS_ZH : STATUS_EN;

  return (
    <section className="rounded-2xl border border-gold-dust/20 bg-obsidian/60 p-4 shadow-inner">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.32em] text-gold-dust">
            {zh ? "我的工单" : "My tickets"}
          </p>
          <h3 className="mt-1 font-serif text-lg italic text-stone-warm">
            {zh ? "产品与订单反馈" : "Product & order feedback"}
          </h3>
        </div>
        <a
          href={MAILTO}
          className="text-[11px] text-gold-light/80 underline underline-offset-2 hover:text-gold-light"
        >
          fatenexus.studio@gmail.com
        </a>
      </div>

      <p className="mt-2 text-[11px] leading-snug text-stone-warm/60">
        {zh
          ? "如需补充订单凭证，可发送邮件至上述地址。请注明注册邮箱和工单号，不要发送密码、验证码或完整银行卡信息。"
          : "You may email additional receipts to the address above. Include your registered email and ticket number; never send passwords, verification codes, or full card details."}
      </p>

      {err && (
        <p className="mt-3 rounded-md border border-red-500/30 bg-red-950/30 px-2 py-1 text-[12px] text-red-300">
          {err}
        </p>
      )}

      {rows === null ? (
        <p className="mt-3 text-xs text-stone-warm/50">{zh ? "读取中…" : "Loading…"}</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-xs text-stone-warm/50">
          {zh
            ? "还没有工单。产品或订单出问题时，通过左下角的智者陪伴登记即可。"
            : "No tickets yet. Ask the Sage Companion (bottom-left) to file one if something goes wrong."}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-obsidian/40 px-3 py-2 text-[12px] text-stone-warm"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-gold-light">{t.ticket_code}</span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[9.5px] uppercase tracking-[0.22em] ${STATUS_STYLE[t.status]}`}
                  >
                    {label[t.status]}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[12px] text-stone-warm/85">
                  {t.subject ?? t.message.slice(0, 60)}
                </div>
                {t.user_reply && (
                  <div className="mt-1 text-[11px] italic text-emerald-200/80">
                    {zh ? "回复：" : "Reply: "}
                    {t.user_reply}
                  </div>
                )}
              </div>
              <div className="text-[10.5px] text-stone-warm/50">
                {new Date(t.created_at).toLocaleDateString()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
