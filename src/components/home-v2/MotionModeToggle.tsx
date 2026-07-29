/**
 * MotionModeToggle — tiny fixed pill that lets the user override the
 * global motion mode. Sits bottom-left so it never fights the mobile
 * card-progress pill (bottom-center) or the desktop LineSidebar (right).
 *
 * Cycles: auto → smooth → stable → auto. Auto follows the OS
 * prefers-reduced-motion setting and low-end device heuristics.
 */
import { useMotionSetting, setMotionSetting, type MotionSetting } from "@/lib/motion-preference";
import { useLang } from "@/lib/i18n";

const ORDER: MotionSetting[] = ["auto", "smooth", "stable"];

function label(setting: MotionSetting, isZh: boolean) {
  if (isZh) {
    return setting === "auto" ? "动效 · 自动" : setting === "smooth" ? "动效 · 顺滑" : "动效 · 稳定";
  }
  return setting === "auto" ? "Motion · Auto" : setting === "smooth" ? "Motion · Smooth" : "Motion · Stable";
}

function hint(setting: MotionSetting, isZh: boolean) {
  if (isZh) {
    return setting === "auto"
      ? "跟随系统与设备性能"
      : setting === "smooth"
        ? "强制启用平滑滚动"
        : "关闭平滑与卡片浮动";
  }
  return setting === "auto"
    ? "Follows system + device"
    : setting === "smooth"
      ? "Forces smooth scrolling"
      : "No smoothing or card stacking";
}

export function MotionModeToggle() {
  const setting = useMotionSetting();
  const { lang } = useLang();
  const isZh = lang === "zh";

  const cycle = () => {
    const idx = ORDER.indexOf(setting);
    setMotionSetting(ORDER[(idx + 1) % ORDER.length]);
  };

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-40 hidden sm:block">
      <button
        type="button"
        onClick={cycle}
        title={hint(setting, isZh)}
        aria-label={hint(setting, isZh)}
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-gold-dust/25 bg-obsidian/80 px-3 py-1.5 text-[10px] uppercase tracking-[0.24em] text-stone-warm/85 backdrop-blur-md transition hover:border-gold-dust/50 hover:text-stone-warm"
      >
        <span
          aria-hidden
          className={`h-1.5 w-1.5 rounded-full ${
            setting === "stable"
              ? "bg-sky-300"
              : setting === "smooth"
                ? "bg-amber-300"
                : "bg-emerald-300"
          }`}
        />
        <span>{label(setting, isZh)}</span>
      </button>
    </div>
  );
}
