import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Link } from "@tanstack/react-router";

import { useAccount } from "@/lib/account";
import { useLang } from "@/lib/i18n";

export function AccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = useLang();
  const { account, signIn, signOut, saved, removeReading } = useAccount();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    signIn({ name: name.trim() || email.split("@")[0], email: email.trim() });
    setName("");
    setEmail("");
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-end justify-center bg-obsidian/70 backdrop-blur-md md:items-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.98 }}
            transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
            className="glass-card relative m-4 w-full max-w-lg rounded-3xl p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 text-[10px] uppercase tracking-[0.28em] text-stone-warm/50 hover:text-gold-dust"
            >
              {t.mem_close}
            </button>

            <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
              {t.acc_title}
            </p>
            <h3 className="mb-2 font-serif text-2xl italic text-stone-warm">
              {account ? `${t.acc_signed_as} · ${account.name}` : t.acc_title}
            </h3>
            <p className="mb-6 text-sm text-stone-warm/60">{t.acc_desc}</p>

            {!account ? (
              <form onSubmit={submit} className="space-y-3">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.acc_name}
                  className="ritual-input !py-2 !text-base w-full"
                />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.acc_email}
                  className="ritual-input !py-2 !text-base w-full"
                />
                <button
                  type="submit"
                  className="w-full rounded-full bg-gold-dust px-6 py-3 text-[10px] uppercase tracking-[0.32em] text-obsidian transition-colors hover:bg-gold-light"
                >
                  {t.acc_sign_in}
                </button>
                <p className="text-[10px] uppercase tracking-[0.24em] text-stone-warm/30">
                  {t.acc_privacy}
                </p>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <p className="text-sm text-stone-warm/70">{account.email}</p>
                </div>

                <div>
                  <p className="mb-3 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                    {t.acc_view_saved}
                  </p>
                  {saved.length === 0 ? (
                    <p className="text-sm text-stone-warm/50">{t.acc_no_saved}</p>
                  ) : (
                    <ul className="space-y-2">
                      {saved.map((s) => {
                        const q: Record<string, string> = { name: s.name };
                        if (s.date) q.date = s.date;
                        if (s.time) q.time = s.time;
                        if (s.place) q.place = s.place;
                        if (s.lang) q.lang = s.lang;
                        return (
                          <li
                            key={s.id}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3"
                          >
                            <div>
                              <p className="font-serif text-base italic text-stone-warm">
                                {s.name}
                              </p>
                              <p className="text-[10px] uppercase tracking-[0.24em] text-stone-warm/40">
                                {[s.date, s.place].filter(Boolean).join(" · ")}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Link
                                to="/report"
                                search={q}
                                onClick={onClose}
                                className="rounded-full border border-gold-dust/40 px-3 py-1.5 text-[10px] uppercase tracking-[0.28em] text-gold-dust hover:bg-gold-dust/10"
                              >
                                {t.acc_open_reading}
                              </Link>
                              <button
                                type="button"
                                onClick={() => removeReading(s.id)}
                                aria-label={lang === "zh" ? "删除" : "Remove"}
                                className="text-stone-warm/40 hover:text-gold-dust"
                              >
                                ×
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <button
                  type="button"
                  onClick={signOut}
                  className="w-full rounded-full border border-gold-dust/40 px-6 py-3 text-[10px] uppercase tracking-[0.32em] text-gold-dust hover:bg-gold-dust/10"
                >
                  {t.acc_sign_out}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
