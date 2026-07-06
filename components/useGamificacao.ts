"use client";

import { useEffect, useState } from "react";

export interface Badge {
  id: string;
  name: string;
  description: string;
  criterion: string;
  earned: boolean;
}

export interface GamificacaoState {
  streak: { current: number; longest: number };
  badges: Badge[];
}

interface UseGamificacao {
  data: GamificacaoState | null;
  loading: boolean;
}

// Busca o progresso (streak + badges) do lead da sessão. `enabled: false`
// evita disparar o fetch quando ainda não há sessão (ex.: home sem lead).
export function useGamificacao(enabled = true): UseGamificacao {
  const [data, setData] = useState<GamificacaoState | null>(null);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setLoading(true);
    fetch("/api/evento/gamificacao", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => active && (setData(d), setLoading(false)))
      .catch(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [enabled]);

  return { data, loading };
}
