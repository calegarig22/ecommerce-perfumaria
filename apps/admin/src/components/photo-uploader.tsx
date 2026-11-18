"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { compressImage } from "@/lib/image-client";
import type { ActionState } from "@/lib/actions/catalog";

type Upload = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/**
 * Enviar fotos: escolhe várias de uma vez (ou tira pela câmera no celular),
 * reduz no navegador e envia uma a uma, mostrando o progresso.
 */
export function PhotoUploader({ upload, altBase }: { upload: Upload; altBase: string }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, startBusy] = useTransition();
  const [dragging, setDragging] = useState(false);

  function send(files: File[]) {
    const images = files.filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (!images.length) return;
    startBusy(async () => {
      let done = 0;
      const errors: string[] = [];
      for (const [i, file] of images.entries()) {
        setStatus({ ok: true, text: `Enviando ${i + 1} de ${images.length}…` });
        try {
          const small = await compressImage(file);
          const fd = new FormData();
          fd.set("file", small);
          fd.set("alt", altBase);
          const res = await upload(null, fd);
          if (res?.ok) done++;
          else errors.push(res?.message ?? "Falha no envio.");
        } catch (e) {
          errors.push((e as Error).message);
        }
      }
      setStatus(
        errors.length
          ? { ok: false, text: `${done} foto(s) enviada(s). ${errors[0]}` }
          : { ok: true, text: `${done} foto(s) enviada(s). O site já mostra.` },
      );
      if (input.current) input.current.value = "";
      router.refresh();
    });
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        send([...e.dataTransfer.files]);
      }}
      className={`mt-4 rounded-md border-2 border-dashed p-5 text-center transition-colors ${
        dragging ? "border-accent bg-nude" : "border-line-strong"
      }`}
    >
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        id="fotos"
        onChange={(e) => send([...(e.target.files ?? [])])}
        disabled={busy}
      />
      <label htmlFor="fotos" className={`btn-primary ${busy ? "pointer-events-none opacity-50" : ""}`}>
        {busy ? "Enviando…" : "Adicionar fotos"}
      </label>
      <p className="mt-2 text-xs text-muted">
        Escolha várias de uma vez, arraste para cá ou tire pela câmera do celular. A foto é reduzida automaticamente.
      </p>
      {status && (
        <p role={status.ok ? "status" : "alert"} className={`mt-2 text-sm ${status.ok ? "text-ok" : "text-danger"}`}>
          {status.text}
        </p>
      )}
    </div>
  );
}
