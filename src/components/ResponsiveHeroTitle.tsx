/**
 * ResponsiveHeroTitle — one headline renderer shared by the entrance
 * overlay and the guide desk, so both pages always break at the exact
 * same semantic points. Each line owns its own punctuation and never
 * re-wraps: the type scales down instead of adding a third line.
 */
import type { CSSProperties, ReactNode } from "react";
import "./hero-title.css";

export type HeroTitleLine = string | { text: string; accent?: boolean };

type Props = {
  lines: readonly HeroTitleLine[];
  lang: "zh" | "en";
  id?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

export function ResponsiveHeroTitle({ lines, lang, id, className, style }: Props) {
  return (
    <h1 id={id} className={`hero-title${className ? ` ${className}` : ""}`} data-lang={lang} style={style}>
      {lines.map((line) => {
        const text = typeof line === "string" ? line : line.text;
        const accent = typeof line === "string" ? false : Boolean(line.accent);
        return (
          <span key={text} className={`hero-title-line${accent ? " hero-title-line--accent" : ""}`}>
            {text}
          </span>
        );
      })}
    </h1>
  );
}
