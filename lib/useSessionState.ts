import { useState, useEffect, useCallback } from 'react';

/**
 * useSessionState — versão de useState que persiste em sessionStorage.
 *
 * Mantém o valor enquanto a aba do navegador estiver aberta, mesmo se o
 * componente desmontar (ex: ao trocar de aba na sidebar do app).
 *
 * Não persiste se fechar a aba — pra isso seria localStorage.
 *
 * Uso:
 *   const [date, setDate] = useSessionState<string>('feedsheet.date', today);
 */
export function useSessionState<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const fullKey = `fc.${key}`;

  // Leitura inicial: tenta carregar do sessionStorage; senão usa initial
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const raw = sessionStorage.getItem(fullKey);
      if (raw === null) return initial;
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
  });

  // Escreve no sessionStorage sempre que value muda
  useEffect(() => {
    try {
      sessionStorage.setItem(fullKey, JSON.stringify(value));
    } catch {
      // sessionStorage cheio ou bloqueado — silencioso
    }
  }, [fullKey, value]);

  const setter = useCallback((v: T | ((prev: T) => T)) => {
    setValue(v);
  }, []);

  return [value, setter];
}
