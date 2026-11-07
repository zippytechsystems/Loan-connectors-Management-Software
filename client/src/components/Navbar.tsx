import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, User as UserIcon, ShieldCheck, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface NavbarProps {
  onMobileMenuToggle?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onMobileMenuToggle }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left Brand & Mobile Toggle */}
          <div className="flex items-center space-x-3">
            <button
              onClick={onMobileMenuToggle}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-hidden"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-[#071426] flex items-center justify-center p-1.5 shadow-sm">
                <img src="/logo.svg" alt="Zippy Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <span className="text-lg font-bold tracking-tight text-[#071426] block leading-none">
                  Zippy Loan Connector
                </span>
                <span className="text-[11px] font-medium text-slate-500 block leading-tight mt-0.5">
                  Fintech Partner Portal
                </span>
              </div>
            </div>
          </div>

          {/* Right User & Actions */}
          <div className="flex items-center space-x-3 sm:space-x-5">
            {/* Owner Greeting */}
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-semibold text-[#071426] leading-none">
                Welcome, M. Lingaswamy
              </span>
              <span className="text-[11px] font-medium text-emerald-600 flex items-center justify-end gap-1 mt-1">
                <ShieldCheck className="w-3 h-3" /> Single Owner / Admin
              </span>
            </div>

            {/* Profile Avatar */}
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#087FE5] to-[#071426] text-white flex items-center justify-center font-bold text-sm shadow-xs border border-white">
              <UserIcon className="w-4 h-4 text-white" />
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors"
              title="Logout from Zippy Loan Connector"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
