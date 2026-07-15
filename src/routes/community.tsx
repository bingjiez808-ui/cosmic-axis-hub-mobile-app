import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import { useAccount } from "@/lib/account";
import { useLang } from "@/lib/i18n";

/**
 * 同门 · Guild of Souls — the community share space.
 * A local-first "magical academy" experience: each visitor is sorted into
 * one of four Houses, given a unique traveler ID and glyph avatar, then
 * offered a small quest board and a share feed for facets of the self.
 * Fully local (no backend) — future upgrade can sync to Lovable Cloud.
 */

export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "Guild of Souls · 同门 — Library of Destiny" },
      {
        name: "description",
        content:
          "A community of travelers through the four traditions — share a facet of your self, take a quest, and find your house. 同门：分享自我，走过闯关，找到你的学院。",
      },
      { property: "og:title", content: "Guild of Souls · 同门" },
      {
        property: "og:description",
        content: "Travelers from many histories, one library — share your true self.",
      },
    ],
  }),
  component: CommunityPage,
});

// ─────────────────────────────────────────────────────────────
// Traveler identity — deterministic house/avatar from a stable seed.

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
    motto: [
      "The slow root outlasts the quick storm.",
      "缓根胜疾风。",
    ] as [string, string],
    element: ["Earth", "土"] as [string, string],
    glyph: "♁",
  },
  {
    key: "aether",
    name: ["House of Aether", "空明学院"] as [string, string],
    tone: ["#4c6b8a", "#9ec4de"],
    motto: [
      "A clear mind is the sharpest blade.",
      "澄心为最锋利之刃。",
    ] as [string, string],
    element: ["Air", "风"] as [string, string],
    glyph: "☿",
  },
  {
    key: "tide",
    name: ["House of Tide", "潮汐学院"] as [string, string],
    tone: ["#3a3f7a", "#7f8fd4"],
    motto: [
      "Depth remembers what the surface forgets.",
      "深处记得表面所遗忘。",
    ] as [string, string],
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
  const houseIdx = h % HOUSES.length;
  const titleIdx = (h >>> 6) % TITLES_EN.length;
  const number = ((h >>> 12) % 8999) + 1000; // 4-digit
  return { houseIdx, titleIdx, number, hue: h % 360 };
}

// ─────────────────────────────────────────────────────────────

type Comment = {
  id: string;
  createdAt: number;
  authorId: string;
  authorTitle: string;
  authorHouseKey: string;
  text: string;
};

type Post = {
  id: string;
  createdAt: number;
  authorId: string;
  authorTitle: string;
  authorHouseKey: string;
  facet: string; // "vocation" | "love" | ...
  text: string;
  hearts: number;
  comments?: Comment[];
};

const FEED_KEY = "lod.community.feed.v1";
const COMMENTS_KEY = "lod.community.comments.v1";
const IDENTITY_KEY = "lod.community.identity.v1";

const FACETS: { key: string; label: [string, string] }[] = [
  { key: "character", label: ["A facet of my character", "性格的一面"] },
  { key: "vocation", label: ["What I do in the world", "我在世界上做的事"] },
  { key: "love", label: ["How I love", "我爱人的方式"] },
  { key: "shadow", label: ["A shadow I'm learning", "我正在学习的阴影"] },
  { key: "gift", label: ["A gift I underestimated", "我低估的天赋"] },
];

const QUESTS: { id: string; label: [string, string]; badge: [string, string] }[] = [
  {
    id: "q1",
    label: [
      "Write one line about the *you* the world doesn't see.",
      "写一句：世界看不到的那个「你」。",
    ],
    badge: ["The Hidden Face", "隐面之勋"],
  },
  {
    id: "q2",
    label: [
      "Name one boundary you will not compromise this year.",
      "写下今年你不愿妥协的一条边界。",
    ],
    badge: ["The Iron Line", "铁线之勋"],
  },
  {
    id: "q3",
    label: [
      "Describe a moment your chart came true — quietly.",
      "描述一次命盘悄悄应验的时刻。",
    ],
    badge: ["The Whisper Witness", "低语见证"],
  },
];

// Seed posts so the feed doesn't feel empty on first visit.
const SEED_POSTS: Post[] = [
  {
    id: "seed-1",
    createdAt: Date.now() - 1000 * 60 * 60 * 8,
    authorId: "traveler-2831",
    authorTitle: "Moon-Reader",
    authorHouseKey: "tide",
    facet: "shadow",
    text: "I keep trying to be useful when I should be honest. My chart wants me to say the hard thing first.",
    hearts: 12,
  },
  {
    id: "seed-2",
    createdAt: Date.now() - 1000 * 60 * 60 * 26,
    authorId: "traveler-4472",
    authorTitle: "守炉人",
    authorHouseKey: "ember",
    facet: "gift",
    text: "我一直以为「太容易的事」不算天赋。今晚才明白，那正是我的火。",
    hearts: 21,
  },
  {
    id: "seed-3",
    createdAt: Date.now() - 1000 * 60 * 60 * 52,
    authorId: "traveler-6019",
    authorTitle: "Silent Archivist",
    authorHouseKey: "aether",
    facet: "vocation",
    text: "I map old libraries for a living. Turns out my 10th house lord is Mercury in the 9th — the chart knew before I did.",
    hearts: 8,
  },
];

// ─────────────────────────────────────────────────────────────

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
          background:
            "radial-gradient(circle at 70% 80%, rgba(255,255,255,0.05), transparent 60%)",
        }}
      />
    </div>
  );
}

function CommunityPage() {
  const { lang } = useLang();
  const li = lang === "zh" ? 1 : 0;
  const { account, setAvatar } = useAccount();
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  // AI quest reflection (challenge companion)
  const [aiReflect, setAiReflect] = useState<Record<string, string>>({});
  const [aiReflectBusy, setAiReflectBusy] = useState<string | null>(null);
  const [aiQuestInput, setAiQuestInput] = useState<Record<string, string>>({});

  // Identity — persisted so the same person always gets the same house/id.
  const identity = useMemo(() => {
    let seed = account?.email || account?.name;
    if (!seed && typeof window !== "undefined") {
      try {
        seed = localStorage.getItem(IDENTITY_KEY) || "";
        if (!seed) {
          seed = `guest-${Math.random().toString(36).slice(2, 10)}`;
          localStorage.setItem(IDENTITY_KEY, seed);
        }
      } catch {}
    }
    return buildIdentity(seed || "wanderer");
  }, [account]);

  const house = HOUSES[identity.houseIdx];
  const travelerTitle = lang === "zh" ? TITLES_ZH[identity.titleIdx] : TITLES_EN[identity.titleIdx];
  const travelerId = `#${identity.number}`;
  const authorTitle = travelerTitle;
  const authorHouseKey = house.key;

  // Feed
  const [posts, setPosts] = useState<Post[]>(SEED_POSTS);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FEED_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Post[];
        if (Array.isArray(parsed) && parsed.length) setPosts([...parsed, ...SEED_POSTS]);
      }
    } catch {}
  }, []);
  const persist = (list: Post[]) => {
    // Only persist non-seed posts.
    const own = list.filter((p) => !p.id.startsWith("seed-"));
    try { localStorage.setItem(FEED_KEY, JSON.stringify(own)); } catch {}
  };

  const [facet, setFacet] = useState<string>(FACETS[0].key);
  const [draft, setDraft] = useState("");
  const [completedQuests, setCompletedQuests] = useState<Record<string, boolean>>({});

  const submit = () => {
    if (!draft.trim()) return;
    const p: Post = {
      id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
      authorId: `traveler-${identity.number}`,
      authorTitle,
      authorHouseKey,
      facet,
      text: draft.trim().slice(0, 500),
      hearts: 0,
    };
    const next = [p, ...posts];
    setPosts(next);
    persist(next);
    setDraft("");
  };

  const heart = (id: string) => {
    setPosts((list) => {
      const next = list.map((p) => (p.id === id ? { ...p, hearts: p.hearts + 1 } : p));
      persist(next);
      return next;
    });
  };

  // (Legacy manual "accept" is replaced by the AI reflection flow below.)

  const generateAvatar = async () => {
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      const r = await fetch("/api/generate-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  const askQuestOracle = async (questId: string, questPrompt: string) => {
    const answer = (aiQuestInput[questId] || "").trim();
    if (!answer) return;
    setAiReflectBusy(questId);
    try {
      const { askOracle } = await import("@/lib/oracle.functions");
      const res = await askOracle({
        data: {
          question:
            (lang === "zh"
              ? `我正在参加「同门闯关」，题目是：${questPrompt}\n我的回答是：${answer}\n请以图书馆智者的口吻，给我一段 120-180 字的、结合我所在的「${house.name[1]}」学院（${house.element[1]}元素）的温柔点评，指出我可以更深地看到自己哪一部分。`
              : `I'm doing a Guild-of-Souls quest. Prompt: ${questPrompt}\nMy answer: ${answer}\nAs the library elder, please give me a 120-180 word warm reflection tuned to my "${house.name[0]}" House (${house.element[0]} element). Point out one deeper thing I can now see about myself.`),
          lang,
        },
      });
      setAiReflect((s) => ({ ...s, [questId]: res.text || "" }));
      setCompletedQuests((c) => ({ ...c, [questId]: true }));
    } catch (e) {
      console.error(e);
      setAiReflect((s) => ({
        ...s,
        [questId]:
          lang === "zh"
            ? "图书馆此刻信号不稳，稍后再试。"
            : "The library signal is unsteady — please try again soon.",
      }));
    } finally {
      setAiReflectBusy(null);
    }
  };

  const facetLabel = (k: string) => FACETS.find((f) => f.key === k)?.label[li] ?? k;
  const houseByKey = (k: string) => HOUSES.find((h) => h.key === k) ?? HOUSES[0];
  const timeAgo = (ts: number) => {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return lang === "zh" ? "刚刚" : "just now";
    if (s < 3600) return lang === "zh" ? `${Math.floor(s / 60)} 分钟前` : `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return lang === "zh" ? `${Math.floor(s / 3600)} 小时前` : `${Math.floor(s / 3600)}h ago`;
    return lang === "zh" ? `${Math.floor(s / 86400)} 天前` : `${Math.floor(s / 86400)}d ago`;
  };

  return (
    <div className="pt-32 pb-32">
      {/* Header */}
      <header className="mx-auto max-w-4xl px-6 pb-16 text-center">
        <p className="mb-4 text-[10px] uppercase tracking-[0.42em] text-gold-dust">
          {lang === "zh" ? "同门 · 众生之厅" : "Guild of Souls"}
        </p>
        <h1 className="mb-6 font-serif text-5xl leading-[1.05] text-stone-warm md:text-7xl">
          {lang === "zh" ? "游客之间，" : "Between travelers,"}
          <br />
          <span className="italic gold-gradient-text">
            {lang === "zh" ? "彼此照亮。" : "we light each other."}
          </span>
        </h1>
        <p className="mx-auto max-w-2xl font-light text-stone-warm/60">
          {lang === "zh"
            ? "不同历史的游客走进这座图书馆，被分到不同的学院。在此分享你的某一面，接受小小的闯关，找到与你共振的同门。"
            : "Travelers from many histories arrive at this library and are sorted into different houses. Share one facet of yourself, take a small quest, and find those who resonate with you."}
        </p>
      </header>

      {/* Identity card */}
      <section className="mx-auto max-w-5xl px-6 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="glass-card overflow-hidden rounded-3xl p-8 md:p-12"
          style={{
            background: `linear-gradient(140deg, ${house.tone[0]}22, transparent 55%), var(--tw-gradient-from, rgba(255,255,255,0.02))`,
          }}
        >
          <div className="flex flex-col items-center gap-6 md:flex-row md:items-start md:gap-8">
            <div className="flex flex-col items-center gap-3">
              <AvatarGlyph
                hue={identity.hue}
                glyph={house.glyph}
                size={112}
                imageUrl={account?.avatar}
              />
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={generateAvatar}
                  disabled={avatarBusy}
                  className="rounded-full border border-gold-dust/40 px-3 py-1 text-[9px] uppercase tracking-[0.28em] text-gold-dust transition-colors hover:bg-gold-dust/10 disabled:opacity-50"
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
                {account?.avatar && (
                  <button
                    type="button"
                    onClick={() => setAvatar("")}
                    className="rounded-full border border-white/10 px-3 py-1 text-[9px] uppercase tracking-[0.28em] text-stone-warm/60 transition-colors hover:border-gold-dust/30 hover:text-gold-dust"
                  >
                    {lang === "zh" ? "还原符号" : "Reset glyph"}
                  </button>
                )}
              </div>
              {avatarError && (
                <p className="text-[10px] text-red-300/80">{avatarError}</p>
              )}
            </div>
            <div className="flex-1 text-center md:text-left">
              <p className="mb-2 text-[10px] uppercase tracking-[0.42em] text-gold-dust/80">
                {lang === "zh" ? "你的旅者身份" : "Your traveler identity"}
              </p>
              <h2 className="mb-1 font-serif text-2xl italic text-stone-warm sm:text-3xl md:text-4xl">
                {travelerTitle} <span className="text-gold-light">{travelerId}</span>
              </h2>
              <p className="mb-4 text-xs uppercase tracking-[0.28em] text-gold-dust/70 sm:text-sm sm:tracking-[0.32em]">
                {house.name[li]} · {house.element[li]} {house.glyph}
              </p>
              <p className="font-serif text-base italic text-stone-warm/75 sm:text-lg">
                「{house.motto[li]}」
              </p>
              <p className="mt-3 text-[10px] uppercase tracking-[0.24em] text-stone-warm/40 sm:tracking-[0.28em]">
                {lang === "zh"
                  ? "该身份根据你的注册信息独一无二生成 —— 与他人不会重复。画像由 AI 依据学院属性绘制，可随时重生。"
                  : "Uniquely generated from your account signature. Portrait is painted by AI from your house attributes — regenerate anytime."}
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Quests */}
      <section className="mx-auto mt-16 max-w-5xl px-6 md:px-12">
        <div className="mb-6 flex items-baseline justify-between">
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-[0.4em] text-gold-dust">
              {lang === "zh" ? "小小闯关" : "Small quests"}
            </p>
            <h3 className="font-serif text-2xl italic text-stone-warm md:text-3xl">
              {lang === "zh" ? "越过一关，认识多一点自己。" : "Cross one threshold — know yourself a little more."}
            </h3>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          {QUESTS.map((q, i) => {
            const done = completedQuests[q.id];
            const reflection = aiReflect[q.id];
            const isBusy = aiReflectBusy === q.id;
            return (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.08 }}
                className={`glass-card grid grid-cols-1 gap-5 rounded-2xl p-5 sm:p-6 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)] md:gap-8 ${done ? "border-gold-dust/60" : ""}`}
              >
                {/* Left · prompt + badge */}
                <div className="flex min-w-0 flex-col justify-between gap-4">
                  <div>
                    <p className="mb-3 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                      {lang === "zh" ? `第 ${i + 1} 关` : `Quest ${i + 1}`}
                    </p>
                    <p className="font-serif text-base leading-relaxed text-stone-warm/85 sm:text-lg">
                      {q.label[li]}
                    </p>
                  </div>
                  <span
                    className={`inline-flex w-fit rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.28em] ${
                      done
                        ? "border-gold-dust/60 bg-gold-dust/10 text-gold-light"
                        : "border-white/10 text-stone-warm/40"
                    }`}
                  >
                    {done ? `✓ ${q.badge[li]}` : q.badge[li]}
                  </span>
                </div>

                {/* Right · input + reflection */}
                <div className="flex min-w-0 flex-col">
                  <textarea
                    value={aiQuestInput[q.id] ?? ""}
                    onChange={(e) =>
                      setAiQuestInput((s) => ({ ...s, [q.id]: e.target.value.slice(0, 400) }))
                    }
                    rows={3}
                    placeholder={
                      lang === "zh"
                        ? "写下你的回答，AI 智者会为你点评…"
                        : "Write your answer — the elder will reflect back…"
                    }
                    className="w-full resize-none rounded-xl border border-white/10 bg-obsidian/40 p-3 text-sm text-stone-warm placeholder:text-stone-warm/30 focus:border-gold-dust/40 focus:outline-none"
                  />
                  <div className="mt-3 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => askQuestOracle(q.id, q.label[li])}
                      disabled={isBusy || !(aiQuestInput[q.id] || "").trim()}
                      className="rounded-full border border-gold-dust/40 px-4 py-1.5 text-[10px] uppercase tracking-[0.28em] text-gold-dust transition-colors hover:bg-gold-dust/10 disabled:opacity-40"
                    >
                      {isBusy
                        ? lang === "zh" ? "智者沉思…" : "Reflecting…"
                        : done
                          ? lang === "zh" ? "再问一次" : "Ask again"
                          : lang === "zh" ? "呈上答卷" : "Submit"}
                    </button>
                  </div>
                  {reflection && (
                    <div className="mt-4 rounded-xl border border-gold-dust/25 bg-gold-dust/[0.05] p-4">
                      <p className="mb-1 text-[9px] uppercase tracking-[0.32em] text-gold-dust/70">
                        {lang === "zh" ? "智者回音" : "The elder replies"}
                      </p>
                      <p className="whitespace-pre-line font-serif text-sm italic leading-relaxed text-stone-warm/85">
                        {reflection}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Share composer + feed */}
      <section className="mx-auto mt-16 max-w-5xl px-6 md:px-12">
        <div className="mb-6">
          <p className="mb-2 text-[10px] uppercase tracking-[0.4em] text-gold-dust">
            {lang === "zh" ? "分享 · 星火壁" : "Share · the ember wall"}
          </p>
          <h3 className="font-serif text-2xl italic text-stone-warm md:text-3xl">
            {lang === "zh" ? "把你的一面放在墙上。" : "Pin one facet of you to the wall."}
          </h3>
        </div>

        <div className="glass-card mb-8 rounded-3xl p-6 md:p-8">
          <div className="mb-4 flex flex-wrap gap-2">
            {FACETS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFacet(f.key)}
                className={`rounded-full border px-4 py-1.5 text-[10px] uppercase tracking-[0.28em] transition-colors ${
                  facet === f.key
                    ? "border-gold-dust bg-gold-dust/10 text-gold-light"
                    : "border-white/10 text-stone-warm/60 hover:border-gold-dust/40 hover:text-gold-dust"
                }`}
              >
                {f.label[li]}
              </button>
            ))}
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 500))}
            rows={3}
            placeholder={
              lang === "zh"
                ? "用一两句话，说出这一面的你 —— 世界值得听。"
                : "In one or two lines, name this facet of you — the world deserves it."
            }
            className="w-full resize-none rounded-2xl border border-white/10 bg-obsidian/40 p-4 text-sm text-stone-warm placeholder:text-stone-warm/30 focus:border-gold-dust/40 focus:outline-none"
          />
          <div className="mt-3 flex items-center justify-between text-[11px] text-stone-warm/40">
            <span>
              {lang === "zh"
                ? `以「${travelerTitle} ${travelerId}」· ${house.name[li]} 之名发布`
                : `Posting as ${travelerTitle} ${travelerId} · ${house.name[li]}`}
            </span>
            <button
              type="button"
              onClick={submit}
              disabled={!draft.trim()}
              className="rounded-full bg-gold-dust px-6 py-2 text-[10px] uppercase tracking-[0.32em] text-obsidian transition-colors hover:bg-gold-light disabled:bg-gold-dust/40 disabled:text-obsidian/40"
            >
              {lang === "zh" ? "点亮 · 发布" : "Light · Post"}
            </button>
          </div>
        </div>

        {/* Feed */}
        <div className="space-y-4">
          {posts.map((p) => {
            const h = houseByKey(p.authorHouseKey);
            const authorSeed = p.authorId;
            const authorId = buildIdentity(authorSeed);
            return (
              <motion.article
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="glass-card flex gap-4 rounded-2xl p-5"
              >
                <AvatarGlyph hue={authorId.hue} glyph={h.glyph} size={56} />
                <div className="flex-1">
                  <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-serif text-lg italic text-stone-warm">
                      {p.authorTitle}
                    </span>
                    <span className="text-gold-light">#{authorId.number}</span>
                    <span className="text-[10px] uppercase tracking-[0.28em] text-gold-dust/70">
                      {h.name[li]}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.24em] text-stone-warm/40">
                      · {facetLabel(p.facet)} · {timeAgo(p.createdAt)}
                    </span>
                  </div>
                  <p className="font-serif text-base leading-relaxed text-stone-warm/85">
                    {p.text}
                  </p>
                  <div className="mt-3 flex items-center gap-4 text-[11px] text-stone-warm/50">
                    <button
                      type="button"
                      onClick={() => heart(p.id)}
                      className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 uppercase tracking-[0.28em] transition-colors hover:border-gold-dust/40 hover:text-gold-dust"
                    >
                      <span aria-hidden>✦</span>
                      <span>{p.hearts}</span>
                    </button>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
