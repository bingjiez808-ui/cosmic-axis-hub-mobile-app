import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import { useAccount } from "@/lib/account";
import { useLang } from "@/lib/i18n";
import { useSupabaseSession } from "@/lib/session";

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
  hearts?: number;
  parentId?: string; // replying to another comment
};

type Notif = {
  id: string;
  createdAt: number;
  kind: "heart" | "comment" | "reply" | "heart-comment";
  postId: string;
  commentId?: string;
  actorTitle: string;
  actorHouseKey: string;
  actorHue: number;
  snippet: string;
  read: boolean;
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
const NOTIFS_KEY = "lod.community.notifs.v1";
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
    comments: [
      {
        id: "sc-1a",
        createdAt: Date.now() - 1000 * 60 * 60 * 6,
        authorId: "traveler-5501",
        authorTitle: "Candle-Bearer",
        authorHouseKey: "ember",
        text: "This resonates. Honesty is the useful thing — the rest is just noise dressed as service.",
      },
    ],
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
    comments: [
      {
        id: "sc-2a",
        createdAt: Date.now() - 1000 * 60 * 60 * 20,
        authorId: "traveler-3120",
        authorTitle: "根之歌者",
        authorHouseKey: "loam",
        text: "同门共鸣。别小看流畅的事 —— 那是你与世界之间最短的路。",
      },
      {
        id: "sc-2b",
        createdAt: Date.now() - 1000 * 60 * 60 * 12,
        authorId: "traveler-7788",
        authorTitle: "Star-Scribe",
        authorHouseKey: "aether",
        text: "把「容易」当作天赋的入口，收下。",
      },
    ],
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
    comments: [],
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
  const { session, loading: sessionLoading } = useSupabaseSession();
  const li = lang === "zh" ? 1 : 0;
  const { account, setAvatar } = useAccount();
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  // AI quest reflection (challenge companion)
  const [aiReflect, setAiReflect] = useState<Record<string, string>>({});
  const [aiReflectBusy, setAiReflectBusy] = useState<string | null>(null);
  const [aiQuestInput, setAiQuestInput] = useState<Record<string, string>>({});

  // Identity — persisted so the same person always gets the same house/id.
  // Both SSR and the first client render use the fixed "wanderer" seed so
  // hydration matches; the real seed (account email / persisted guest id)
  // is applied after mount to avoid mismatches with browser-only state.
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
  const travelerId = `#${identity.number}`;
  const authorTitle = travelerTitle;
  const authorHouseKey = house.key;

  // Feed
  const [posts, setPosts] = useState<Post[]>(SEED_POSTS);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FEED_KEY);
      let base: Post[] = SEED_POSTS;
      if (raw) {
        const parsed = JSON.parse(raw) as Post[];
        if (Array.isArray(parsed) && parsed.length) base = [...parsed, ...SEED_POSTS];
      }
      // Merge extra comments from localStorage keyed per postId.
      const rawC = localStorage.getItem(COMMENTS_KEY);
      if (rawC) {
        const cmap = JSON.parse(rawC) as Record<string, Comment[]>;
        base = base.map((p) => {
          const extra = cmap[p.id];
          if (!extra || !extra.length) return p;
          return { ...p, comments: [...(p.comments ?? []), ...extra] };
        });
      }
      setPosts(base);
    } catch {}
  }, []);
  const persist = (list: Post[]) => {
    // Only persist non-seed posts.
    const own = list.filter((p) => !p.id.startsWith("seed-"));
    try { localStorage.setItem(FEED_KEY, JSON.stringify(own)); } catch {}
  };
  const persistComments = (list: Post[]) => {
    // Persist ONLY user-added comments (skip seed ones by id prefix "sc-").
    const cmap: Record<string, Comment[]> = {};
    for (const p of list) {
      const extra = (p.comments ?? []).filter((c) => !c.id.startsWith("sc-"));
      if (extra.length) cmap[p.id] = extra;
    }
    try { localStorage.setItem(COMMENTS_KEY, JSON.stringify(cmap)); } catch {}
  };

  const [facet, setFacet] = useState<string>(FACETS[0].key);
  const [draft, setDraft] = useState("");
  const [completedQuests, setCompletedQuests] = useState<Record<string, boolean>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [replyOpen, setReplyOpen] = useState<Record<string, boolean>>({});

  // Notifications
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(NOTIFS_KEY);
      if (raw) setNotifs(JSON.parse(raw) as Notif[]);
    } catch {}
  }, []);
  const persistNotifs = (list: Notif[]) => {
    try {
      localStorage.setItem(NOTIFS_KEY, JSON.stringify(list.slice(0, 60)));
    } catch {}
  };
  const pushNotif = (n: Omit<Notif, "id" | "createdAt" | "read">) => {
    setNotifs((list) => {
      const next: Notif[] = [
        {
          ...n,
          id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          createdAt: Date.now(),
          read: false,
        },
        ...list,
      ].slice(0, 60);
      persistNotifs(next);
      return next;
    });
  };
  const unreadCount = notifs.filter((n) => !n.read).length;
  const markAllRead = () => {
    setNotifs((list) => {
      const next = list.map((n) => ({ ...n, read: true }));
      persistNotifs(next);
      return next;
    });
  };

  const myAuthorId = `traveler-${identity.number}`;

  // Simulate an ambient echo (like/reply from another traveler) targeting user's content
  const AMBIENT_AUTHORS: { title: [string, string]; houseKey: string; seed: string }[] = [
    { title: ["Star-Scribe", "星辰记事者"], houseKey: "aether", seed: "amb-1201" },
    { title: ["Ember-Kin", "近火者"], houseKey: "ember", seed: "amb-4402" },
    { title: ["Tide-Listener", "听潮者"], houseKey: "tide", seed: "amb-7713" },
    { title: ["Root-Singer", "根之歌者"], houseKey: "loam", seed: "amb-3355" },
  ];
  const AMBIENT_REPLIES: [string, string][] = [
    ["This resonates with me.", "这段话与我共振。"],
    ["I feel this — thank you for naming it.", "我感受到了 —— 谢谢你把它说出来。"],
    ["Softly holding this with you.", "轻轻地与你一同承接这句话。"],
    ["The library heard you.", "图书馆听见你了。"],
  ];
  const scheduleAmbientEcho = (postId: string, targetKind: "post" | "comment", commentId?: string) => {
    const delay = 2600 + Math.floor(Math.random() * 4400);
    window.setTimeout(() => {
      const author = AMBIENT_AUTHORS[Math.floor(Math.random() * AMBIENT_AUTHORS.length)];
      const ident = buildIdentity(author.seed);
      const actorTitle = lang === "zh" ? author.title[1] : author.title[0];
      // 55% -> heart, 45% -> reply
      const isHeart = Math.random() < 0.55;
      if (isHeart) {
        if (targetKind === "post") {
          setPosts((list) => {
            const next = list.map((p) => (p.id === postId ? { ...p, hearts: p.hearts + 1 } : p));
            persist(next);
            return next;
          });
          pushNotif({
            kind: "heart",
            postId,
            actorTitle,
            actorHouseKey: author.houseKey,
            actorHue: ident.hue,
            snippet: lang === "zh" ? "点亮了你的分享" : "lit your share",
          });
        } else if (commentId) {
          setPosts((list) => {
            const next = list.map((p) =>
              p.id !== postId
                ? p
                : {
                    ...p,
                    comments: (p.comments ?? []).map((c) =>
                      c.id === commentId ? { ...c, hearts: (c.hearts ?? 0) + 1 } : c,
                    ),
                  },
            );
            persistComments(next);
            return next;
          });
          pushNotif({
            kind: "heart-comment",
            postId,
            commentId,
            actorTitle,
            actorHouseKey: author.houseKey,
            actorHue: ident.hue,
            snippet: lang === "zh" ? "点亮了你的回声" : "lit your echo",
          });
        }
      } else {
        const line = AMBIENT_REPLIES[Math.floor(Math.random() * AMBIENT_REPLIES.length)];
        const text = lang === "zh" ? line[1] : line[0];
        const newComment: Comment = {
          id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          createdAt: Date.now(),
          authorId: author.seed,
          authorTitle,
          authorHouseKey: author.houseKey,
          text,
          hearts: 0,
          parentId: targetKind === "comment" ? commentId : undefined,
        };
        setPosts((list) => {
          const next = list.map((p) =>
            p.id === postId ? { ...p, comments: [...(p.comments ?? []), newComment] } : p,
          );
          persistComments(next);
          return next;
        });
        setOpenComments((s) => ({ ...s, [postId]: true }));
        pushNotif({
          kind: targetKind === "comment" ? "reply" : "comment",
          postId,
          commentId: newComment.id,
          actorTitle,
          actorHouseKey: author.houseKey,
          actorHue: ident.hue,
          snippet: text,
        });
      }
    }, delay);
  };

  const submit = () => {
    if (!draft.trim()) return;
    const p: Post = {
      id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
      authorId: myAuthorId,
      authorTitle,
      authorHouseKey,
      facet,
      text: draft.trim().slice(0, 500),
      hearts: 0,
      comments: [],
    };
    const next = [p, ...posts];
    setPosts(next);
    persist(next);
    setDraft("");
    // Simulate ambient reception
    scheduleAmbientEcho(p.id, "post");
  };

  const heart = (id: string) => {
    setPosts((list) => {
      const next = list.map((p) => (p.id === id ? { ...p, hearts: p.hearts + 1 } : p));
      persist(next);
      return next;
    });
  };

  const heartComment = (postId: string, commentId: string) => {
    setPosts((list) => {
      const next = list.map((p) =>
        p.id !== postId
          ? p
          : {
              ...p,
              comments: (p.comments ?? []).map((c) =>
                c.id === commentId ? { ...c, hearts: (c.hearts ?? 0) + 1 } : c,
              ),
            },
      );
      persistComments(next);
      return next;
    });
  };

  const submitComment = (postId: string, parentId?: string) => {
    const draftKey = parentId ? `${postId}:${parentId}` : postId;
    const src = parentId ? replyDraft : commentDraft;
    const setSrc = parentId ? setReplyDraft : setCommentDraft;
    const text = (src[draftKey] || "").trim();
    if (!text) return;
    const c: Comment = {
      id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
      authorId: myAuthorId,
      authorTitle,
      authorHouseKey,
      text: text.slice(0, 280),
      hearts: 0,
      parentId,
    };
    setPosts((list) => {
      const next = list.map((p) =>
        p.id === postId ? { ...p, comments: [...(p.comments ?? []), c] } : p,
      );
      persistComments(next);
      return next;
    });
    setSrc((s) => ({ ...s, [draftKey]: "" }));
    setOpenComments((s) => ({ ...s, [postId]: true }));
    if (parentId) setReplyOpen((s) => ({ ...s, [`${postId}:${parentId}`]: false }));
    // Ambient echo back on the user's comment/reply
    scheduleAmbientEcho(postId, "comment", c.id);
  };




  // (Legacy manual "accept" is replaced by the AI reflection flow below.)

  const generateAvatar = async () => {
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setAvatarError(
          lang === "zh" ? "请先登录后再生成画像。" : "Please sign in to generate a portrait.",
        );
        return;
      }
      const r = await fetch("/api/generate-avatar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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
          feature: "general",
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
      {/* Notification bell — floating, mobile-friendly */}
      <div className="fixed right-4 top-24 z-40 md:right-8">
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              const next = !notifOpen;
              setNotifOpen(next);
              if (next && unreadCount > 0) markAllRead();
            }}
            aria-label={lang === "zh" ? "通知" : "Notifications"}
            aria-expanded={notifOpen}
            className="glass-card flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-stone-warm/80 backdrop-blur transition-colors hover:border-gold-dust/40 hover:text-gold-dust"
          >
            <span aria-hidden className="text-lg">✧</span>
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gold-dust px-1 text-[10px] font-medium text-obsidian">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <div
              role="dialog"
              className="glass-card absolute right-0 mt-2 w-[min(88vw,340px)] overflow-hidden rounded-2xl border border-white/10 backdrop-blur"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
                <span className="text-[10px] uppercase tracking-[0.32em] text-gold-dust">
                  {lang === "zh" ? "回声 · 通知" : "Echoes · Inbox"}
                </span>
                <button
                  type="button"
                  onClick={() => setNotifOpen(false)}
                  className="text-[11px] text-stone-warm/50 hover:text-gold-dust"
                >
                  ✕
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {notifs.length === 0 ? (
                  <p className="px-4 py-6 text-center text-[12px] text-stone-warm/50">
                    {lang === "zh"
                      ? "尚无回声。你的分享会先被听见。"
                      : "No echoes yet. Your voice will be heard first."}
                  </p>
                ) : (
                  <ul className="divide-y divide-white/5">
                    {notifs.map((n) => {
                      const nh = houseByKey(n.actorHouseKey);
                      const kindLabel =
                        n.kind === "heart"
                          ? lang === "zh" ? "点亮分享" : "lit your share"
                          : n.kind === "heart-comment"
                            ? lang === "zh" ? "点亮回声" : "lit your echo"
                            : n.kind === "reply"
                              ? lang === "zh" ? "回复了你" : "replied to you"
                              : lang === "zh" ? "回应了你" : "echoed you";
                      return (
                        <li key={n.id} className="flex gap-2.5 px-4 py-3">
                          <AvatarGlyph hue={n.actorHue} glyph={nh.glyph} size={28} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-x-2 text-[10px] uppercase tracking-[0.24em] text-stone-warm/50">
                              <span className="font-serif text-[13px] italic normal-case tracking-normal text-stone-warm/90">
                                {n.actorTitle}
                              </span>
                              <span className="text-gold-dust/70">{kindLabel}</span>
                              <span className="text-stone-warm/40">· {timeAgo(n.createdAt)}</span>
                            </div>
                            {n.snippet && (
                              <p className="mt-0.5 line-clamp-2 font-serif text-[12.5px] leading-relaxed text-stone-warm/70">
                                {n.snippet}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

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

      {/* Gentle sign-in nudge for anonymous travelers */}
      {!sessionLoading && !session && (
        <div className="mx-auto mb-10 max-w-3xl px-6 md:px-12">
          <div className="glass-card flex flex-col items-start gap-3 rounded-2xl px-5 py-4 text-left sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs italic leading-relaxed text-stone-warm/70">
              {lang === "zh"
                ? "你目前以匿名游客的身份进入 —— 分享与回声都保存在本地。登录后可跨设备保留身份，并生成专属画像。"
                : "You are here as an anonymous traveler — your shares and echoes stay on this device. Sign in to keep your identity across devices and generate a portrait."}
            </p>
            <a
              href="/auth"
              className="flex-none whitespace-nowrap rounded-full border border-gold-dust/40 px-4 py-2 text-[10px] uppercase tracking-[0.28em] text-gold-dust transition-colors hover:bg-gold-dust/10"
            >
              {lang === "zh" ? "登录" : "Sign in"}
            </a>
          </div>
        </div>
      )}



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
                className="glass-card flex gap-3 rounded-2xl p-4 sm:gap-4 sm:p-5"
              >
                <AvatarGlyph hue={authorId.hue} glyph={h.glyph} size={56} />
                <div className="min-w-0 flex-1">
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
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-stone-warm/50 sm:gap-4">
                    <button
                      type="button"
                      onClick={() => heart(p.id)}
                      className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 uppercase tracking-[0.28em] transition-colors hover:border-gold-dust/40 hover:text-gold-dust active:scale-95"
                    >
                      <span aria-hidden>✦</span>
                      <span>{p.hearts}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setOpenComments((s) => ({ ...s, [p.id]: !s[p.id] }))
                      }
                      aria-expanded={!!openComments[p.id]}
                      className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 uppercase tracking-[0.28em] transition-colors hover:border-gold-dust/40 hover:text-gold-dust active:scale-95"
                    >
                      <span aria-hidden>❋</span>
                      <span>
                        {lang === "zh" ? "回声" : "Echoes"} · {(p.comments ?? []).length}
                      </span>
                      <span aria-hidden className="text-[9px]">
                        {openComments[p.id] ? "▲" : "▼"}
                      </span>
                    </button>
                  </div>

                  {/* Comments — threaded (top-level + replies) */}
                  {(p.comments ?? []).length > 0 && (
                    <div className="mt-3 border-l border-gold-dust/20 pl-3 sm:pl-4">
                      {(() => {
                        const all = p.comments ?? [];
                        const topLevel = all.filter((c) => !c.parentId);
                        const repliesByParent = all.reduce<Record<string, Comment[]>>((acc, c) => {
                          if (c.parentId) {
                            (acc[c.parentId] ||= []).push(c);
                          }
                          return acc;
                        }, {});
                        const isOpen = !!openComments[p.id];
                        const visibleTop = isOpen ? topLevel : topLevel.slice(-1);
                        const hiddenTop = topLevel.length - visibleTop.length;

                        const renderComment = (c: Comment, depth = 0) => {
                          const ch = houseByKey(c.authorHouseKey);
                          const cid = buildIdentity(c.authorId);
                          const replyKey = `${p.id}:${c.id}`;
                          const replies = repliesByParent[c.id] ?? [];
                          const showReply = !!replyOpen[replyKey];
                          return (
                            <li key={c.id} className="flex gap-2 sm:gap-2.5">
                              <AvatarGlyph hue={cid.hue} glyph={ch.glyph} size={depth > 0 ? 24 : 28} />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-baseline gap-x-2 text-[10px] uppercase tracking-[0.24em] text-stone-warm/50">
                                  <span className="font-serif text-[13px] italic normal-case tracking-normal text-stone-warm/90">
                                    {c.authorTitle}
                                  </span>
                                  <span className="text-gold-light">#{cid.number}</span>
                                  <span className="text-gold-dust/60">{ch.name[li]}</span>
                                  <span className="text-stone-warm/40">· {timeAgo(c.createdAt)}</span>
                                </div>
                                <p className="mt-0.5 font-serif text-[13.5px] leading-relaxed text-stone-warm/80">
                                  {c.text}
                                </p>
                                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-stone-warm/45">
                                  <button
                                    type="button"
                                    onClick={() => heartComment(p.id, c.id)}
                                    className="flex items-center gap-1 rounded-full border border-white/5 px-2 py-1 transition-colors hover:border-gold-dust/40 hover:text-gold-dust active:scale-95"
                                  >
                                    <span aria-hidden>✦</span>
                                    <span>{c.hearts ?? 0}</span>
                                  </button>
                                  {depth === 0 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setReplyOpen((s) => ({ ...s, [replyKey]: !s[replyKey] }))
                                      }
                                      aria-expanded={showReply}
                                      className="rounded-full border border-white/5 px-2 py-1 transition-colors hover:border-gold-dust/40 hover:text-gold-dust active:scale-95"
                                    >
                                      {lang === "zh" ? "回复" : "Reply"}
                                    </button>
                                  )}
                                </div>

                                {depth === 0 && replies.length > 0 && (
                                  <ul className="mt-2 space-y-2 border-l border-gold-dust/10 pl-2 sm:pl-3">
                                    {replies.map((r) => renderComment(r, 1))}
                                  </ul>
                                )}

                                {depth === 0 && showReply && (
                                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start">
                                    <textarea
                                      value={replyDraft[replyKey] ?? ""}
                                      onChange={(e) =>
                                        setReplyDraft((s) => ({
                                          ...s,
                                          [replyKey]: e.target.value.slice(0, 280),
                                        }))
                                      }
                                      rows={2}
                                      placeholder={
                                        lang === "zh"
                                          ? `回复 ${c.authorTitle}…`
                                          : `Reply to ${c.authorTitle}…`
                                      }
                                      className="min-h-[44px] w-full resize-none rounded-xl border border-white/10 bg-obsidian/40 px-3 py-2 text-[13px] text-stone-warm placeholder:text-stone-warm/30 focus:border-gold-dust/40 focus:outline-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => submitComment(p.id, c.id)}
                                      disabled={!(replyDraft[replyKey] || "").trim()}
                                      className="shrink-0 rounded-full border border-gold-dust/40 px-3 py-2 text-[10px] uppercase tracking-[0.28em] text-gold-dust transition-colors hover:bg-gold-dust/10 disabled:opacity-40 sm:py-1.5"
                                    >
                                      {lang === "zh" ? "回复" : "Reply"}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </li>
                          );
                        };

                        return (
                          <>
                            {!isOpen && hiddenTop > 0 && (
                              <button
                                type="button"
                                onClick={() => setOpenComments((s) => ({ ...s, [p.id]: true }))}
                                className="mb-2 text-[10px] uppercase tracking-[0.28em] text-gold-dust/70 transition-colors hover:text-gold-dust"
                              >
                                {lang === "zh"
                                  ? `展开另 ${hiddenTop} 条回声 ▾`
                                  : `Show ${hiddenTop} more echo${hiddenTop > 1 ? "es" : ""} ▾`}
                              </button>
                            )}
                            <ul className="space-y-3">
                              {visibleTop.map((c) => renderComment(c, 0))}
                            </ul>
                            {isOpen && topLevel.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setOpenComments((s) => ({ ...s, [p.id]: false }))}
                                className="mt-2 text-[10px] uppercase tracking-[0.28em] text-stone-warm/50 transition-colors hover:text-gold-dust"
                              >
                                {lang === "zh" ? "收起 ▴" : "Collapse ▴"}
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {/* Top-level echo composer */}
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
                    <textarea
                      value={commentDraft[p.id] ?? ""}
                      onChange={(e) =>
                        setCommentDraft((s) => ({
                          ...s,
                          [p.id]: e.target.value.slice(0, 280),
                        }))
                      }
                      rows={2}
                      placeholder={
                        lang === "zh"
                          ? "在此留下你的回声…"
                          : "Leave an echo…"
                      }
                      className="min-h-[44px] w-full resize-none rounded-xl border border-white/10 bg-obsidian/40 px-3 py-2 text-[13px] text-stone-warm placeholder:text-stone-warm/30 focus:border-gold-dust/40 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => submitComment(p.id)}
                      disabled={!(commentDraft[p.id] || "").trim()}
                      className="shrink-0 rounded-full border border-gold-dust/40 px-4 py-2 text-[10px] uppercase tracking-[0.28em] text-gold-dust transition-colors hover:bg-gold-dust/10 disabled:opacity-40 sm:py-1.5"
                    >
                      {lang === "zh" ? "回声" : "Echo"}
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
