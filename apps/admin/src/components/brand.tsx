/** Logotipo em texto + "Painel" (sem imagem de marca). */
export function Brand({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 leading-none ${className}`}>
      <span className="font-display text-xl text-ink">Perfumaria Exemplo</span>
      <span className="border-l border-line-strong pl-3 text-[0.625rem] font-medium tracking-[0.3em] text-muted uppercase">Painel</span>
    </div>
  );
}
