import Image from "next/image";
import { deleteImage, makeCover } from "@/lib/actions/catalog";
import { ConfirmButton } from "@/components/confirm-button";

type Img = { id: number; url: string; alt: string };

export function ImageList({ productId, images, defaultPhoto }: { productId: number; images: Img[]; defaultPhoto?: string | null }) {
  if (!images.length) {
    if (!defaultPhoto) return <p className="mt-4 text-sm text-warn">Sem foto: o site mostra só uma capa com o nome. Envie uma foto abaixo.</p>;
    return (
      <div className="mt-4 flex items-center gap-4 rounded-md border border-line p-2">
        <div className="relative aspect-[4/5] w-24 shrink-0 overflow-hidden rounded-sm bg-nude">
          <Image src={defaultPhoto} alt="Foto padrão do frasco" fill sizes="96px" className="object-contain p-1" />
        </div>
        <p className="text-sm text-muted">
          <strong className="text-ink">Foto padrão</strong> (frasco da linha) é a que aparece no site agora. Envie uma foto própria abaixo para trocar.
        </p>
      </div>
    );
  }
  return (
    <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {images.map((img, i) => (
        <li key={img.id} className="rounded-md border border-line p-2">
          <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-nude">
            <Image src={img.url} alt={img.alt} fill sizes="200px" className="object-cover" />
            {i === 0 && <span className="badge absolute top-1 left-1 bg-ink text-paper">Principal</span>}
          </div>
          <p className="mt-1 truncate text-xs text-muted" title={img.alt}>{img.alt}</p>
          <div className="mt-1 flex justify-between gap-2 text-xs">
            {i > 0 ? (
              <form action={makeCover.bind(null, productId, img.id)}>
                <button className="text-accent hover:underline">Tornar principal</button>
              </form>
            ) : (
              <span />
            )}
            <form action={deleteImage.bind(null, productId, img.id)}>
              <ConfirmButton message="Remover esta foto?" className="text-danger hover:underline">Remover</ConfirmButton>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}
