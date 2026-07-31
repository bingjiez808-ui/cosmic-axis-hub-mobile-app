/**
 * 旅者身份卡 — the anonymous identity a traveler carries when sending letters
 * in 同门 · 众生之厅. The house, title, and number are derived deterministically
 * from a stable seed (account email, or a persisted guest id), so the same
 * person always shows the same identity. The portrait is optional and painted
 * by AI from the house attributes.
 */
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import { useAccount } from "@/lib/account";
import { useLang } from "@/lib/i18n";

const IDENTITY_KEY = "lod.community.identity.v1";

const HOUSES = [
  {
    key: "ember",
    name: ["House of Ember", "赤炉学院"] as [string, string],
    tone: ["#c94a3a", "#e08a55"],
    motto: [
      "We were made to burn — but only the true flame lasts.",
      "生而为焚 —— 唯有真火可久燃。",
    ] as [string, string],
    element: ["Fire", "火"] as [string, string],
    glyph: "☉",
  },
  {
    key: "loam",
    name: ["House of Loam", "厚土学院"] as [string, string],
    tone: ["#7a5228", "#b98a4a"],
    motto: ["The slow root outlasts the quick storm.", "缓根胜疾风。"] as [string, string],
    element: ["Earth", "土"] as [string, string],
    glyph: "♁",
  },
  {
    key: "aether",
    name: ["House of Aether", "空明学院"] as [string, string],
    tone: ["#4c6b8a", "#9ec4de"],
    motto: ["A clear mind is the sharpest blade.", "澄心为最锋利之刃。"] as [string, string],
    element: ["Air", "风"] as [string, string],
    glyph: "☿",
  },
  {
    key: "tide",
    name: ["House of Tide", "潮汐学院"] as [string, string],
    tone: ["#3a3f7a", "#7f8fd4"],
    motto: ["Depth remembers what the surface forgets.", "深处记得表面所遗忘。"] as [string, string],
    element: ["Water", "水"] as [string, string],
    glyph: "☽",
  },
];

const TITLES_EN = [
  "Wanderer", "Cartographer", "Ember-Keeper", "Star-Scribe", "Threshold-Walker",
  "Moon-Reader", "Ash-Weaver", "Silent Archivist", "Salt-Diver", "Candle-Bearer",
  "Rain-Listener", "Bone-Whisperer", "Root-Singer", "Compass-Turner", "Dust-Whisperer",
];
const TITLES_ZH = [
  "游者", "绘图师", "守炉人", "星书吏", "门槛行者",
  "读月者", "编灰者", "静默档案师", "咸潜者", "持烛人",
  "听雨人", "低语骨匠", "根之歌者", "转罗盘者", "低语尘者",
];

function hashSeed(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function buildIdentity(seed: string) {
  const h = hashSeed(seed || "anonymous-traveler");
  return {
    houseIdx: h % HOUSES.length,
    titleIdx: (h >>> 6) % TITLES_EN.length,
    number: ((h >>> 12) % 8999) + 1000,
    hue: h % 360,
  };
}

function AvatarGlyph({
  hue,
  glyph,
  size = 96,
  imageUrl,
}: {
  hue: number;
  glyph: string;
  size?: number;
  imageUrl?: string;
}) {
  const bg1 = `hsl(${hue} 45% 22%)`;
  const bg2 = `hsl(${(hue + 40) % 360} 55% 44%)`;
  return (
    <div
      className="relative grid shrink-0 place-items-center overflow-hidden rounded-full border border-gold-dust/40"
      style={{
        width: size,
        height: size,
        background: imageUrl
          ? undefined
          : `radial-gradient(circle at 30% 30%, ${bg2}, ${bg1} 65%, #05060a 100%)`,
      }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <span
          className="font-serif italic text-gold-light"
          style={{ fontSize: size * 0.5, textShadow: "0 0 12px rgba(212,175,110,0.6)" }}
        >
          {glyph}
        </span>
      )}
      <span
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background: "radial-gradient(circle at 70% 80%, rgba(255,255,255,0.05), transparent 60%)",
        }}
      />
    </div>
  );
}

export function TravelerIdentityCard() {
  const { lang } = useLang();
  const li = lang === "zh" ? 1 : 0;
  const { account, setAvatar } = useAccount();
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // SSR and the first client render use the fixed seed so hydration matches;
  // the real seed is applied after mount.
  const [identitySeed, setIdentitySeed] = useState<string>("wanderer");
  useEffect(() => {
    const fromAccount = account?.email || account?.name;
    if (fromAccount) {
      setIdentitySeed(fromAccount);
      return;
    }
    try {
      let seed = localStorage.getItem(IDENTITY_KEY) || "";
      if (!seed) {
        seed = `guest-${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem(IDENTITY_KEY, seed);
      }
      setIdentitySeed(seed);
    } catch {}
  }, [account]);

  const identity = useMemo(() => buildIdentity(identitySeed), [identitySeed]);
  const house = HOUSES[identity.houseIdx];
  const travelerTitle = lang === "zh" ? TITLES_ZH[identity.titleIdx] : TITLES_EN[identity.titleIdx];

  const generateAvatar = async () => {
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setAvatarError(lang === "zh" ? "请先登录后再生成画像。" : "Please sign in to generate a portrait.");
        return;
      }
      const r = await fetch("/api/generate-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          house: house.name[0],
          element: house.element[0],
          zodiac: "",
          title: TITLES_EN[identity.titleIdx],
          lang,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const { dataUrl } = (await r.json()) as { dataUrl: string };
      setAvatar(dataUrl);
    } catch (e) {
      console.error(e);
      setAvatarError(
        lang === "zh" ? "画像生成暂时失败，请稍后再试。" : "Portrait generation failed — try again shortly.",
      );
    } finally {
      setAvatarBusy(false);
    }
  };

  return (
    <section className="mx-auto mt-12 w-full max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="hall-paper overflow-hidden p-6 sm:p-8 md:p-10"
        style={{
          backgroundImage: `linear-gradient(140deg, ${house.tone[0]}1f, transparent 58%), radial-gradient(120% 90% at 12% 0%, var(--hall-glow), transparent 62%)`,
        }}
      >
        <div className="flex flex-col items-center gap-6 md:flex-row md:items-start md:gap-8">
          <div className="flex flex-col items-center gap-3">
            <AvatarGlyph hue={identity.hue} glyph={house.glyph} size={112} imageUrl={account?.avatar} />
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => void generateAvatar()}
                disabled={avatarBusy}
                className="hall-tap rounded-full border border-gold-dust/40 px-3 py-1 text-[9px] uppercase tracking-[0.28em] text-gold-dust transition-colors hover:bg-gold-dust/10 disabled:opacity-50"
              >
                {avatarBusy
                  ? lang === "zh"
                    ? "绘制中…"
                    : "Painting…"
                  : account?.avatar
                    ? lang === "zh"
                      ? "重新生成"
                      : "Regenerate"
                    : lang === "zh"
                      ? "AI 绘制我的画像"
                      : "Paint my portrait"}
              </button>
              {account?.avatar ? (
                <button
                  type="button"
                  onClick={() => setAvatar("")}
                  className="hall-tap rounded-full border border-white/10 px-3 py-1 text-[9px] uppercase tracking-[0.28em] text-stone-warm/60 transition-colors hover:border-gold-dust/30 hover:text-gold-dust"
                >
                  {lang === "zh" ? "还原符号" : "Reset glyph"}
                </button>
              ) : null}
            </div>
            {avatarError ? <p className="text-[10px] text-red-300/80">{avatarError}</p> : null}
          </div>
          <div className="flex-1 text-center md:text-left">
            <p className="mb-2 text-[10px] uppercase tracking-[0.42em] text-gold-dust/80">
              {lang === "zh" ? "你的旅者身份" : "Your traveler identity"}
            </p>
            <h2 className="mb-1 font-serif text-2xl italic text-stone-warm sm:text-3xl md:text-4xl">
              {travelerTitle} <span className="text-gold-light">#{identity.number}</span>
            </h2>
            <p className="mb-4 text-xs uppercase tracking-[0.28em] text-gold-dust/70 sm:text-sm sm:tracking-[0.32em]">
              {house.name[li]} · {house.element[li]} {house.glyph}
            </p>
            <p className="font-serif text-base italic text-stone-warm/75 sm:text-lg">
              「{house.motto[li]}」
            </p>
            <p className="mt-3 text-[10px] uppercase tracking-[0.24em] text-stone-warm/40 sm:tracking-[0.28em]">
              {lang === "zh"
                ? "寄信时你将以这个身份出现 —— 依据你的注册信息独一无二生成，与他人不会重复。画像由 AI 依据学院属性绘制，可随时重生。"
                : "This is the identity your letters are signed with — uniquely generated from your account signature. The portrait is painted by AI from your house attributes and can be regenerated anytime."}
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
