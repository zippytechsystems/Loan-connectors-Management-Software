import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F4F7FB] flex flex-col items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200/80 flex flex-col items-center max-w-sm w-full mx-4">
          <div className="w-14 h-14 rounded-2xl bg-[#071426] flex items-center justify-center p-2 mb-4 shadow-md">
            <img src="/logo.svg" alt="Zippy Logo" className="w-full h-full object-contain" />
          </div>
          <Loader2 className="w-8 h-8 text-[#087FE5] animate-spin mb-3" />
          <h3 className="text-base font-semibold text-[#071426]">Zippy Loan Connector</h3>
          <p className="text-xs text-slate-500 mt-1">Verifying secure admin session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
