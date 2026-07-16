import { createFileRoute, Link } from "@tanstack/react-router";


import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Library of Destiny · 关于命运图书馆" },
      {
        name: "description",
        content:
          "How the library reads four traditions at once, and how it treats fate — as pattern, not sentence. 四种传统同时诵读，把命运当作模式而非判决。",
      },
      { property: "og:title", content: "About — Library of Destiny" },
      {
        property: "og:description",
        content: "Four civilizations, one question, and the ethics of reading a life.",
      },
    ],
  }),
  component: AboutPage,
});

type Copy = {
  kicker: string;
  h1a: string;
  h1b: string;
  p1: string;
  p2: string;
  p3: string;
  cards: { k: string; v: string }[];
};

const EN: Copy = {
  kicker: "The library",
  h1a: "A reading that ",
  h1b: "refuses to shout.",
  p1: "The Library of Destiny does not aim to tell your future. It aims to describe your pattern. It does that by reading you in four languages at once — the Hellenistic zodiac, the Vedic Nakshatras, the Chinese Four Pillars, and the Purple Star.",
  p2: "Each of these traditions took centuries to develop. Each one is internally coherent. Where they agree, the library gives a strong reading. Where they disagree, the library says so — and asks you to hold the tension rather than resolve it prematurely.",
  p3: "Fate here is written in the language of “tends to”, “more likely”, and “worthy of attention.” Anything more definite would be a story pretending to be a certainty.",
  cards: [
    { k: "Not prediction", v: "The library does not tell you what will happen. It tells you what patterns are already at work." },
    { k: "Not absolute", v: "No conclusion is stated without a confidence rating and the traditions that support it." },
    { k: "Not a substitute", v: "The reading is a companion to reflection — not a replacement for medical, legal or financial counsel." },
  ],
};

const ZH: Copy = {
  kicker: "关于图书馆",
  h1a: "一份不喧哗的",
  h1b: "解读。",
  p1: "命运图书馆并不试图预告未来，而是描述你身上的模式。它同时以四种语言诵读你 —— 希腊化的黄道十二宫、印度吠陀的二十七宿、中国的四柱八字，以及紫微斗数。",
  p2: "四种传统各自沉淀了数百年，每一种在其内部都是自洽的。当它们意见一致，图书馆给出强解读；当它们意见分歧，图书馆会诚实地说出来 —— 邀请你与这份张力共处，而不是急着消解它。",
  p3: "此处的「命运」，被写成「倾向」「更可能」「值得留意」。任何比这更斩钉截铁的语句，都是把故事伪装成定论。",
  cards: [
    { k: "不是预言", v: "图书馆不告诉你会发生什么，只告诉你哪些模式已经在运作。" },
    { k: "不是绝对", v: "任何结论都会附上置信度，以及支持它的传统与依据。" },
    { k: "不是替代", v: "这份解读是反思的同伴 —— 不能替代医疗、法律或财务咨询。" },
  ],
};

function AboutPage() {
  const { lang } = useLang();
  const c = lang === "zh" ? ZH : EN;
  return (
    <div className="mx-auto max-w-3xl px-6 pt-32 pb-32">
      <p className="mb-4 text-[10px] uppercase tracking-[0.42em] text-gold-dust">{c.kicker}</p>
      <h1 className="mb-10 font-serif text-5xl leading-[1.05] text-stone-warm md:text-6xl">
        {c.h1a}<span className="italic gold-gradient-text">{c.h1b}</span>
      </h1>
      <div className="space-y-8 font-serif text-lg leading-relaxed text-stone-warm/80">
        <p>{c.p1}</p>
        <p>{c.p2}</p>
        <p className="italic text-stone-warm/70">{c.p3}</p>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
        {c.cards.map((card) => (
          <div key={card.k} className="glass-card rounded-2xl p-6">
            <p className="mb-3 text-[10px] uppercase tracking-[0.32em] text-gold-dust">{card.k}</p>
            <p className="text-sm text-stone-warm/70">{card.v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
