/**
 * Solar (Gregorian) ↔ Chinese Lunar helpers.
 * Wraps lunar-javascript so the rest of the app can consume plain strings.
 */
// @ts-expect-error — lunar-javascript ships without types
import { Lunar, Solar } from "lunar-javascript";

export type LunarInfo = {
  /** e.g. "农历 甲辰年 三月初八" */
  lunarZh: string;
  /** e.g. "Lunar: Jia-Chen Year, 3rd Month, Day 8" */
  lunarEn: string;
  /** Ganzhi year — 甲辰 */
  ganzhiYear: string;
  /** Ganzhi month */
  ganzhiMonth: string;
  /** Ganzhi day */
  ganzhiDay: string;
  /** Ganzhi hour (needs birth hour) */
  ganzhiHour?: string;
  /** Bazi four pillars — 年柱 月柱 日柱 时柱 */
  bazi: string;
  /** Chinese zodiac animal — 龙 / Dragon */
  zodiac: string;
  zodiacEn: string;
};

const ZODIAC_EN: Record<string, string> = {
  鼠: "Rat", 牛: "Ox", 虎: "Tiger", 兔: "Rabbit",
  龙: "Dragon", 蛇: "Snake", 马: "Horse", 羊: "Goat",
  猴: "Monkey", 鸡: "Rooster", 狗: "Dog", 猪: "Pig",
};

/**
 * @param dateISO YYYY-MM-DD (solar)
 * @param timeHM  optional HH:MM (24h)
 */
export function solarToLunarInfo(dateISO: string, timeHM?: string): LunarInfo | null {
  if (!dateISO) return null;
  const m = dateISO.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  let hh = 0, mm = 0;
  if (timeHM) {
    const tm = timeHM.match(/^(\d{1,2}):(\d{2})$/);
    if (tm) { hh = +tm[1]; mm = +tm[2]; }
  }
  try {
    const solar = Solar.fromYmdHms(+y, +mo, +d, hh, mm, 0);
    const lunar = solar.getLunar();
    const yGZ = lunar.getYearInGanZhi();
    const mGZ = lunar.getMonthInGanZhi();
    const dGZ = lunar.getDayInGanZhi();
    const hGZ = timeHM ? lunar.getTimeInGanZhi() : undefined;
    const zodiac = lunar.getYearShengXiao();
    const monthCh = lunar.getMonthInChinese();
    const dayCh = lunar.getDayInChinese();
    const bazi = `${yGZ} ${mGZ} ${dGZ}${hGZ ? " " + hGZ : ""}`;
    return {
      lunarZh: `农历 ${yGZ}年 ${monthCh}月${dayCh}`,
      lunarEn: `Lunar: ${yGZ} Year · Month ${monthCh} · Day ${dayCh}`,
      ganzhiYear: yGZ,
      ganzhiMonth: mGZ,
      ganzhiDay: dGZ,
      ganzhiHour: hGZ,
      bazi,
      zodiac,
      zodiacEn: ZODIAC_EN[zodiac] ?? zodiac,
    };
  } catch (e) {
    console.warn("lunar conversion failed", e);
    return null;
  }
}
