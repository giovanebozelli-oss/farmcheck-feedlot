import { createClient } from '@supabase/supabase-js';

// Vite expõe variáveis com prefixo VITE_
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    '[FarmCheck] Variáveis VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY ausentes. ' +
      'Configure-as no arquivo .env.local (dev) ou no painel do Netlify (produção).'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// ----------------------------------------------------------------
// Auth simples por PIN — usuário fica salvo no localStorage
// ----------------------------------------------------------------
const AUTH_KEY = 'fc_auth_user';

export interface FcAuthUser {
  id: string;
  name: string;
  role: 'admin' | 'operator';
  photoUrl?: string;
}

export const authStorage = {
  get(): FcAuthUser | null {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      return raw ? (JSON.parse(raw) as FcAuthUser) : null;
    } catch {
      return null;
    }
  },
  set(user: FcAuthUser) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(AUTH_KEY);
  },
};

/** Lista todos os usuários ativos para seleção na tela de login */
export async function listActiveUsers(): Promise<FcAuthUser[]> {
  const { data, error } = await supabase
    .from('fc_users')
    .select('id, name, role, photo_url')
    .eq('is_active', true)
    .order('name');

  if (error) {
    console.error('[listActiveUsers]', error);
    return [];
  }

  return (data || []).map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role as 'admin' | 'operator',
    photoUrl: u.photo_url || undefined,
  }));
}

/** Valida o PIN do usuário via RPC fc_validate_pin */
export async function validateUserPin(userId: string, pin: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('fc_validate_pin', {
    p_user_id: userId,
    p_pin: pin,
  });
  if (error) {
    console.error('[validateUserPin]', error);
    return false;
  }
  return !!data;
}
