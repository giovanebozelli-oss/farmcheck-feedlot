// Ping diário no Supabase para evitar pausa por inatividade (free tier).
// Sem isso, o projeto pausa após ~7 dias sem uso e o app mostra "Failed to fetch".
const SUPABASE_URL = 'https://equqnjwfzwsuchwtkrqi.supabase.co';
const ANON_KEY = 'sb_publishable_Z9ce0IVXNi0QsHlakODouA_PKks5Whb';

export default async () => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/fc_config?select=id&limit=1`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  console.log(`[keepalive] supabase ping: ${res.status}`);
  return new Response(`ok ${res.status}`);
};

export const config = { schedule: '@daily' };
