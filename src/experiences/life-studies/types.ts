/**
 * Subject-room data contract shared by every 命运通识馆 room.
 *
 * A subject room translates deterministic chart facts into ONE
 * everyday-knowledge language (math, philosophy, physics, economics,
 * geography). The contract keeps rooms consistent — same header, same
 * "how we generate" disclosure, same auth/main-chart gating — while
 * each room owns its own visualization and interaction.
 *
 * Rooms MUST NOT invent chart facts. They may:
 *   - read local deterministic FACTS from the primary chart,
 *   - apply room-specific rule-based translations,
 *   - render local visualizations,
 *   - render rule-generated curator summaries (clearly labeled).
 * They MUST NOT call live AI, nor infer chart data the calculators
 * do not currently produce.
 */
export type SubjectRoomStatus = "open" | "next-phase" | "requires-integration";

export type SubjectRoomMeta = {
  id: "math" | "philosophy" | "physics" | "economics" | "geography";
  route: "/life-studies/math" | "/life-studies";
  slugRoute: string;
  title: { zh: string; en: string };
  subtitle: { zh: string; en: string };
  question: { zh: string; en: string };
  visualization: { zh: string; en: string };
  readMinutes: number;
  dataRequirement: { zh: string; en: string };
  usesAI: boolean;
  status: SubjectRoomStatus;
  statusNote?: { zh: string; en: string };
};
