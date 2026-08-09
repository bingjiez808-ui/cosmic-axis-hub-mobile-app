/**
 * Reusable note templates for the librarian's entrust flow.
 *
 * Templates live in localStorage: they are the librarian's own phrasing, not
 * shared data, so they never need a round trip. `{alias}` is replaced with the
 * chosen traveler's alias and `{topic}` with the letter's topic label.
 */
const KEY = "hall.librarian.note-templates.v1";

export type NoteTemplate = { id: string; label: string; body: string };

export const DEFAULT_NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: "gentle",
    label: "温和托付",
    body: "{alias}，这封信关于{topic}。若此刻你有余力，愿请你替我回一程；不便的话，婉拒也无妨。",
  },
  {
    id: "expertise",
    label: "因你懂得",
    body: "{alias}，你走过相似的路，所以我第一个想到你。这封关于{topic}的信，交给你了。",
  },
  {
    id: "urgent",
    label: "希望尽快",
    body: "{alias}，写信人似乎正处在难处。若你能在这两日内回一封，将是很大的照亮。",
  },
  {
    id: "first-time",
    label: "初次受托",
    body: "{alias}，这是我第一次托付给你。不必有压力，写下你真实的感受即可。",
  },
];

function safeParse(raw: string | null): NoteTemplate[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (t): t is NoteTemplate =>
        !!t && typeof t.id === "string" && typeof t.label === "string" && typeof t.body === "string",
    );
  } catch {
    return null;
  }
}

export function loadNoteTemplates(): NoteTemplate[] {
  if (typeof window === "undefined") return DEFAULT_NOTE_TEMPLATES;
  return safeParse(window.localStorage.getItem(KEY)) ?? DEFAULT_NOTE_TEMPLATES;
}

export function saveNoteTemplates(list: NoteTemplate[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, 24)));
}

export function fillTemplate(body: string, vars: { alias: string; topic: string }) {
  return body.replaceAll("{alias}", vars.alias).replaceAll("{topic}", vars.topic);
}
