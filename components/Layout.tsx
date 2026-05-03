
import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ClipboardList, 
  FileText, 
  Settings, 
  Menu,
  X,
  ArrowRightLeft,
  LogOut,
  Database,
  Wheat,
  Delete
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../context';

const Logo: React.FC<{ className?: string, variant?: 'sidebar' | 'login' }> = ({ className, variant = 'sidebar' }) => {
  const isLogin = variant === 'login';
  
  return (
    <div className={`select-none flex flex-col items-center justify-center ${isLogin ? 'w-full max-w-[280px] sm:max-w-[420px]' : 'w-32 sm:w-40 lg:w-48'} ${className}`}>
      <svg viewBox="0 0 500 180" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto drop-shadow-2xl" preserveAspectRatio="xMidYMid meet">
        {/* Outer Frame with specific ornate corners */}
        <path d="M40 10H460C475 10 490 25 490 40V120C490 135 475 150 460 150L250 175L40 150C25 150 10 135 10 120V40C10 25 25 10 40 10Z" fill="#001F3F" stroke="#001F3F" strokeWidth="2"/>
        
        {/* Inner Green Decorative Border */}
        <path d="M43 13H457C470 13 487 30 487 43V117C487 130 470 147 457 147L250 172L43 147C30 147 13 130 13 117V43C13 30 30 13 43 13Z" stroke="#10b981" strokeWidth="2" fill="none"/>
        
        {/* Main Text "FarmCheck" - Separated to avoid overlap */}
        <text x="135" y="105" fill="white" style={{ font: 'bold 78px "Georgia", "Times New Roman", serif' }} textAnchor="middle">Farm</text>
        <text x="365" y="105" fill="#10b981" style={{ font: 'bold 78px "Georgia", "Times New Roman", serif' }} textAnchor="middle">Check</text>
        
        {/* Subtitle "FEEDLOT" with lines */}
        <line x1="100" y1="142" x2="160" y2="142" stroke="#10b981" strokeWidth="3" />
        <text x="250" y="150" fill="#10b981" style={{ font: 'bold 24px ui-sans-serif, system-ui', letterSpacing: '14px' }} textAnchor="middle">FEEDLOT</text>
        <line x1="340" y1="142" x2="400" y2="142" stroke="#10b981" strokeWidth="3" />
      </svg>
    </div>
  );
};

const Layout: React.FC = () => {
  const [isSidebarOpen, setSidebarOpen] = React.useState(false);
  const { user, availableUsers, loginWithPin, logout, authLoading } = useAppStore();
  const location = useLocation();

  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);

  if (authLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#002147]">
        <div className="animate-pulse flex flex-col items-center">
            <Logo variant="login" />
            <span className="mt-8 italic text-emerald-500 font-black tracking-widest text-xs uppercase animate-bounce">
              Sincronizando Dados...
            </span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen availableUsers={availableUsers} loginWithPin={loginWithPin} />;
  }

  const navItems = [
    { to: "/", icon: <LayoutDashboard size={20} />, label: "Dashboard" },
    { to: "/feed", icon: <ClipboardList size={20} />, label: "Ficha de Trato" },
    { to: "/database", icon: <Database size={20} />, label: "Banco de Dados" },
    { to: "/nutrition", icon: <Wheat size={20} />, label: "Nutrição" },
    { to: "/movements", icon: <ArrowRightLeft size={20} />, label: "Movimentação de Rebanho" },
    { to: "/reports", icon: <FileText size={20} />, label: "Relatório Zootécnico" },
    { to: "/settings", icon: <Settings size={20} />, label: "Estrutura & Parâmetros" },
  ];

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden text-slate-900 font-sans">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar / Drawer */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:inset-auto
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          flex flex-col
        `}
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <Logo className="group cursor-default" variant="sidebar" />
          <button onClick={toggleSidebar} className="lg:hidden text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-full transition-all">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `
                flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                ${isActive 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 translate-x-1' 
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'}
              `}
            >
              <span className={`p-2 rounded-lg ${location.pathname === item.to ? 'bg-emerald-500/20' : ''}`}>
                {item.icon}
              </span>
              <span className="font-semibold tracking-tight">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 m-4 bg-slate-800/50 rounded-2xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 overflow-hidden">
              {user.photoUrl ? (
                <img src={user.photoUrl} alt={user.name} className="w-10 h-10 rounded-xl border-2 border-emerald-500 object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center font-bold text-slate-300 border border-slate-600">
                  {user.name?.charAt(0) || 'U'}
                </div>
              )}
              <div className="overflow-hidden">
                <p className="text-sm font-bold truncate leading-tight">{user.name || 'Usuário'}</p>
                <p className={`text-[10px] font-bold uppercase tracking-tighter truncate opacity-80 flex items-center gap-1 ${isOnline ? 'text-emerald-500' : 'text-red-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-red-400'} animate-pulse`}></span>
                  {isOnline ? 'Sistema On-line' : 'Modo Off-line'}
                </p>
              </div>
            </div>
            <button 
              onClick={logout}
              className="text-slate-400 hover:text-red-400 p-2 hover:bg-red-400/10 rounded-xl transition-all"
              title="Sair"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header - Modern and minimal - Visible only on mobile */}
        <header className="lg:hidden bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={toggleSidebar} 
              className="text-slate-600 p-2 hover:bg-slate-100 rounded-xl transition-all"
            >
              <Menu size={24} />
            </button>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-emerald-600 uppercase tracking-widest leading-none">
                  FarmCheck Feedlot
                </span>
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-red-400'} animate-pulse`}></span>
              </div>
              <h1 className="text-lg font-black text-slate-900 tracking-tighter uppercase italic leading-none">
                {navItems.find(item => item.to === location.pathname)?.label || 'Visão Geral'}
              </h1>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto custom-scrollbar p-6 lg:p-8 pb-24 lg:pb-8">
          <div className="max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>

        {/* Bottom Navigation (Mobile Only) */}
        <nav className="lg:hidden fixed bottom-6 left-6 right-6 z-40 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-[2rem] shadow-2xl p-2 flex items-center justify-around">
          {navItems.slice(0, 4).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `
                flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all
                ${isActive 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 scale-110' 
                  : 'text-slate-400 hover:text-slate-200'}
              `}
            >
              {item.icon}
            </NavLink>
          ))}
          <button 
            onClick={toggleSidebar}
            className={`
              flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all
              ${isSidebarOpen ? 'bg-slate-800 text-emerald-500' : 'text-slate-400 hover:text-slate-200'}
            `}
          >
            <Menu size={20} />
          </button>
        </nav>
      </div>
    </div>
  );
};

// =============================================================
// Tela de Login — seleção de usuário + PIN
// =============================================================
interface LoginScreenProps {
  availableUsers: { id: string; name: string; role: 'admin' | 'operator'; photoUrl?: string }[];
  loginWithPin: (userId: string, pin: string) => Promise<boolean>;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ availableUsers, loginWithPin }) => {
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null);
  const [pin, setPin] = React.useState('');
  const [error, setError] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const selectedUser = availableUsers.find((u) => u.id === selectedUserId);
  const PIN_LENGTH = 6;

  const handleKey = async (key: string) => {
    if (submitting) return;
    if (key === 'del') {
      setPin((p) => p.slice(0, -1));
      setError('');
      return;
    }
    if (pin.length >= PIN_LENGTH) return;
    const newPin = pin + key;
    setPin(newPin);
    setError('');
    if (newPin.length === PIN_LENGTH && selectedUserId) {
      setSubmitting(true);
      const ok = await loginWithPin(selectedUserId, newPin);
      if (!ok) {
        setError('PIN incorreto.');
        setTimeout(() => {
          setPin('');
          setError('');
          setSubmitting(false);
        }, 800);
      } else {
        // sucesso — o context atualiza o user, layout renderiza
        setSubmitting(false);
      }
    }
  };

  const back = () => {
    setSelectedUserId(null);
    setPin('');
    setError('');
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#001F3F] text-white p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-900/40 via-transparent to-transparent"></div>
      </div>

      <div className="relative z-10 w-full max-w-[92vw] sm:max-w-[420px] flex flex-col items-center bg-white/5 backdrop-blur-2xl p-6 sm:p-10 rounded-[2rem] sm:rounded-[3.5rem] border border-white/20 shadow-[0_48px_80px_-12px_rgba(0,0,0,0.6)]">
        <Logo variant="login" className="mb-6 md:mb-10" />

        <div className="text-center mb-6 md:mb-8">
          <h2 className="text-emerald-500 font-black uppercase tracking-[0.4em] text-[11px] mb-2">
            SISTEMA DE GESTÃO FEEDLOT
          </h2>
        </div>

        {!selectedUser ? (
          <div className="w-full">
            <p className="text-slate-300 text-xs uppercase tracking-widest text-center mb-4">
              Selecione seu perfil
            </p>
            {availableUsers.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-6">
                Nenhum usuário cadastrado.
              </p>
            ) : (
              <div className="flex flex-col gap-2 w-full max-h-[40vh] overflow-y-auto">
                {availableUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/15 border border-white/10 rounded-2xl transition-all text-left"
                  >
                    {u.photoUrl ? (
                      <img src={u.photoUrl} alt={u.name} className="w-10 h-10 rounded-xl object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center font-bold text-white">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 overflow-hidden">
                      <p className="text-sm font-semibold truncate">{u.name}</p>
                      <p className="text-[10px] uppercase tracking-widest text-emerald-400">
                        {u.role === 'admin' ? 'Administrador' : 'Operador'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="w-full flex flex-col items-center">
            <button
              onClick={back}
              className="text-slate-400 hover:text-white text-xs mb-4 self-start"
            >
              ← Trocar usuário
            </button>
            <div className="flex items-center gap-3 mb-6">
              {selectedUser.photoUrl ? (
                <img src={selectedUser.photoUrl} alt={selectedUser.name} className="w-12 h-12 rounded-xl object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center font-bold text-white text-lg">
                  {selectedUser.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-base font-semibold">{selectedUser.name}</p>
                <p className="text-[10px] uppercase tracking-widest text-emerald-400">
                  {selectedUser.role === 'admin' ? 'Administrador' : 'Operador'}
                </p>
              </div>
            </div>

            <p className="text-slate-300 text-xs uppercase tracking-widest mb-3">
              Digite seu PIN
            </p>

            <div className="flex gap-2 mb-4">
              {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                <span
                  key={i}
                  className={`w-3 h-3 rounded-full transition-all ${
                    error
                      ? 'bg-red-500'
                      : i < pin.length
                      ? 'bg-emerald-500'
                      : 'bg-white/20'
                  }`}
                />
              ))}
            </div>

            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

            <div className="grid grid-cols-3 gap-2 w-full max-w-[260px]">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <button
                  key={n}
                  onClick={() => handleKey(String(n))}
                  disabled={submitting}
                  className="bg-white/8 hover:bg-white/16 border border-white/10 rounded-xl py-3 text-lg font-semibold transition-all active:scale-95 disabled:opacity-50"
                >
                  {n}
                </button>
              ))}
              <div />
              <button
                onClick={() => handleKey('0')}
                disabled={submitting}
                className="bg-white/8 hover:bg-white/16 border border-white/10 rounded-xl py-3 text-lg font-semibold transition-all active:scale-95 disabled:opacity-50"
              >
                0
              </button>
              <button
                onClick={() => handleKey('del')}
                disabled={submitting}
                className="bg-white/8 hover:bg-white/16 border border-white/10 rounded-xl py-3 flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"
              >
                <Delete size={18} />
              </button>
            </div>
          </div>
        )}

        <footer className="mt-8 text-center opacity-30">
          <p className="text-[9px] font-black tracking-[0.4em] uppercase italic">
            Official Nutrition Systems &copy; 2026
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Layout;
