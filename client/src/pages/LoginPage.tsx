import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Lock, User, Shield, AlertCircle, ArrowRight, Loader2, Sparkles } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('M.Lingaswamy@123');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError('Please enter your admin username or email.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await login(username.trim(), password, rememberMe);
      if (result.success) {
        navigate(from, { replace: true });
      } else {
        setError(result.message || 'Login failed. Please verify your credentials.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during login.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Decorative Fintech Elements */}
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-[#087FE5]/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-[#12A8F5]/10 blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        {/* Brand Header */}
        <div className="text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-[#071426] flex items-center justify-center p-3 shadow-xl border border-white/20">
            <img src="/logo.svg" alt="Zippy Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#071426]">
            Zippy Loan Connector
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-600 font-medium">
            Single Owner & Admin Authentication Portal
          </p>
          <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-slate-200/70 text-slate-700 text-xs font-medium">
            <Shield className="w-3.5 h-3.5 text-[#087FE5]" /> Authorized Access for M. Lingaswamy
          </div>
        </div>

        {/* Card */}
        <div className="mt-8 bg-white py-8 px-6 sm:px-10 shadow-xl shadow-slate-200/50 rounded-2xl border border-slate-200/70">
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            {/* Error Banner */}
            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-rose-800 font-medium leading-relaxed">
                  {error}
                </div>
              </div>
            )}

            {/* Username / Email Input */}
            <div>
              <label
                htmlFor="username"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Username / Email
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="h-5 h-5" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. M.Lingaswamy@123"
                  className="block w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#087FE5] focus:ring-2 focus:ring-[#087FE5]/20 focus:outline-hidden transition-all text-[#071426] placeholder-slate-400 font-medium bg-slate-50/50"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Password
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-5 h-5" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your secure password"
                  className="block w-full pl-10 pr-11 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#087FE5] focus:ring-2 focus:ring-[#087FE5]/20 focus:outline-hidden transition-all text-[#071426] placeholder-slate-400 font-medium bg-slate-50/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-hidden"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-5 h-5" /> : <Eye className="h-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-[#087FE5] border-slate-300 focus:ring-[#087FE5]"
                />
                <span className="text-slate-600 font-medium">Remember this browser</span>
              </label>
              <span className="text-xs text-slate-400 font-medium">HTTP-only Cookie</span>
            </div>

            {/* Login Submit Button */}
            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-gradient-to-r from-[#087FE5] to-[#12A8F5] hover:from-[#076ecc] hover:to-[#087FE5] focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-[#087FE5] transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Signing in securely...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Security Assurance Footnote */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span className="flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-emerald-600" /> 256-bit Encrypted Session
            </span>
            <span>Single Admin Control</span>
          </div>
        </div>

        {/* Technology Attribution Footer */}
        <div className="mt-6 text-center flex items-center justify-center gap-2 text-xs text-slate-500">
          <Sparkles className="w-3.5 h-3.5 text-[#F59A16]" />
          <span>Technology brand: <strong>ZippyTech Solutions</strong></span>
        </div>
      </div>
    </div>
  );
};
