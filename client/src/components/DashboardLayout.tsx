import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';

export const DashboardLayout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F4F7FB]">
      {/* Desktop & Mobile Sidebar */}
      <Sidebar isMobileOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />

      {/* Main Content Area */}
      <div className="md:pl-64 flex flex-col min-h-screen">
        <Navbar onMobileMenuToggle={() => setMobileMenuOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>

        {/* Global Footer */}
        <footer className="bg-white border-t border-slate-200/80 py-4 px-6 text-center text-xs text-slate-500">
          <div className="flex flex-col sm:flex-row items-center justify-between max-w-7xl mx-auto gap-2">
            <span>
              <strong>Zippy Loan Connector</strong> — Registered for <strong>M. Lingaswamy</strong>
            </span>
            <span className="text-slate-400">
              Powered by <span className="font-semibold text-slate-600">ZippyTech Solutions</span>
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
};
