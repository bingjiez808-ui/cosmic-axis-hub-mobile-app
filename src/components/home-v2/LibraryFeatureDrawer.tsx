/**
 * LibraryFeatureDrawer — shared side sheet for the seven guide-desk
 * feature cards. Desktop opens from the right at up to ~1180px wide;
 * mobile opens as a near-full-height bottom sheet.
 *
 * Content is only mounted while `open === true` so heavy modules
 * (ConcernSelector, DestinyCommonsGrid, PostRitualRoomsSection, ...)
 * don't render on first paint.
 */
import { type ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export type LibraryFeatureDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
};

export function LibraryFeatureDrawer({
  open,
  onOpenChange,
  eyebrow,
  title,
  description,
  children,
  footer,
}: LibraryFeatureDrawerProps) {
  const isMobile = useIsMobile();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "flex flex-col border-gold-dust/25 bg-obsidian/95 p-0 text-stone-warm shadow-[0_-30px_90px_-30px_rgba(0,0,0,0.85)] sm:max-w-none",
          isMobile
            ? "h-[92dvh] w-full rounded-t-3xl"
            : "h-[100dvh] w-[min(1180px,92vw)]"
        )}
      >
        <SheetHeader className="sticky top-0 z-10 border-b border-gold-dust/20 bg-obsidian/95 px-6 py-5 backdrop-blur sm:px-8">
          {eyebrow ? (
            <p className="text-[10px] uppercase tracking-[0.4em] text-gold-dust/70">
              {eyebrow}
            </p>
          ) : null}
          <SheetTitle className="font-serif text-2xl leading-tight text-stone-warm sm:text-3xl">
            {title}
          </SheetTitle>
          {description ? (
            <SheetDescription className="text-sm text-stone-warm/70">
              {description}
            </SheetDescription>
          ) : null}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
          {open ? children : null}
        </div>
        {footer ? (
          <div className="sticky bottom-0 z-10 border-t border-gold-dust/20 bg-obsidian/95 px-6 py-4 backdrop-blur sm:px-8">
            {footer}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
