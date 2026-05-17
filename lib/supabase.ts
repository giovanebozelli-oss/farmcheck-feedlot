import { createClient } from '@supabase/supabase-js';

// Projeto FarmCheck dedicado (sa-east-1) — separado do VisitReport.
// Estes valores são o fallback embutido; podem ser sobrescritos por
// variáveis VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY no Netlify.
const FALLBACK_URL = 'https://equqnjwfzwsuchwtkrqi.supabase.co';
const FALLBACK_ANON_KEY = 'sb_publishable_Z9ce0IVXNi0QsHlakODouA_PKks5Whb';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || FALLBACK_URL;
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || FALLBACK_ANON_KEY;

if (!import.meta.env.VITE_SUPABASE_URL) {
  console.info('[FarmCheck] Usando credenciais Supabase embutidas (projeto FarmCheck dedicado).');
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
/**
 * Cadastro de novo usuário FarmCheck.
 *
 * Comportamento:
 *  - Caso normal: cria conta no auth.users + profile (via trigger handle_new_user)
 *  - Caso especial: email já existe em outro app (ex: VisitReport) →
 *    tenta logar com a senha digitada. Se autenticar, "adopta" a conta
 *    pro FarmCheck criando o profile via fc_ensure_profile.
 *    Se a senha não bater → mensagem clara explicando.
 */
export async function signUpUser(params: {
  name: string;
  email: string;
  phone: string;
  password: string;
}): Promise<{ error?: string }> {
  const emailNorm = params.email.trim().toLowerCase();
  const nameTrim = params.name.trim();
  const phoneTrim = params.phone.trim();

  const { data, error } = await supabase.auth.signUp({
    email: emailNorm,
    password: params.password,
    options: {
      data: {
        name: nameTrim,
        phone: phoneTrim,
        app: 'farmcheck', // marca o cadastro como vindo deste app
      },
    },
  });

  // Sucesso direto: trigger criou profile
  if (!error && data.user) {
    return {};
  }

  // Erro NÃO relacionado a email duplicado: retorna direto
  if (error && !isAlreadyRegisteredError(error.message)) {
    console.error('[signUp]', error);
    return { error: traduzErroAuth(error.message) };
  }

  // Caso "Email já cadastrado" → tenta adoção via signIn.
  // O nome/telefone já foram enviados no metadata do signUp acima,
  // e a função fc_ensure_profile (chamada pelo listener onAuthStateChange,
  // FORA do lock do supabase-js) lê esse metadata como fallback.
  console.info('[signUp] email já existe em auth.users; tentando adoção via signIn…');
  const signInResult = await supabase.auth.signInWithPassword({
    email: emailNorm,
    password: params.password,
  });

  if (signInResult.error || !signInResult.data.user) {
    return {
      error:
        'Este e-mail já está cadastrado em outro sistema (ex: Visit Report) com uma senha diferente. ' +
        'Pra usar no FarmCheck, digite a MESMA senha do outro sistema, ' +
        'ou cadastre-se com um e-mail diferente.',
    };
  }

  // NÃO chamamos .rpc() aqui (deadlock logo após signInWithPassword).
  // O listener onAuthStateChange dispara SIGNED_IN e o ensureProfile
  // criará/adotará o profile fora do lock. Como o signUp acima já
  // mandou name/phone no metadata, o profile sai com os dados certos.
  return {};
}

function isAlreadyRegisteredError(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes('already registered') || m.includes('already exists') || m.includes('user already');
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

  // NÃO buscamos o profile aqui. O listener onAuthStateChange (no context)
  // dispara SIGNED_IN e resolve o profile FORA do lock do supabase-js.
  // Fazer .from()/.rpc() aqui, logo após signInWithPassword, pode dar
  // deadlock com o lock interno do supabase-js. Retornamos só sucesso.
  return {};
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

/**
 * Busca o profile; se não existir, chama RPC pra criar automaticamente
 * (failsafe pra contas órfãs criadas antes do trigger).
 */
export async function ensureProfile(userId: string): Promise<UserProfile | null> {
  const existing = await fetchProfile(userId);
  if (existing) {
    // best-effort: atualiza último acesso (roda fora do lock, seguro)
    supabase.rpc('fc_update_last_login').then(
      () => {},
      (e) => console.warn('[fc_update_last_login] falhou:', e)
    );
    return existing;
  }

  // Não existe → chama RPC pra criar/adotar
  const { data, error } = await supabase.rpc('fc_ensure_profile');
  if (error) {
    console.error('[ensureProfile]', error);
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
  if (m.includes('email rate limit')) return 'Muitas tentativas. Aguarde alguns minutos.';
  if (m.includes('password should be at least'))
    return 'A senha precisa ter pelo menos 6 caracteres.';
  if (m.includes('unable to validate email')) return 'E-mail inválido.';
  if (m.includes('email not confirmed'))
    return 'E-mail não confirmado. Verifique sua caixa de entrada ou contate o administrador.';
  return msg;
}
