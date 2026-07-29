/**
 * AdminRedemptionSection — the "兑换码管理" tab embedded in /admin.
 *
 * Two panes:
 *   1. Create — batch form; on success shows the ONE-TIME plaintext list
 *      with copy-all and CSV download. The server never returns the
 *      plaintext again; once the modal is closed those codes are gone.
 *   2. Registry — filterable list of codes (metadata only) with disable
 *      buttons and a usage log drill-down.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  adminCreateRedemptionCodes,
  adminDisableRedemptionCode,
  adminListRedemptionCodes,
  adminListRedemptionUses,
  type AdminCodeRow,
  type AdminUseRow,
  type CreatedCode,
} from "@/lib/redemption.functions";
import type { RedemptionBenefitType } from "@/lib/redemption-format";

const BENEFIT_LABELS: Record<RedemptionBenefitType, string> = {
  sage_membership: "贤者会员",
  oracle_membership: "神谕者会员",
  premium_report: "¥79 综合报告",
  test_access: "测试访问",
  support_compensation: "客服补偿",
};

const STATUS_LABELS: Record<string, string> = {
  active: "生效中",
  disabled: "已禁用",
  exhausted: "已用完",
  expired: "已过期",
};

export function AdminRedemptionSection() {
  const [codes, setCodes] = useState<AdminCodeRow[] | null>(null);
  const [uses, setUses] = useState<AdminUseRow[] | null>(null);
  const [filterBenefit, setFilterBenefit] = useState<RedemptionBenefitType | "">("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [drillCode, setDrillCode] = useState<AdminCodeRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [reload, setReload] = useState(0);

  // Load codes
  useEffect(() => {
    let cancel = false;
    setCodes(null);
    adminListRedemptionCodes({
      data: {
        benefitType: (filterBenefit || null) as RedemptionBenefitType | null,
        status: (filterStatus || null) as never,
        limit: 200,
      },
    })
      .then((rows) => {
        if (!cancel) setCodes(rows);
      })
      .catch((e: Error) => {
        if (!cancel) toast.error(e.message);
      });
    return () => {
      cancel = true;
    };
  }, [filterBenefit, filterStatus, reload]);

  // Load uses when drilling into a code
  useEffect(() => {
    if (!drillCode) return;
    let cancel = false;
    setUses(null);
    adminListRedemptionUses({ data: { codeId: drillCode.id } })
      .then((rows) => {
        if (!cancel) setUses(rows);
      })
      .catch((e: Error) => {
        if (!cancel) toast.error(e.message);
      });
    return () => {
      cancel = true;
    };
  }, [drillCode]);

  const grouped = useMemo(() => codes ?? [], [codes]);

  return (
    <section aria-labelledby="admin-redemption-title" className="mt-12">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2
            id="admin-redemption-title"
            className="font-serif text-2xl italic text-stone-warm"
          >
            兑换码管理
          </h2>
          <p className="mt-1 text-xs text-stone-warm/60">
            创建、查看、禁用兑换码。生成后的明文仅本次弹窗内可见，之后仅留脱敏摘要。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          data-testid="admin-create-codes"
          className="rounded-full border border-gold-dust/40 bg-gold-dust/10 px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-gold-light hover:bg-gold-dust/20"
        >
          + 新建兑换码
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 text-xs">
        <select
          value={filterBenefit}
          onChange={(e) => setFilterBenefit(e.target.value as never)}
          className="rounded-lg border border-white/10 bg-obsidian/40 px-3 py-2 text-stone-warm"
        >
          <option value="">全部权益</option>
          {(Object.keys(BENEFIT_LABELS) as RedemptionBenefitType[]).map((k) => (
            <option key={k} value={k}>
              {BENEFIT_LABELS[k]}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-white/10 bg-obsidian/40 px-3 py-2 text-stone-warm"
        >
          <option value="">全部状态</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="glass-card overflow-hidden rounded-2xl border border-white/10">
        <div className="hidden grid-cols-[1.2fr_1fr_0.8fr_0.8fr_0.6fr_1fr_0.8fr] gap-3 border-b border-white/10 bg-obsidian/40 px-4 py-3 text-[10px] uppercase tracking-[0.24em] text-stone-warm/50 md:grid">
          <div>脱敏码</div>
          <div>权益</div>
          <div>时长</div>
          <div>次数</div>
          <div>状态</div>
          <div>活动</div>
          <div className="text-right">操作</div>
        </div>
        {codes === null ? (
          <p className="p-6 text-center text-sm text-stone-warm/50">读取中…</p>
        ) : grouped.length === 0 ? (
          <p className="p-6 text-center text-sm text-stone-warm/50">暂无兑换码。</p>
        ) : (
          grouped.map((c) => (
            <div
              key={c.id}
              data-testid={`admin-code-row-${c.id}`}
              className="grid grid-cols-1 gap-2 border-b border-white/5 px-4 py-3 last:border-b-0 md:grid-cols-[1.2fr_1fr_0.8fr_0.8fr_0.6fr_1fr_0.8fr] md:items-center md:gap-3"
            >
              <div className="font-mono text-[12px] text-stone-warm">
                {c.code_prefix}-•••• {c.code_last4}
              </div>
              <div className="text-xs text-stone-warm/75">{BENEFIT_LABELS[c.benefit_type]}</div>
              <div className="text-xs text-stone-warm/70">
                {c.duration_days ? `${c.duration_days} 天` : "—"}
              </div>
              <div className="text-xs text-stone-warm/70">
                {c.redemption_count}/{c.max_redemptions}
              </div>
              <div>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.24em] ${
                    c.status === "active"
                      ? "border-emerald-400/50 text-emerald-300"
                      : "border-white/15 text-stone-warm/50"
                  }`}
                >
                  {STATUS_LABELS[c.status] ?? c.status}
                </span>
              </div>
              <div className="text-xs text-stone-warm/60">{c.campaign_name || "—"}</div>
              <div className="flex flex-wrap justify-start gap-2 md:justify-end">
                <button
                  type="button"
                  onClick={() => setDrillCode(c)}
                  className="rounded-full border border-white/15 px-3 py-1 text-[10px] text-stone-warm/70 hover:border-gold-dust/40"
                >
                  记录
                </button>
                {c.status === "active" && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm("确认禁用该兑换码？已兑换的用户不受影响。")) return;
                      try {
                        await adminDisableRedemptionCode({ data: { codeId: c.id } });
                        toast.success("已禁用");
                        setReload((n) => n + 1);
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                    className="rounded-full border border-rose-400/40 px-3 py-1 text-[10px] text-rose-200 hover:bg-rose-500/10"
                  >
                    禁用
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {creating && (
        <CreateCodesModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            setReload((n) => n + 1);
          }}
        />
      )}

      {drillCode && (
        <UsesDrawer code={drillCode} uses={uses} onClose={() => setDrillCode(null)} />
      )}
    </section>
  );
}

function CreateCodesModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [benefitType, setBenefitType] = useState<RedemptionBenefitType>("sage_membership");
  const [quantity, setQuantity] = useState(1);
  const [durationDays, setDurationDays] = useState<number | "">(30);
  const [maxRedemptions, setMaxRedemptions] = useState(1);
  const [campaignName, setCampaignName] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [assignedEmail, setAssignedEmail] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CreatedCode[] | null>(null);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await adminCreateRedemptionCodes({
        data: {
          benefitType,
          quantity,
          durationDays:
            benefitType === "sage_membership" ||
            benefitType === "oracle_membership" ||
            benefitType === "test_access" ||
            benefitType === "support_compensation"
              ? (durationDays === "" ? 30 : Number(durationDays))
              : null,
          maxRedemptions,
          startsAt: null,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          reportScope: benefitType === "premium_report" ? "current_chart" : null,
          campaignName: campaignName.trim() || null,
          internalNote: internalNote.trim() || null,
          assignedEmail: assignedEmail.trim().toLowerCase() || null,
        },
      });
      setResult(res.codes);
      toast.success(`已生成 ${res.codes.length} 枚兑换码`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!result) return;
    const csv = ["code,benefit,note", ...result.map((c) => `${c.code},${benefitType},${campaignName}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `redemption-codes-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-obsidian/80 p-4 backdrop-blur-md">
      <div className="glass-card max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gold-dust/30 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-xl italic text-stone-warm">新建兑换码</h3>
          <button type="button" onClick={onClose} className="text-stone-warm/50 hover:text-gold-dust">
            ✕
          </button>
        </div>

        {!result && (
          <div className="space-y-4 text-sm text-stone-warm">
            <Field label="权益类型">
              <select
                value={benefitType}
                onChange={(e) => setBenefitType(e.target.value as RedemptionBenefitType)}
                className="w-full rounded-lg border border-white/10 bg-obsidian/40 px-3 py-2"
              >
                {(Object.keys(BENEFIT_LABELS) as RedemptionBenefitType[]).map((k) => (
                  <option key={k} value={k}>
                    {BENEFIT_LABELS[k]}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="数量 (1-500)">
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.min(500, Number(e.target.value))))}
                  className="w-full rounded-lg border border-white/10 bg-obsidian/40 px-3 py-2"
                />
              </Field>
              <Field label="每码可用次数">
                <input
                  type="number"
                  min={1}
                  value={maxRedemptions}
                  onChange={(e) => setMaxRedemptions(Math.max(1, Number(e.target.value)))}
                  className="w-full rounded-lg border border-white/10 bg-obsidian/40 px-3 py-2"
                />
              </Field>
            </div>
            {benefitType !== "premium_report" && (
              <Field label="会员时长（天）">
                <input
                  type="number"
                  min={1}
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full rounded-lg border border-white/10 bg-obsidian/40 px-3 py-2"
                />
              </Field>
            )}
            <Field label="活动名（可选）">
              <input
                type="text"
                maxLength={80}
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-obsidian/40 px-3 py-2"
              />
            </Field>
            <Field label="内部备注（不对用户展示）">
              <textarea
                rows={2}
                maxLength={500}
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-obsidian/40 px-3 py-2"
              />
            </Field>
            <Field label="定向账号邮箱（可选，填写后仅此邮箱可兑换）">
              <input
                type="email"
                inputMode="email"
                autoComplete="off"
                maxLength={254}
                placeholder="user@example.com"
                value={assignedEmail}
                onChange={(e) => setAssignedEmail(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-obsidian/40 px-3 py-2"
              />
              <p className="mt-1 text-[10px] leading-relaxed text-stone-warm/50">
                留空 = 任意登录用户可兑换。填写后其他账号会收到「此码未指派给你」错误。建议单码使用（数量=1，次数=1）。
              </p>
            </Field>
            <Field label="到期日期（可选）">
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-obsidian/40 px-3 py-2"
              />
            </Field>
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              data-testid="admin-create-submit"
              className="mt-2 w-full rounded-full bg-gold-dust px-6 py-3 text-[11px] uppercase tracking-[0.24em] text-obsidian hover:bg-gold-light disabled:opacity-50"
            >
              {busy ? "生成中…" : "生成兑换码"}
            </button>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="rounded-xl border border-amber-400/40 bg-amber-500/[0.08] p-3 text-[11px] text-amber-100">
              ⚠ 明文兑换码仅此次可见。请立即复制或下载 CSV，关闭后无法再次查看。
            </div>
            <div className="max-h-[40vh] overflow-y-auto rounded-lg border border-white/10 bg-obsidian/40 p-3">
              <pre className="whitespace-pre-wrap break-all font-mono text-[12px] text-stone-warm">
                {result.map((c) => c.code).join("\n")}
              </pre>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(result.map((c) => c.code).join("\n"));
                  toast.success("已复制");
                }}
                className="flex-1 rounded-full border border-gold-dust/40 px-4 py-2 text-[11px] text-gold-light hover:bg-gold-dust/10"
              >
                复制全部
              </button>
              <button
                type="button"
                onClick={download}
                className="flex-1 rounded-full border border-gold-dust/40 px-4 py-2 text-[11px] text-gold-light hover:bg-gold-dust/10"
              >
                下载 CSV
              </button>
            </div>
            <button
              type="button"
              onClick={onCreated}
              className="w-full rounded-full bg-gold-dust px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-obsidian hover:bg-gold-light"
            >
              完成
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function UsesDrawer({
  code,
  uses,
  onClose,
}: {
  code: AdminCodeRow;
  uses: AdminUseRow[] | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-obsidian/80 p-4 backdrop-blur-md">
      <div className="glass-card max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-gold-dust/30 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-serif text-xl italic text-stone-warm">兑换记录</h3>
            <p className="mt-1 font-mono text-xs text-stone-warm/60">
              {code.code_prefix}-•••• {code.code_last4} · {BENEFIT_LABELS[code.benefit_type]}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-stone-warm/50 hover:text-gold-dust">
            ✕
          </button>
        </div>
        {uses === null ? (
          <p className="p-6 text-center text-sm text-stone-warm/50">读取中…</p>
        ) : uses.length === 0 ? (
          <p className="p-6 text-center text-sm text-stone-warm/50">尚无兑换记录。</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {uses.map((u) => (
              <li
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-obsidian/30 px-3 py-2"
              >
                <div>
                  <p className="font-mono text-stone-warm/85">
                    {u.user_email ?? u.user_id.slice(0, 8)}
                  </p>
                  <p className="text-[11px] text-stone-warm/50">
                    {new Date(u.redeemed_at).toLocaleString()} · {u.status}
                    {u.failure_code ? ` · ${u.failure_code}` : ""}
                  </p>
                </div>
                {u.chart_id && (
                  <span className="font-mono text-[10px] text-stone-warm/50">
                    chart {u.chart_id.slice(0, 8)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-[0.24em] text-stone-warm/60">{label}</span>
      {children}
    </label>
  );
}
