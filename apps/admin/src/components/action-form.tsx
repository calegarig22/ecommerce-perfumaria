"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/actions/catalog";

type Props = {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  children: React.ReactNode;
  encType?: "multipart/form-data";
  /** Botão "grudado" no rodapé da tela (listas longas, celular). */
  sticky?: boolean;
};

/** Formulário com Server Action: mostra "salvando…" e o resultado (sucesso/erro) logo abaixo. */
export function ActionForm({ action, submitLabel, pendingLabel = "Salvando…", className = "", children, sticky = false }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      <div
        className={`mt-4 flex flex-wrap items-center gap-3 ${
          sticky ? "sticky bottom-16 z-10 -mx-1 rounded-md bg-paper/95 px-1 py-2 backdrop-blur md:bottom-0" : ""
        }`}
      >
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? pendingLabel : submitLabel}
        </button>
        {state && !pending && (
          <p role={state.ok ? "status" : "alert"} className={`text-sm ${state.ok ? "text-ok" : "text-danger"}`}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
