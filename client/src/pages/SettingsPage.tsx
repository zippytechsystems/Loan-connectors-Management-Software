import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  Database,
  Lock,
  User,
  CheckCircle2,
  AlertTriangle,
  Server,
  RefreshCw,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [health, setHealth] = useState<any>(null);
  const [checking, setChecking] = useState<boolean>(false);

  const checkHealth = async () => {
    setChecking(true);
    try {
      const res = await api.getHealth();
      setHealth(res);
    } catch (err) {
      setHealth({ success: false, error: 'Failed to contact health endpoint' });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
      <div className="pb-2 border-b border-slate-200/80">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#071426]">
          System & Account Settings
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Security controls, authentication credentials, and Hostinger MySQL database telemetry.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Account Credentials Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="p-2 rounded-xl bg-blue-50 text-[#087FE5]">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#071426]">Owner & Admin Profile</h2>
              <p className="text-xs text-slate-500">Single admin credential parameters.</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block mb-0.5">Admin Identifier</span>
              <span className="font-bold text-sm text-[#071426] bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 inline-block font-mono">
                {user?.username || 'M.Lingaswamy@123'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Authorization Role</span>
              <span className="font-semibold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Single Owner / Admin
              </span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Password Security</span>
              <span className="text-slate-700 font-medium">
                Protected with 12-round bcrypt hash. Stored securely in Hostinger MySQL.
              </span>
            </div>
          </div>
        </div>

        {/* Session Security Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="p-2 rounded-xl bg-blue-50 text-[#087FE5]">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#071426]">Session Security</h2>
              <p className="text-xs text-slate-500">HTTP-only cookie & CSRF prevention.</p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs text-slate-700">
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Cookie Type</span>
              <span className="font-semibold text-slate-800">HTTP-Only, SameSite=Lax</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Brute-Force Shield</span>
              <span className="font-semibold text-emerald-600">Rate Limited (10 req / 15m)</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">XSS Protection</span>
              <span className="font-semibold text-emerald-600">Strict Cookie Shield</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-500">Protected Routes</span>
              <span className="font-semibold text-slate-800">100% Enforced</span>
            </div>
          </div>
        </div>

        {/* Hostinger Database Status Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4 md:col-span-2">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-50 text-[#087FE5]">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#071426]">Hostinger MySQL Database Connectivity</h2>
                <p className="text-xs text-slate-500">Live operational probe to the production MySQL instance.</p>
              </div>
            </div>
            <button
              onClick={checkHealth}
              disabled={checking}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
              <span>Probe Connection</span>
            </button>
          </div>

          {health ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 block mb-1">Database State</span>
                <div className="flex items-center gap-1.5 font-bold text-sm">
                  {health.database?.connected ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700">Connected</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span className="text-amber-700">Configuration Required</span>
                    </>
                  )}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 block mb-1">Target Host</span>
                <span className="font-semibold text-slate-800 text-sm font-mono block truncate">
                  {health.database?.host || 'Hostinger 127.0.0.1:3306'}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 block mb-1">Database Name</span>
                <span className="font-semibold text-slate-800 text-sm font-mono block truncate">
                  {health.database?.name || 'u914601002_Zippyloansdata'}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">Probing Hostinger MySQL database status...</p>
          )}

          <div className="pt-2 text-xs text-slate-500 flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-slate-400" />
            <span>
              All profile edits are permanently saved and read from MySQL with parameterized SQL statements.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
