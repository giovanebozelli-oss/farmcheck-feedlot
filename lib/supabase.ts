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
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'fc-auth',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// ============================================================
// Tipos e helpers de Auth
// ============================================================
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'admin' | 'user';
  isBlocked: boolean;
  blockedReason?: string;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

const profileFromDb = (row: any): UserProfile => ({
  id: row.id,
  name: row.name || '',
  email: row.email || '',
  phone: row.phone || '',
  role: row.role || 'user',
  isBlocked: !!row.is_blocked,
  blockedReason: row.blocked_reason || undefined,
  lastLoginAt: row.last_login_at || undefined,
  createdAt: row.created_at || undefined,
  updatedAt: row.updated_at || undefined,
});

/** Cadastro de novo usuário. Retorna erro se falhar. */
export async function signUpUser(params: {
  name: string;
  email: string;
  phone: string;
  password: string;
}): Promise<{ error?: string }> {
  const { data, error } = await supabase.auth.signUp({
    email: params.email.trim().toLowerCase(),
    password: params.password,
    options: {
      data: {
        name: params.name.trim(),
        phone: params.phone.trim(),
      },
    },
  });
  if (error) {
    console.error('[signUp]', error);
    return { error: traduzErroAuth(error.message) };
  }
  if (!data.user) {
    return { error: 'Erro ao criar conta. Tente novamente.' };
  }
  return {};
}

/** Login com email e senha. Verifica se conta está bloqueada. */
export async function signInUser(email: string, password: string): Promise<{ error?: string; profile?: UserProfile }> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) {
    console.error('[signIn]', error);
    return { error: traduzErroAuth(error.message) };
  }
  if (!data.user) return { error: 'Erro ao entrar.' };

  // Busca o profile
  const profile = await fetchProfile(data.user.id);
  if (!profile) {
    return { error: 'Perfil não encontrado. Contate o administrador.' };
  }
  if (profile.isBlocked) {
    await supabase.auth.signOut();
    return {
      error:
        'Sua conta está bloqueada.' +
        (profile.blockedReason ? ` Motivo: ${profile.blockedReason}` : '') +
        ' Contate o administrador.',
    };
  }

  // Atualiza last_login_at via RPC (best-effort)
  try {
    await supabase.rpc('fc_update_last_login');
  } catch (e) {
    console.warn('[fc_update_last_login] falhou:', e);
  }

  return { profile };
}

/** Faz logout. */
export async function signOutUser(): Promise<void> {
  await supabase.auth.signOut();
}

/** Busca o profile completo a partir do user id. */
export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('fc_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.error('[fetchProfile]', error);
    return null;
  }
  return data ? profileFromDb(data) : null;
}

/** Lista todos os profiles (apenas admins conseguem ler todos via RLS). */
export async function listAllProfiles(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('fc_profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[listAllProfiles]', error);
    return [];
  }
  return (data || []).map(profileFromDb);
}

/** Bloqueia um usuário (somente admin). */
export async function blockUser(targetId: string, reason?: string): Promise<{ error?: string }> {
  const { error } = await supabase.rpc('fc_block_user', {
    target_id: targetId,
    reason: reason || null,
  });
  if (error) return { error: error.message };
  return {};
}

/** Desbloqueia um usuário (somente admin). */
export async function unblockUser(targetId: string): Promise<{ error?: string }> {
  const { error } = await supabase.rpc('fc_unblock_user', { target_id: targetId });
  if (error) return { error: error.message };
  return {};
}

/** Promove ou rebaixa um usuário (somente admin). */
export async function setUserAdmin(targetId: string, makeAdmin: boolean): Promise<{ error?: string }> {
  const { error } = await supabase.rpc('fc_set_admin', {
    target_id: targetId,
    make_admin: makeAdmin,
  });
  if (error) return { error: error.message };
  return {};
}

/** Traduz mensagens comuns do Supabase Auth pra português. */
function traduzErroAuth(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('user already registered') || m.includes('already exists'))
    return 'Este e-mail já está cadastrado. Faça login ou recupere sua senha.';
  if (m.includes('email rate limit')) return 'Muitas tentativas. Aguarde alguns minutos.';
  if (m.includes('password should be at least'))
    return 'A senha precisa ter pelo menos 6 caracteres.';
  if (m.includes('unable to validate email')) return 'E-mail inválido.';
  if (m.includes('email not confirmed'))
    return 'E-mail não confirmado. Verifique sua caixa de entrada ou contate o administrador.';
  return msg;
}
