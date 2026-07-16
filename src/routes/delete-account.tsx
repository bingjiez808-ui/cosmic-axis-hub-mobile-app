import { createFileRoute, Link, useNavigate, useServerFn } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { LEGAL_CONTACT, legalCanonical } from "@/lib/legal";
import { useSupabaseSession } from "@/lib/session";
import { deleteMyAccount } from "@/lib/account.functions";

export const Route = createFileRoute("/delete-account")({
  head: () => ({
    meta: [
      { title: "Delete your account — Library of Destiny · 删除账户" },
      {
        name: "description",
        content:
          "How to permanently delete your Library of Destiny account and personal data. 如何永久删除你在命运图书馆的账户与个人资料。",
      },
      { property: "og:title", content: "Delete your account — Library of Destiny" },
      {
        property: "og:description",
        content: "Permanently remove your account, birth details, readings and feedback.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: legalCanonical("/delete-account") },
    ],
    links: [{ rel: "canonical", href: legalCanonical("/delete-account") }],
  }),
  component: DeleteAccountPage,
});

type Copy = {
  kicker: string;
  h1: string;
  intro: string[];
  whatRemoved: { h: string; items: string[] };
  howHeading: string;
  howSignedIn: string;
  howSignedOut: string;
  altHeading: string;
  altBody: string;
  contactLabel: string;
  formHeading: string;
  formIntro: string;
  confirmLabel: string;
  confirmPh: string;
  irreversible: string;
  buttonIdle: string;
  buttonBusy: string;
  cancel: string;
  signInFirst: string;
  successToast: string;
  mismatch: string;
};

const EN: Copy = {
  kicker: "Your data",
  h1: "Delete your account",
  intro: [
    "You can permanently delete your Library of Destiny account and the personal data associated with it. This is not a deactivation — the records are removed.",
    "This action is irreversible. Once complete, saved readings, birth details, feedback and community content you own can no longer be recovered.",
  ],
  whatRemoved: {
    h: "What gets removed",
    items: [
      "Your account (email, phone, password credential)",
      "Your profile: display name, avatar, membership tier",
      "Birth details you provided (date, time, place, time zone)",
      "Saved readings and generated report content tied to your account",
      "Feedback and bug reports you submitted",
      "Community posts and comments you own (except records the platform is legally required to retain)",
      "Tarot quota usage and activity metrics",
    ],
  },
  howHeading: "How to delete",
  howSignedIn: "You are signed in. Use the form below to confirm and delete.",
  howSignedOut: "Sign in first, then return to this page or use the Account panel.",
  altHeading: "Prefer email?",
  altBody:
    "If you cannot sign in, email us from the address associated with your account and we will process the deletion within 30 days.",
  contactLabel: "Contact",
  formHeading: "Confirm deletion",
  formIntro:
    "Type your account email below to confirm. Deletion happens immediately after you click the button.",
  confirmLabel: "Your account email",
  confirmPh: "you@example.com",
  irreversible: "I understand this is permanent and irreversible.",
  buttonIdle: "Permanently delete my account",
  buttonBusy: "Deleting…",
  cancel: "Cancel",
  signInFirst: "Sign in to continue",
  successToast: "Your account and data have been deleted.",
  mismatch: "That email does not match your signed-in account.",
};

const ZH: Copy = {
  kicker: "你的数据",
  h1: "删除你的账户",
  intro: [
    "你可以永久删除在命运图书馆的账户和相关个人资料。这不是停用 —— 记录会被真实清除。",
    "该操作不可撤销。完成后，保存的解读、出生资料、反馈以及你本人拥有的社区内容将无法恢复。",
  ],
  whatRemoved: {
    h: "会被清除的内容",
    items: [
      "你的账户（邮箱、手机号、登录凭据）",
      "你的档案：昵称、头像、会员等级",
      "你提供的出生资料（日期、时间、地点、时区）",
      "与你账户绑定的解读与生成内容",
      "你提交的反馈与问题报告",
      "你本人拥有的社区帖子与评论（法律要求平台保留者除外）",
      "塔罗使用配额与活跃度指标",
    ],
  },
  howHeading: "如何删除",
  howSignedIn: "你已登录。使用下方表单确认并删除。",
  howSignedOut: "请先登录，再返回本页或在「我的」面板中操作。",
  altHeading: "更愿意通过邮件？",
  altBody: "若你无法登录，可用注册邮箱联系我们，我们会在 30 天内处理你的删除请求。",
  contactLabel: "联系方式",
  formHeading: "确认删除",
  formIntro: "请输入你的账户邮箱以确认。点击按钮后将立即执行删除。",
  confirmLabel: "你的账户邮箱",
  confirmPh: "you@example.com",
  irreversible: "我已理解此操作永久且不可撤销。",
  buttonIdle: "永久删除我的账户",
  buttonBusy: "正在删除…",
  cancel: "取消",
  signInFirst: "请先登录",
  successToast: "你的账户和资料已删除。",
  mismatch: "输入的邮箱与登录账户不一致。",
};

function DeleteAccountPage() {
  const { lang } = useLang();
  const c = lang === "zh" ? ZH : EN;
  const { session, loading } = useSupabaseSession();
  const navigate = useNavigate();
  const deleteFn = useServerFn(deleteMyAccount);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);

  const userEmail = session?.user.email ?? "";
  const canSubmit =
    !busy &&
    agree &&
    confirmEmail.trim().length > 0 &&
    confirmEmail.trim().toLowerCase() === userEmail.toLowerCase();

  async function handleDelete() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await deleteFn({ data: { confirmEmail: confirmEmail.trim() } });
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore — the server has already invalidated the account
      }
      toast.success(c.successToast);
      navigate({ to: "/" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/match/i.test(msg)) toast.error(c.mismatch);
      else toast.error(msg || (lang === "zh" ? "删除失败，请稍后重试。" : "Deletion failed. Please try again."));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 pt-32 pb-32">
      <p className="mb-4 text-[10px] uppercase tracking-[0.42em] text-gold-dust">{c.kicker}</p>
      <h1 className="mb-8 font-serif text-4xl leading-tight text-stone-warm md:text-5xl">{c.h1}</h1>

      <div className="space-y-4 text-[15px] leading-relaxed text-stone-warm/80">
        {c.intro.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      <section className="mt-12">
        <h2 className="mb-3 font-serif text-2xl text-stone-warm">{c.whatRemoved.h}</h2>
        <ul className="list-disc space-y-2 pl-6 text-[15px] text-stone-warm/75">
          {c.whatRemoved.items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="mb-3 font-serif text-2xl text-stone-warm">{c.howHeading}</h2>
        {loading ? (
          <p className="text-sm text-stone-warm/50">…</p>
        ) : session ? (
          <div className="glass-card rounded-2xl p-6">
            <p className="mb-2 text-[13px] tracking-normal text-stone-warm/70">{c.howSignedIn}</p>
            <p className="mb-4 text-[11px] uppercase tracking-[0.24em] text-stone-warm/40">
              {userEmail}
            </p>

            <h3 className="mb-2 font-serif text-lg text-stone-warm">{c.formHeading}</h3>
            <p className="mb-4 text-[13px] text-stone-warm/70">{c.formIntro}</p>

            <label className="mb-2 block text-[10px] uppercase tracking-[0.24em] text-stone-warm/50">
              {c.confirmLabel}
            </label>
            <input
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={c.confirmPh}
              autoComplete="email"
              className="mb-4 w-full rounded-xl border border-white/10 bg-obsidian/40 px-4 py-3 text-[16px] text-stone-warm placeholder:text-stone-warm/30 focus:border-gold-dust/60 focus:outline-none"
            />

            <label className="mb-6 flex items-start gap-3 text-[13px] text-stone-warm/75">
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                className="mt-1 h-4 w-4 flex-none accent-gold-dust"
              />
              <span>{c.irreversible}</span>
            </label>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Link
                to="/"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-6 text-[11px] uppercase tracking-[0.28em] text-stone-warm/70 hover:text-gold-dust"
              >
                {c.cancel}
              </Link>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!canSubmit}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-red-500/85 px-6 text-[11px] uppercase tracking-[0.28em] text-obsidian transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-gold-dust"
              >
                {busy ? c.buttonBusy : c.buttonIdle}
              </button>
            </div>
          </div>
        ) : (
          <div className="glass-card rounded-2xl p-6">
            <p className="mb-4 text-[13px] text-stone-warm/70">{c.howSignedOut}</p>
            <Link
              to="/auth"
              search={{ reset: undefined, redirect: "/delete-account" }}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-gold-dust px-6 text-[11px] uppercase tracking-[0.28em] text-obsidian hover:bg-gold-light"
            >
              {c.signInFirst}
            </Link>
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="mb-3 font-serif text-2xl text-stone-warm">{c.altHeading}</h2>
        <p className="mb-3 text-[15px] text-stone-warm/75">{c.altBody}</p>
        <div className="glass-card space-y-1 rounded-2xl p-5 text-[14px] text-stone-warm/80">
          <p>{c.contactLabel}: {LEGAL_CONTACT.privacyEmail}</p>
          <p>{LEGAL_CONTACT.entityName}</p>
        </div>
      </section>
    </div>
  );
}
