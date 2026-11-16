import Image from "next/image";
import foilDeep from "@/assets/art/foil-deep.jpg";
import threadCoil from "@/assets/art/thread-coil.png";

/**
 * The Makerie's signature holographic artwork — original renders produced by
 * scripts/generate-art.mjs. Each object has one job; don't scatter them.
 *
 *   HeroFoil    deep liquid holographic film — a slim accent strip in the
 *               hero. Holographic material is an accent, never the content.
 *   ThreadCoil  plied yarn coil — a small accent in collection empty states.
 *
 * Real pattern covers and project photography should carry the visual
 * richness once they exist; these accents step back.
 *
 * All are decorative (empty alt). Served through next/image, so phones get
 * appropriately sized WebP/AVIF.
 */
type ArtProps = {
  className?: string;
  /** Rendered width hint for responsive sizing, e.g. "(min-width: 1280px) 420px, 240px". */
  sizes: string;
};

export function ThreadCoil({ className, sizes }: ArtProps) {
  return <Image src={threadCoil} alt="" sizes={sizes} className={className} draggable={false} />;
}

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
