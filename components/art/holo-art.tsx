import Image from "next/image";
import foilDeep from "@/assets/art/foil-deep.jpg";

/**
 * The Makerie's holographic foil — an original render produced by
 * scripts/generate-art.mjs (`npm run art`).
 *
 *   HeroFoil    deep liquid holographic film — a slim accent strip in the
 *               hero. Holographic material is an accent, never the content.
 *
 * Real pattern covers and project photography should carry the visual
 * richness once they exist; these accents step back.
 *
 * Decorative (empty alt). Served through next/image, so phones get
 * appropriately sized WebP/AVIF.
 */
export function HeroFoil({ sizes }: { sizes: string }) {
  return (
    <Image
      src={foilDeep}
      alt=""
      fill
      sizes={sizes}
      placeholder="blur"
      className="object-cover"
      draggable={false}
    />
  );
}
