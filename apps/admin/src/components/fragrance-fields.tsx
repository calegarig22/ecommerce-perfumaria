type F = {
  name: string;
  family: string;
  gender: "feminino" | "masculino" | "unissex" | null;
  notesTop: string[];
  notesHeart: string[];
  notesBase: string[];
  description: string | null;
  internalReference: string | null;
};

export function FragranceFields({ f }: { f?: F }) {
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-3">
      <div>
        <label className="label" htmlFor="name">Nome</label>
        <input id="name" name="name" required maxLength={60} defaultValue={f?.name} className="field" />
      </div>
      <div>
        <label className="label" htmlFor="family">Família olfativa <span className="font-normal text-muted">(opcional)</span></label>
        <input id="family" name="family" maxLength={80} defaultValue={f?.family} placeholder="Floral Frutado" className="field" />
      </div>
      <div>
        <label className="label" htmlFor="gender">Público</label>
        <select id="gender" name="gender" defaultValue={f ? (f.gender ?? "") : "feminino"} className="field">
          <option value="feminino">Feminino</option>
          <option value="masculino">Masculino</option>
          <option value="unissex">Unissex</option>
          <option value="">Não se aplica (casa, acessórios)</option>
        </select>
      </div>
      <div className="md:col-span-3">
        <label className="label" htmlFor="description">Descrição (aparece no site)</label>
        <textarea id="description" name="description" rows={3} maxLength={1200} defaultValue={f?.description ?? ""} className="field" />
      </div>
      <details className="md:col-span-3" open={!!f && (f.notesTop.length + f.notesHeart.length + f.notesBase.length > 0)}>
        <summary className="text-sm text-accent">Notas olfativas e referência interna (opcional)</summary>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
      <div>
        <label className="label" htmlFor="notesTop">Notas de saída</label>
        <textarea id="notesTop" name="notesTop" rows={2} defaultValue={f?.notesTop.join(", ")} placeholder="Bergamota, Pera" className="field" />
      </div>
      <div>
        <label className="label" htmlFor="notesHeart">Notas de coração</label>
        <textarea id="notesHeart" name="notesHeart" rows={2} defaultValue={f?.notesHeart.join(", ")} className="field" />
      </div>
      <div>
        <label className="label" htmlFor="notesBase">Notas de fundo</label>
        <textarea id="notesBase" name="notesBase" rows={2} defaultValue={f?.notesBase.join(", ")} className="field" />
      </div>
      <div className="md:col-span-3">
        <label className="label" htmlFor="internalReference">Referência interna</label>
        <input id="internalReference" name="internalReference" maxLength={120} defaultValue={f?.internalReference ?? ""} className="field" />
        <p className="mt-1 text-xs text-muted">Só no painel. Nunca aparece no site.</p>
      </div>
      <p className="text-xs text-muted md:col-span-3">
        Separe as notas por vírgula. Sem notas, o site não mostra a pirâmide olfativa.
      </p>
        </div>
      </details>
    </div>
  );
}
