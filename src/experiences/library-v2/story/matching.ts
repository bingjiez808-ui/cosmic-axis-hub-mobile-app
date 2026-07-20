/**
 * Guided Library V2 · Story chain — deterministic matching rules.
 *
 * Never surfaces raw chart data. Never uses a probability score. Never
 * matches on "same fate". Only surfaces figures/notes that faced a
 * *similar problem* at a comparable life stage, with the same or
 * complementary topic.
 */
import { FIGURES } from "./fixtures";
import type {
  AgeBand,
  FocusChoice,
  HistoricalFigure,
  HistoryFilter,
  Note,
  ReaderProfile,
  RecommendedItem,
  StoryTopic,
} from "./types";
import { BOOKS } from "./fixtures";

const AGE_ORDER: AgeBand[] = [
  "18-24",
  "25-29",
  "30-34",
  "35-39",
  "40-49",
  "50+",
];

function ageDistance(a: AgeBand | null, b: AgeBand): number {
  if (!a) return 3;
  return Math.abs(AGE_ORDER.indexOf(a) - AGE_ORDER.indexOf(b));
}

export function matchFigures(
  profile: ReaderProfile,
  filter: HistoryFilter,
): HistoricalFigure[] {
  const topic = profile.topic;
  const items = FIGURES.filter((f) => {
    if (filter === "east") return f.tradition === "east";
    if (filter === "west") return f.tradition === "west";
    if (filter === "different_choice") return f.different_choice === true;
    return true;
  });
  const scored = items.map((f) => {
    // Overview / no-topic readers get equal treatment across all topics —
    // no career/love/wealth bias is introduced by the topic axis.
    const topicMatch =
      !topic || topic === "overview"
        ? 0
        : f.topics.includes(topic)
          ? 0
          : 1;
    const ageGap = ageDistance(profile.age_band, f.age_band);
    // Deterministic tie-breaker by id length + first char code so tests are stable
    const stable = f.id.length + f.id.charCodeAt(0) * 0.001;
    return { f, score: topicMatch * 10 + ageGap + stable };
  });
  scored.sort((a, b) => a.score - b.score);
  return scored.map((s) => s.f);
}

/**
 * Abstract traits assigned to a note's author on the server. Never
 * derived from raw chart fields — only from the note's own topic +
 * audience selection + coarse age band.
 */
export function noteTraitsFor(
  topic: StoryTopic,
  audience: Note["audience"],
  ageBand: AgeBand | null,
): string[] {
  const out: string[] = [];
  if (audience === "similar") out.push("人生阶段相近");
  if (audience === "opposite") out.push("互补视角");
  if (audience === "experienced") out.push("走过这段的人");
  if (audience === "librarian") out.push("图书馆推荐");
  if (topic === "career") out.push("责任模式相似");
  if (topic === "love") out.push("关系需求相似");
  if (topic === "wealth") out.push("资源节奏相似");
  if (topic === "recent") out.push("正在整理生活");
  if (ageBand && (ageBand === "30-34" || ageBand === "35-39"))
    out.push("身份切换期");
  return Array.from(new Set(out)).slice(0, 3);
}

export function matchNotes(
  notes: Note[],
  profile: ReaderProfile,
): Note[] {
  const list = notes.filter(
    (n) => n.status === "active" && n.deleted_at === null,
  );
  const topic = profile.topic;
  list.sort((a, b) => {
    const aTopic = topic && a.topic === topic ? 0 : 1;
    const bTopic = topic && b.topic === topic ? 0 : 1;
    if (aTopic !== bTopic) return aTopic - bTopic;
    return b.created_at - a.created_at;
  });
  return list;
}

export function recommendNext(
  profile: ReaderProfile,
  readBookRefs: string[],
  feedbackWeights: Partial<Record<StoryTopic, number>> = {},
): RecommendedItem[] {
  const topic = profile.topic ?? "recent";
  const rec: RecommendedItem[] = [];
  // Feedback weights nudge candidate book ordering. Positive weight for
  // the picked topic keeps its book on top; a strongly-negative weight
  // ("不太像") demotes it in favour of neighbours.
  const scored = BOOKS.filter((b) => !readBookRefs.includes(b.ref)).map((b) => {
    const primary = b.topics.includes(topic) ? 0 : 1;
    const bump = b.topics.reduce(
      (acc, t) => acc + (feedbackWeights[t] ?? 0),
      0,
    );
    return { b, score: primary * 10 - bump };
  });
  scored.sort((a, b) => a.score - b.score);
  const primary = scored.slice(0, 2).map((s) => s.b);
  for (const b of primary) {
    rec.push({
      id: `rec-book-${b.ref}`,
      kind: "book",
      ref: b.ref,
      title: b.title,
      reason: `因为你选择的方向是${topicChinese(topic)}，这一本先看会更省时间。`,
      topic,
    });
  }
  const fig = matchFigures(profile, "all")[0];
  if (fig) {
    rec.push({
      id: `rec-fig-${fig.id}`,
      kind: "figure",
      ref: fig.id,
      title: `${fig.name} · 曾面对类似问题`,
      reason: `年龄段与你相近（${fig.age_band}），核心矛盾接近。`,
      topic,
    });
  }
  return rec.slice(0, 3);
}

function topicChinese(t: StoryTopic): string {
  return { career: "事业", love: "情感", wealth: "财富", recent: "近况" }[t];
}
