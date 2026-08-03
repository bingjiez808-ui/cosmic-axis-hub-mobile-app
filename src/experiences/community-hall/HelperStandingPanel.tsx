/**
 * 受托旅者的声望 — how an entrusted helper is doing, and the reward it earns.
 *
 * Three rated echoes, an average of 4.5★ or better, and at least three
 * 4–5★ ratings earns a month of 「神谕者」. There is a 30-day cooldown
 * between rewards so the mechanism stays a thank-you, not a farm.
 */
import { HallSection } from "@/experiences/community-hall/HallShell";
import { useCommunityHall } from "@/lib/i18n-community-hall";
import { useHelperStanding } from "@/lib/sage-council-client";

function Bar({ value, target }: { value: number; target: number }) {
  const pct = Math.max(0, Math.min(100, target === 0 ? 100 : (value / target) * 100));
  return (
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-primary/10">
      <div className="h-full rounded-full bg-primary/60 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function HelperStandingPanel() {
  const c = useCommunityHall();
  const zh = c.lang !== "en";
  const standing = useHelperStanding();
  const s = standing.data;

  if (standing.isLoading || !s) return null;
  if (s.ratedCount === 0 && s.rewards.length === 0) {
    return (
      <HallSection title={zh ? "受托者的声望" : "Your standing as a helper"}>
        <p className="hall-paper p-5 text-sm leading-relaxed text-muted-foreground">
          {zh
            ? "还没有被评分的回音。认真回好三封托付信，并获得 4.5 星以上的平均评价，即可获赠一个月「神谕者」会员。"
            : "No rated echoes yet. Answer three entrusted letters well, keep an average above 4.5★, and you earn a month of Oracle membership."}
        </p>
      </HallSection>
    );
  }

  const cooling = s.cooldownUntil && new Date(s.cooldownUntil) > new Date();

  return (
    <HallSection title={zh ? "受托者的声望" : "Your standing as a helper"}>
      <div className="hall-paper space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-[0.7rem] text-muted-foreground">
              {zh ? "被评分的回音" : "Rated echoes"}
            </p>
            <p className="text-lg text-foreground">
              {s.ratedCount} <span className="text-xs text-muted-foreground">/ {s.needRated}</span>
            </p>
            <Bar value={s.ratedCount} target={s.needRated} />
          </div>
          <div>
            <p className="text-[0.7rem] text-muted-foreground">{zh ? "平均星级" : "Average"}</p>
            <p className="text-lg text-foreground">
              {s.avgStars.toFixed(2)}★{" "}
              <span className="text-xs text-muted-foreground">/ {s.needAvg}★</span>
            </p>
            <Bar value={s.avgStars} target={s.needAvg} />
          </div>
          <div>
            <p className="text-[0.7rem] text-muted-foreground">
              {zh ? "四星以上" : "4★ and above"}
            </p>
            <p className="text-lg text-foreground">
              {s.highCount} <span className="text-xs text-muted-foreground">/ {s.needHigh}</span>
            </p>
            <Bar value={s.highCount} target={s.needHigh} />
          </div>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          {zh
            ? "达成三项即自动获赠一个月「神谕者」会员；每 30 天最多获赠一次。"
            : "Meet all three and a month of Oracle membership is granted automatically; at most one reward every 30 days."}
          {cooling
            ? zh
              ? ` 下次可获奖时间：${new Date(s.cooldownUntil!).toLocaleDateString()}。`
              : ` Next reward available ${new Date(s.cooldownUntil!).toLocaleDateString()}.`
            : ""}
        </p>

        {s.rewards.length > 0 ? (
          <ul className="space-y-2 border-t border-primary/10 pt-3 text-xs text-foreground/80">
            {s.rewards.map((r) => (
              <li key={r.rewardId} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-primary">
                  {zh ? "获赠一个月「神谕者」" : "Earned one month of Oracle"}
                </span>
                <span className="text-muted-foreground">
                  {new Date(r.createdAt).toLocaleDateString()}
                  {r.expiresAt
                    ? ` → ${new Date(r.expiresAt).toLocaleDateString()}`
                    : ""}
                </span>
                {r.avgStars !== null ? (
                  <span className="text-muted-foreground">
                    {r.avgStars.toFixed(2)}★ · {r.ratedCount}
                    {zh ? " 封" : " replies"}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </HallSection>
  );
}
