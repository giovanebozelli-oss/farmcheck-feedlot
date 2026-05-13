
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
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../context';
import AuthScreen from './AuthScreen';

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
  const { user, signIn, signUp, logout, authLoading } = useAppStore();
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
    return <AuthScreen onSignIn={signIn} onSignUp={signUp} />;
  }

  const isAdmin = user.role === 'admin';

  const navItems = [
    { to: "/", icon: <LayoutDashboard size={20} />, label: "Dashboard", adminOnly: false },
    { to: "/feed", icon: <ClipboardList size={20} />, label: "Ficha de Trato", adminOnly: false },
    { to: "/database", icon: <Database size={20} />, label: "Banco de Dados", adminOnly: false },
    { to: "/nutrition", icon: <Wheat size={20} />, label: "Nutrição", adminOnly: false },
    { to: "/movements", icon: <ArrowRightLeft size={20} />, label: "Movimentação de Rebanho", adminOnly: false },
    { to: "/reports", icon: <FileText size={20} />, label: "Relatório Zootécnico", adminOnly: false },
    { to: "/users", icon: <Users size={20} />, label: "Usuários", adminOnly: true },
    { to: "/settings", icon: <Settings size={20} />, label: "Estrutura & Parâmetros", adminOnly: false },
  ].filter(item => !item.adminOnly || isAdmin);

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
              <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center font-bold text-white border-2 border-emerald-500">
                {user.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold truncate leading-tight">{user.name || 'Usuário'}</p>
                <p className={`text-[10px] font-bold uppercase tracking-tighter truncate opacity-80 flex items-center gap-1 ${isOnline ? 'text-emerald-500' : 'text-red-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-red-400'} animate-pulse`}></span>
                  {user.role === 'admin' ? 'Administrador' : 'Usuário'} · {isOnline ? 'On-line' : 'Off-line'}
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


export default Layout;
