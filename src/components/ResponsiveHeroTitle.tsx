/**
 * ResponsiveHeroTitle — one headline renderer shared by the entrance
 * overlay and the guide desk, so both pages always break at the exact
 * same semantic points. Each line owns its own punctuation and never
 * re-wraps: the type scales down instead of adding a third line.
 */
import type { CSSProperties, ReactNode } from "react";
import "./hero-title.css";

type Props = {
  lines: readonly string[];
  lang: "zh" | "en";
  id?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

export function ResponsiveHeroTitle({ lines, lang, id, className, style }: Props) {
  return (
    <h1 id={id} className={`hero-title${className ? ` ${className}` : ""}`} data-lang={lang} style={style}>
      {lines.map((line) => (
        <span key={line} className="hero-title-line">
          {line}
        </span>
      ))}
    </h1>
  );
}
