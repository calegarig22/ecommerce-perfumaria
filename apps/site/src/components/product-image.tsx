import Image from "next/image";
import type { LineSlug, Notes } from "@/lib/types";
import { tileArt } from "@/lib/format";

type Props = {
  /** Sem foto: o quadro mostra só a arte (degradê + nome), como capa elegante. */
  src?: string;
  alt: string;
  /** Nome da fragrância, gravado grande ao fundo. */
  name: string;
  line: LineSlug;
  family: string;
  notes?: Notes;
  sizes: string;
  priority?: boolean;
  /** Proporção do quadro (padrão 4/5). */
  aspect?: string;
  className?: string;
  imageClassName?: string;
};

/**
 * Quadro de foto do produto. Como o frasco é o mesmo em várias fragrâncias, a identidade
 * de cada uma vem do entorno: degradê das facetas da família + nome gravado atrás do frasco.
 */
export function ProductImage({
  src,
  alt,
  name,
  line,
  family,
  notes,
  sizes,
  priority,
  aspect = "aspect-[4/5]",
  className = "",
  imageClassName = "",
}: Props) {
  const hand = line === "perfume-cabelo";
  const art = tileArt(family, notes);
  // Tamanho em relação à largura do quadro (container query): nomes longos encolhem, sempre em 1 linha.
  const fontSize = `${Math.min(30, 112 / Math.max(name.length, 3))}cqw`;

  return (
    <div
      className={`@container relative overflow-hidden ${aspect} ${className}`}
      style={{ background: art.background }}
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 select-none whitespace-nowrap text-center font-display uppercase leading-[0.9] ${
          src ? "top-[9%]" : "top-1/2 -translate-y-1/2"
        }`}
        style={{ fontSize, color: art.ink, opacity: src ? 0.2 : 0.55, letterSpacing: "0.04em" }}
      >
        {name}
      </span>
      {src && (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={`object-contain drop-shadow-[0_18px_22px_rgb(46_36_32/0.2)] ${
          hand ? "object-left-bottom pr-[26%] pt-[20%]" : "object-bottom px-[16%] pb-[9%] pt-[22%]"
        } ${imageClassName}`}
      />
      )}
    </div>
  );
}
