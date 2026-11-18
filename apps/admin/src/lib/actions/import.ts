"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db, schema as s } from "../db";
import { requireUser } from "../session";
import { recordAudit } from "../audit";
import { revalidateSite } from "../revalidate-site";
import { MAX_ROWS, importRowSchema, rowsFromCsv, type ImportRow } from "../import/rows";
import { applyPlan, buildPlan, type Plan } from "../import/plan";
import { AiUnavailable, readWithAI } from "../import/ai";

export type PreviewState =
  | null
  | { ok: false; message: string }
  | { ok: true; source: string; rows: ImportRow[]; plan: Plan; messages: string[] };

const MAX_FILE = 3.8 * 1024 * 1024; // abaixo do limite de 4 MB das Server Actions

/** Passo 1: lê planilha, foto, PDF ou texto e mostra o que vai mudar (nada é salvo). */
export async function previewImport(_prev: PreviewState, fd: FormData): Promise<PreviewState> {
  await requireUser();
  const mode = String(fd.get("mode") ?? "");
  const file = fd.get("file");
  const text = String(fd.get("text") ?? "").trim().slice(0, 20000);
  const messages: string[] = [];
  let rows: ImportRow[] = [];
  let source = "";

  if (mode === "planilha") {
    if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Escolha o arquivo da planilha (.csv)." };
    if (file.size > MAX_FILE) return { ok: false, message: "Planilha grande demais (máx. 4 MB)." };
    if (/\.xlsx?$/i.test(file.name))
      return { ok: false, message: "Salve a planilha como CSV (no Excel: Arquivo → Salvar como → CSV UTF-8; no Google Planilhas: Arquivo → Fazer download → CSV)." };
    const res = rowsFromCsv(await file.text());
    rows = res.rows;
    messages.push(...res.errors.slice(0, 15));
    if (res.ignoredColumns.length) messages.push(`Colunas ignoradas: ${res.ignoredColumns.join(", ")}.`);
    source = `planilha ${file.name}`;
  } else if (mode === "ia") {
    const categories = (await db().select({ name: s.productLines.name }).from(s.productLines)).map((l) => l.name);
    let input: Parameters<typeof readWithAI>[0] = {};
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_FILE) return { ok: false, message: "Arquivo grande demais (máx. 4 MB). Envie uma foto menor ou o PDF em partes." };
      const type = file.type || "";
      if (!["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"].includes(type))
        return { ok: false, message: "Envie foto (JPG, PNG, WebP) ou PDF." };
      input = { file: { data: Buffer.from(await file.arrayBuffer()), mediaType: type } };
      source = `IA: ${file.name}`;
    }
    if (text) {
      input.text = text;
      source ||= "IA: texto colado";
    }
    if (!input.file && !input.text) return { ok: false, message: "Envie uma foto/PDF ou cole o texto." };
    try {
      const res = await readWithAI(input, categories);
      rows = res.rows;
      if (res.notice) messages.push(`Observação da leitura: ${res.notice}`);
    } catch (e) {
      if (e instanceof AiUnavailable) return { ok: false, message: e.message };
      return { ok: false, message: (e as Error).message };
    }
  } else return { ok: false, message: "Escolha planilha ou leitura por IA." };

  if (!rows.length) return { ok: false, message: ["Não encontrei produtos no material.", ...messages].join(" ") };
  return { ok: true, source, rows: rows.slice(0, MAX_ROWS), plan: await buildPlan(rows.slice(0, MAX_ROWS)), messages };
}

export type ApplyState = null | { ok: boolean; message: string; createdIds?: number[] };

/** Passo 2: confirma. As linhas voltam do navegador e são validadas e recomparadas com o banco. */
export async function applyImport(_prev: ApplyState, fd: FormData): Promise<ApplyState> {
  const user = await requireUser();
  let raw: unknown;
  try {
    raw = JSON.parse(String(fd.get("rows") ?? "[]"));
  } catch {
    return { ok: false, message: "Dados da importação inválidos. Leia o arquivo de novo." };
  }
  const parsed = z.array(importRowSchema).max(MAX_ROWS).safeParse(raw);
  if (!parsed.success || !parsed.data.length) return { ok: false, message: "Dados da importação inválidos. Leia o arquivo de novo." };
  const source = String(fd.get("source") ?? "importação").slice(0, 120);
  const publishNew = fd.get("publishNew") === "on";

  const res = await applyPlan(parsed.data, { publishNew });
  await recordAudit(user, {
    action: "importar",
    entity: "catálogo",
    summary: `Importação (${source}): ${res.created} novo(s), ${res.updated} atualizado(s)${res.skipped ? `, ${res.skipped} ignorado(s)` : ""}`,
  });
  refresh();
  const live = await revalidateSite();
  return {
    ok: true,
    createdIds: res.createdIds,
    message: `Pronto: ${res.created} novo(s) e ${res.updated} atualizado(s)${res.skipped ? `; ${res.skipped} linha(s) com problema foram puladas` : ""}.${live ? " O site já mostra." : ""}`,
  };
}
