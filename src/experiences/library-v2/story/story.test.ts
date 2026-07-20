/**
 * Guided Library V2 · Story chain — unit tests.
 *
 * Complementary to `library-v2.test.ts` (which keeps V1-facing contract
 * checks alive). This suite covers the story chain modules.
 */
// @ts-expect-error bun:test
import { describe, expect, it, beforeEach } from "bun:test";

import {
  INITIAL_STORY_STATE,
  isIntakeStepValid,
  ageBandFromYear,
  ageBandFromDate,
  intakeProgress,
  nextIntakeStep,
  prevIntakeStep,
  DEMO_PROFILE,
} from "@/experiences/library-v2/story/state";
import type { Note, ReaderProfile } from "@/experiences/library-v2/story/types";
import {
  matchFigures,
  matchNotes,
  noteTraitsFor,
  recommendNext,
} from "@/experiences/library-v2/story/matching";
import {
  assertNoBirthLeak,
  readerPublicNickname,
  toPublicNote,
  toPublicReply,
} from "@/experiences/library-v2/story/privacy";
import {
  BOOKS,
  FIGURES,
  seedNotes,
} from "@/experiences/library-v2/story/fixtures";

const localStorageBackend: Record<string, string> = {};
// Minimal in-memory localStorage / window shim so the storage module can run
// under bun:test. Set once before the module is imported below.
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => localStorageBackend[k] ?? null,
    setItem: (k: string, v: string) => {
      localStorageBackend[k] = v;
    },
    removeItem: (k: string) => {
      delete localStorageBackend[k];
    },
    clear: () => {
      for (const k of Object.keys(localStorageBackend)) delete localStorageBackend[k];
    },
  },
  matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
};

import {
  clearStoryState,
  loadStoryState,
  saveStoryState,
} from "@/experiences/library-v2/story/storage";
import {
  createNote,
  createReply,
  listNotes,
  listReplies,
  softDeleteNote,
  softDeleteReply,
} from "@/experiences/library-v2/story/repository";

function clean() {
  clearStoryState();
  for (const k of Object.keys(localStorageBackend)) delete localStorageBackend[k];
}

describe("story · state", () => {
  it("initial state starts at gate with an empty profile", () => {
    expect(INITIAL_STORY_STATE.step).toBe("gate");
    expect(INITIAL_STORY_STATE.profile.nickname).toBe("");
  });

  it("intake progress reports 1..3", () => {
    expect(intakeProgress("intake_name")).toEqual({ index: 1, total: 3 });
    expect(intakeProgress("intake_birth")).toEqual({ index: 2, total: 3 });
    expect(intakeProgress("intake_place")).toEqual({ index: 3, total: 3 });
    expect(intakeProgress("gate")).toBeNull();
  });

  it("intake validation covers the required fields per step", () => {
    const p: ReaderProfile = { ...INITIAL_STORY_STATE.profile };
    expect(isIntakeStepValid("intake_name", p)).toBe(false);
    p.nickname = "青灯";
    expect(isIntakeStepValid("intake_name", p)).toBe(false);
    p.gender = "female";
    expect(isIntakeStepValid("intake_name", p)).toBe(true);

    expect(isIntakeStepValid("intake_birth", p)).toBe(false);
    p.birth_date = "1993-04-18";
    expect(isIntakeStepValid("intake_birth", p)).toBe(false);
    p.time_unknown = true;
    expect(isIntakeStepValid("intake_birth", p)).toBe(true);
    p.time_unknown = false;
    p.birth_time = "09:20";
    expect(isIntakeStepValid("intake_birth", p)).toBe(true);

    expect(isIntakeStepValid("intake_place", p)).toBe(false);
    p.place = "杭州";
    expect(isIntakeStepValid("intake_place", p)).toBe(true);
  });

  it("age band derivation buckets sensibly", () => {
    expect(ageBandFromYear("1993")).not.toBeNull();
    expect(ageBandFromDate("1993-04-18")).toBe(ageBandFromYear("1993"));
    expect(ageBandFromYear("2010")).toBe("18-24");
    expect(ageBandFromYear("1960")).toBe("50+");
  });

  it("next/prev intake walk in the documented order", () => {
    expect(nextIntakeStep("intake_name")).toBe("intake_birth");
    expect(nextIntakeStep("intake_birth")).toBe("intake_place");
    expect(nextIntakeStep("intake_place")).toBe("first_insight");
    expect(prevIntakeStep("intake_place")).toBe("intake_birth");
    expect(prevIntakeStep("intake_name")).toBe("focus");
  });
});

describe("story · matching", () => {
  it("figures come back sorted with topic-matching first", () => {
    const p: ReaderProfile = { ...DEMO_PROFILE, topic: "career" };
    const list = matchFigures(p, "all");
    expect(list.length).toBe(FIGURES.length);
    expect(list[0].topics.includes("career")).toBe(true);
  });

  it("figure filters honour east / west / different_choice", () => {
    const p: ReaderProfile = { ...DEMO_PROFILE };
    expect(matchFigures(p, "east").every((f) => f.tradition === "east")).toBe(true);
    expect(matchFigures(p, "west").every((f) => f.tradition === "west")).toBe(true);
    expect(matchFigures(p, "different_choice").every((f) => f.different_choice)).toBe(true);
  });

  it("note traits are abstract and never a birth field", () => {
    const traits = noteTraitsFor("career", "similar", "30-34");
    for (const t of traits) {
      expect(t.includes("1993")).toBe(false);
      expect(t.includes("杭州")).toBe(false);
      expect(t.includes("female")).toBe(false);
    }
    expect(traits.length).toBeGreaterThan(0);
    expect(traits.length).toBeLessThanOrEqual(3);
  });

  it("note matching sorts by same topic first, newest next", () => {
    const now = Date.now();
    const notes: Note[] = [
      {
        ...seedNotes(now)[0],
        id: "a",
        topic: "love",
        created_at: now - 10,
        status: "active",
        deleted_at: null,
      },
      {
        ...seedNotes(now)[0],
        id: "b",
        topic: "career",
        created_at: now - 20,
        status: "active",
        deleted_at: null,
      },
    ];
    const sorted = matchNotes(notes, { ...DEMO_PROFILE, topic: "career" });
    expect(sorted[0].id).toBe("b");
  });

  it("recommendations expose a reason and cap at 3", () => {
    const recs = recommendNext(DEMO_PROFILE, []);
    expect(recs.length).toBeLessThanOrEqual(3);
    for (const r of recs) {
      expect(r.reason.length).toBeGreaterThan(0);
    }
  });
});

describe("story · overview (panoramic) has no career bias", () => {
  it("overview recommendations lead with self + timeline, never career/love/wealth first", () => {
    const overviewProfile: ReaderProfile = {
      ...DEMO_PROFILE,
      topic: "overview",
    };
    const recs = recommendNext(overviewProfile, []);
    expect(recs.length).toBeGreaterThan(0);
    // First recommendation must be the neutral foundation book, not
    // the career/love/wealth headline books.
    const firstBook = recs.find((r) => r.kind === "book");
    expect(firstBook).toBeDefined();
    expect(firstBook!.ref).toBe("self");
    // Second book slot is `timeline`, still non-directional.
    const bookRefs = recs.filter((r) => r.kind === "book").map((r) => r.ref);
    expect(bookRefs.slice(0, 2)).toEqual(["self", "timeline"]);
    // No overview recommendation may claim `career` as its topic —
    // that was exactly the bias the panoramic entry is meant to avoid.
    for (const r of recs) {
      expect(r.topic).not.toBe("career");
      expect(r.topic).not.toBe("love");
      expect(r.topic).not.toBe("wealth");
    }
  });

  it("overview feedback weights are ignored — no career weight bump applied", () => {
    const overviewProfile: ReaderProfile = {
      ...DEMO_PROFILE,
      topic: "overview",
    };
    // Even a positive career weight must not push a career book into
    // the panoramic recommendation set.
    const recs = recommendNext(overviewProfile, [], { career: 4 });
    const bookRefs = recs.filter((r) => r.kind === "book").map((r) => r.ref);
    expect(bookRefs.slice(0, 2)).toEqual(["self", "timeline"]);
  });

  it("overview figure matching does not penalise non-career figures", () => {
    const overviewProfile: ReaderProfile = {
      ...DEMO_PROFILE,
      topic: "overview",
    };
    const careerProfile: ReaderProfile = {
      ...DEMO_PROFILE,
      topic: "career",
    };
    const overviewFirst = matchFigures(overviewProfile, "all").slice(0, 3);
    const careerFirst = matchFigures(careerProfile, "all").slice(0, 3);
    // Overview must NOT reproduce the career-first ordering — with the
    // topic axis zeroed out, ordering falls back to age + deterministic
    // tie-break, so at least one figure in the top three differs.
    const sameOrder =
      overviewFirst.length === careerFirst.length &&
      overviewFirst.every((f, i) => careerFirst[i]?.id === f.id);
    expect(sameOrder).toBe(false);
  });

  it("overview note matching is topic-neutral (sorts by recency only)", () => {
    const now = Date.now();
    const notes: Note[] = [
      {
        ...seedNotes(now)[0],
        id: "career-older",
        topic: "career",
        created_at: now - 100,
        status: "active",
        deleted_at: null,
      },
      {
        ...seedNotes(now)[0],
        id: "love-newer",
        topic: "love",
        created_at: now - 10,
        status: "active",
        deleted_at: null,
      },
    ];
    const sorted = matchNotes(notes, { ...DEMO_PROFILE, topic: "overview" });
    // Under a career-biased profile the older career note wins; under
    // overview the newer love note wins because topic doesn't matter.
    expect(sorted[0].id).toBe("love-newer");
  });

  it("loadStoryState accepts a legacy state with a StoryTopic and does not crash on overview", () => {
    clean();
    saveStoryState({
      ...INITIAL_STORY_STATE,
      profile: { ...INITIAL_STORY_STATE.profile, topic: "career" },
    });
    const restored = loadStoryState();
    expect(restored.profile.topic).toBe("career");
    // And overview also roundtrips.
    saveStoryState({
      ...INITIAL_STORY_STATE,
      profile: { ...INITIAL_STORY_STATE.profile, topic: "overview" },
    });
    expect(loadStoryState().profile.topic).toBe("overview");
  });

describe("story · privacy", () => {
  it("public note contains no birth fields", () => {
    const note = createNote({
      author_id: "u1",
      author_nickname: "青灯",
      topic: "career",
      body: "我三十四岁了，最近在做一个很难的决定。",
      image_data_url: null,
      audience: "similar",
      age_band: "30-34",
    });
    const pub = toPublicNote(note);
    const blob = JSON.stringify(pub).toLowerCase();
    for (const k of ["birth_date", "birth_time", "place", "gender", "chart"]) {
      expect(blob.includes(`"${k}"`)).toBe(false);
    }
    softDeleteNote(note.id, "u1");
  });

  it("assertNoBirthLeak throws on a bad payload", () => {
    expect(() => assertNoBirthLeak({ hello: "world", birth_date: "1993" })).toThrow();
  });

  it("reader nickname is trimmed to <= 20 chars", () => {
    const long = "x".repeat(80);
    expect(readerPublicNickname({ ...DEMO_PROFILE, nickname: long }).length).toBe(20);
    expect(readerPublicNickname({ ...DEMO_PROFILE, nickname: "" })).toBe("匿名读者");
  });

  it("public reply serialization matches shape", () => {
    clean();
    const note = createNote({
      author_id: "u1",
      author_nickname: "青灯",
      topic: "career",
      body: "示例。",
      image_data_url: null,
      audience: "similar",
      age_band: "30-34",
    });
    const reply = createReply({
      note_id: note.id,
      author_id: "u2",
      author_nickname: "夜航船",
      faced: "面对",
      chose: "选择",
      cost: "代价",
      if_again: "重来",
      one_consideration: "考虑",
    });
    const pub = toPublicReply(reply);
    expect(pub.faced).toBe("面对");
    const blob = JSON.stringify(pub);
    expect(blob.includes("birth")).toBe(false);
  });
});

describe("story · storage & repository", () => {
  beforeEach(clean);

  it("saveStoryState roundtrips", () => {
    saveStoryState({ ...INITIAL_STORY_STATE, step: "shelf" });
    expect(loadStoryState().step).toBe("shelf");
  });

  it("clearStoryState wipes everything", () => {
    saveStoryState({ ...INITIAL_STORY_STATE, step: "shelf" });
    clearStoryState();
    expect(loadStoryState().step).toBe("gate");
  });

  it("notes seed once and creation/deletion is author-scoped", () => {
    const list = listNotes(Date.now());
    expect(list.length).toBeGreaterThanOrEqual(3);
    const n = createNote({
      author_id: "u1",
      author_nickname: "u1",
      topic: "career",
      body: "hi",
      image_data_url: null,
      audience: "similar",
      age_band: "30-34",
    });
    // Only the author may soft-delete.
    expect(softDeleteNote(n.id, "somebody-else")).toBe(false);
    expect(softDeleteNote(n.id, "u1")).toBe(true);
    expect(listNotes(Date.now()).find((x) => x.id === n.id)).toBeUndefined();
  });

  it("replies scope to their note and to their author on delete", () => {
    const n = createNote({
      author_id: "u1",
      author_nickname: "u1",
      topic: "career",
      body: "hi",
      image_data_url: null,
      audience: "similar",
      age_band: "30-34",
    });
    const r = createReply({
      note_id: n.id,
      author_id: "u2",
      author_nickname: "u2",
      faced: "a",
      chose: "b",
      cost: "c",
      if_again: "d",
      one_consideration: "e",
    });
    expect(listReplies(n.id).map((x) => x.id)).toContain(r.id);
    expect(softDeleteReply(r.id, "u1")).toBe(false);
    expect(softDeleteReply(r.id, "u2")).toBe(true);
    expect(listReplies(n.id).map((x) => x.id)).not.toContain(r.id);
  });
});

describe("story · books & closing quote", () => {
  it("shelf has 7 books including premium and sage", () => {
    const refs = BOOKS.map((b) => b.ref).sort();
    expect(refs).toEqual(
      ["career", "love", "premium", "sage", "self", "timeline", "wealth"],
    );
  });

  it("forbidden marketing terms are absent from every book", () => {
    const forbidden = ["唯一正缘", "必婚", "保证收益", "预测灾祸", "治愈疾病"];
    for (const b of BOOKS) {
      const blob = JSON.stringify(b);
      for (const w of forbidden) expect(blob.includes(w)).toBe(false);
    }
  });
});
