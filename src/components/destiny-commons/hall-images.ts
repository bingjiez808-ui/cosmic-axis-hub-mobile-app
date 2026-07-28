/**
 * Static image map for the six 命运通识馆 halls. Kept separate from the
 * pure data module so serializable configs stay clean.
 */
import mathematics from "@/assets/halls/hall-mathematics.jpg";
import literature from "@/assets/halls/hall-literature.jpg";
import geography from "@/assets/halls/hall-geography.jpg";
import physics from "@/assets/halls/hall-physics.jpg";
import economics from "@/assets/halls/hall-economics.jpg";
import biology from "@/assets/halls/hall-biology.jpg";

import type { DestinyCommonsHall } from "@/lib/destiny-commons";

export const HALL_IMAGE: Record<DestinyCommonsHall["id"], string> = {
  mathematics,
  literature,
  geography,
  physics,
  economics,
  biology,
};
