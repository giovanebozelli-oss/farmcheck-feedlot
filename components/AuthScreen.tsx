import React, { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, User, Phone, AlertCircle, Loader2, LogIn, UserPlus } from 'lucide-react';
import TratoLogo from './TratoLogo';

// ============================================================
// AuthScreen — Login + Cadastro (toggle)
// Usado quando não há usuário autenticado.
// ============================================================
interface Props {
  onSignIn: (email: string, password: string) => Promise<{ error?: string }>;
  onSignUp: (params: { name: string; email: string; phone: string; password: string }) => Promise<{ error?: string }>;
}

// Helper: máscara de telefone BR
const maskPhone = (raw: string): string => {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
};

// Calcula força da senha (0-4)
const passwordStrength = (pw: string): { score: number; label: string; color: string } => {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw)) s++;
  const labels = ['Muito fraca', 'Fraca', 'Média', 'Boa', 'Forte'];
  const colors = ['bg-rose-500', 'bg-rose-400', 'bg-amber-400', 'bg-emerald-400', 'bg-emerald-500'];
  return { score: s, label: labels[s], color: colors[s] };
};

const AuthScreen: React.FC<Props> = ({ onSignIn, onSignUp }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Campos compartilhados
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Campos só do cadastro
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const resetMessages = () => setError('');

  const validateSignup = (): string | null => {
    if (!name.trim() || name.trim().length < 3) return 'Nome precisa ter pelo menos 3 caracteres.';
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'E-mail inválido.';
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 11) return 'Telefone deve ter 10 ou 11 dígitos com DDD.';
    if (password.length < 8) return 'Senha precisa ter pelo menos 8 caracteres.';
    if (password !== confirmPassword) return 'As senhas não coincidem.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setSubmitting(true);

    if (mode === 'login') {
      if (!email.trim() || !password) {
        setError('Preencha e-mail e senha.');
        setSubmitting(false);
        return;
      }
      const result = await onSignIn(email, password);
      if (result.error) {
        setError(result.error);
        setSubmitting(false);
      }
      // Sucesso: o context redireciona, componente é desmontado
    } else {
      const v = validateSignup();
      if (v) {
        setError(v);
        setSubmitting(false);
        return;
      }
      const result = await onSignUp({ name, email, phone, password });
      if (result.error) {
        setError(result.error);
        setSubmitting(false);
      }
    }
  };

  const strength = passwordStrength(password);

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-[#001F3F] text-white p-4 relative overflow-auto py-8">
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-900/40 via-transparent to-transparent"></div>
      </div>

      <div className="relative z-10 w-full max-w-[92vw] sm:max-w-[440px] flex flex-col items-center bg-white/5 backdrop-blur-2xl p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-white/20 shadow-[0_48px_80px_-12px_rgba(0,0,0,0.6)]">
        <div className="w-full max-w-[280px] sm:max-w-[420px]">
          <TratoLogo width="100%" />
        </div>

        <div className="text-center mb-4 md:mb-6 mt-4">
          <h2 className="text-emerald-500 font-black uppercase tracking-[0.3em] text-[11px]">
            SISTEMA DE GESTÃO DE CONFINAMENTO
          </h2>
        </div>

        {/* Toggle Login / Cadastro */}
        <div className="flex w-full bg-white/5 rounded-xl p-1 mb-5 border border-white/10">
          <button
            type="button"
            onClick={() => { setMode('login'); resetMessages(); }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              mode === 'login' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-300 hover:bg-white/5'
            }`}
          >
            <LogIn size={14} /> Entrar
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); resetMessages(); }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              mode === 'signup' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-300 hover:bg-white/5'
            }`}
          >
            <UserPlus size={14} /> Cadastrar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-3">
          {/* Nome (só no cadastro) */}
          {mode === 'signup' && (
            <Field icon={<User size={16} />} label="Nome completo">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                className="bg-transparent outline-none flex-1 text-sm placeholder:text-slate-500"
                autoComplete="name"
              />
            </Field>
          )}

          <Field icon={<Mail size={16} />} label="E-mail">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="bg-transparent outline-none flex-1 text-sm placeholder:text-slate-500"
              autoComplete={mode === 'login' ? 'email' : 'email'}
            />
          </Field>

          {mode === 'signup' && (
            <Field icon={<Phone size={16} />} label="Telefone">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(maskPhone(e.target.value))}
                placeholder="(00) 0 0000-0000"
                className="bg-transparent outline-none flex-1 text-sm placeholder:text-slate-500"
                autoComplete="tel"
              />
            </Field>
          )}

          <Field icon={<Lock size={16} />} label="Senha">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'Mínimo 8 caracteres' : 'Sua senha'}
              className="bg-transparent outline-none flex-1 text-sm placeholder:text-slate-500"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="text-slate-400 hover:text-white transition-colors p-1"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </Field>

          {/* Força da senha (só no cadastro) */}
          {mode === 'signup' && password.length > 0 && (
            <div className="px-1">
              <div className="flex gap-1 h-1">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-full ${i < strength.score ? strength.color : 'bg-white/10'}`}
                  />
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Força da senha: <span className="font-bold">{strength.label}</span>
              </p>
            </div>
          )}

          {/* Confirmação de senha (só no cadastro) */}
          {mode === 'signup' && (
            <Field icon={<Lock size={16} />} label="Confirmar senha">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
                className="bg-transparent outline-none flex-1 text-sm placeholder:text-slate-500"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((s) => !s)}
                className="text-slate-400 hover:text-white transition-colors p-1"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </Field>
          )}

          {/* Indicador "senhas iguais" */}
          {mode === 'signup' && confirmPassword.length > 0 && (
            <p className={`text-[11px] px-1 ${password === confirmPassword ? 'text-emerald-400' : 'text-rose-400'}`}>
              {password === confirmPassword ? '✓ Senhas coincidem' : '✗ As senhas não coincidem'}
            </p>
          )}

          {/* Erro */}
          {error && (
            <div className="bg-rose-500/15 border border-rose-500/30 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle size={16} className="text-rose-400 flex-shrink-0 mt-0.5" />
              <p className="text-rose-300 text-xs leading-relaxed">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 mt-4 shadow-lg shadow-emerald-900/30"
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Aguarde…
              </>
            ) : mode === 'login' ? (
              <>
                <LogIn size={18} /> Entrar
              </>
            ) : (
              <>
                <UserPlus size={18} /> Criar conta
              </>
            )}
          </button>
        </form>

        <footer className="mt-6 text-center opacity-30">
          <p className="text-[9px] font-black tracking-[0.4em] uppercase italic">
            Official Nutrition Systems &copy; 2026
          </p>
        </footer>
      </div>
    </div>
  );
};

// Componente auxiliar: campo com ícone + label flutuante
const Field: React.FC<{ icon: React.ReactNode; label: string; children: React.ReactNode }> = ({ icon, label, children }) => (
  <div>
    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 block px-1">
      {label}
    </label>
    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 focus-within:border-emerald-500/50 focus-within:bg-white/8 transition-all">
      <span className="text-slate-400">{icon}</span>
      {children}
    </div>
  </div>
);

export default AuthScreen;
