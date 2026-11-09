import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  ClipboardList,
  Settings,
  LogOut,
  X,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen, onCloseMobile }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    {
      to: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      to: '/profile',
      label: 'Business Profile',
      icon: Building2,
    },
    {
      to: '/customers',
      label: 'Customers',
      icon: Users,
    },
    {
      to: '/leads',
      label: 'Lead Management',
      icon: ClipboardList,
    },
    {
      to: '/settings',
      label: 'Settings',
      icon: Settings,
    },
  ];

  const content = (
    <div className="flex flex-col h-full bg-[#071426] text-white">
      {/* Brand Header */}
      <div className="p-5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#087FE5] to-[#12A8F5] p-2 flex items-center justify-center shadow-md">
            <img src="/logo.svg" alt="Zippy" className="w-full h-full object-contain" />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight text-white leading-tight">
              Zippy Connector
            </h2>
            <p className="text-[11px] text-slate-300 font-medium">Fintech Workspace</p>
          </div>
        </div>
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-3 py-6 space-y-1.5">
        <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
          Main Navigation
        </div>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onCloseMobile}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[#087FE5] text-white shadow-md font-semibold'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <item.icon className="w-5 h-5 shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Technology Branding & Logout */}
      <div className="p-4 border-t border-white/10 space-y-3">
        {/* ZippyTech Solutions Technology Brand */}
        <div className="bg-white/5 rounded-xl p-3 border border-white/10 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#F59A16]/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-[#F59A16]" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-medium">
              Technology Platform
            </span>
            <span className="text-xs font-semibold text-white truncate block">
              ZippyTech Solutions
            </span>
          </div>
        </div>

        {/* Logout Action */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-rose-300 hover:bg-rose-500/10 hover:text-rose-200 transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-20 shadow-xl">
        {content}
      </aside>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-[#071426] shadow-2xl">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
