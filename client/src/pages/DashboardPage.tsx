import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import type { BusinessProfile } from '../types';
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldAlert,
  Loader2,
  Landmark,
  Layers,
  Sparkles,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await api.getBusinessProfile();
        if (res.success) {
          setProfile(res.profile || null);
        } else {
          setError(res.message || 'Could not fetch profile details');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load business profile');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="w-10 h-10 text-[#087FE5] animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-500">Loading business profile data from MySQL...</p>
      </div>
    );
  }

  const isProfileComplete = !!(
    profile &&
    profile.business_name &&
    profile.owner_name &&
    profile.mobile_number &&
    profile.email
  );

  const activeCategories = profile?.loan_categories || [];

  const formatLastUpdated = (dateString?: string) => {
    if (!dateString) return 'Not yet configured';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return dateString;
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-[#071426] via-[#0d223f] to-[#087FE5] rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 rounded-full bg-[#12A8F5]/20 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 -mb-12 w-48 h-48 rounded-full bg-[#F59A16]/20 blur-xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[11px] font-semibold text-sky-200 mb-3 border border-white/10">
            <Sparkles className="w-3.5 h-3.5 text-[#F59A16]" /> Phase 1 Management Console
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
            Welcome to Zippy Loan Connector
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-300 font-normal leading-relaxed">
            Manage your loan connector business information from one place.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to="/profile"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-[#071426] text-xs sm:text-sm font-bold shadow-md hover:bg-slate-100 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Building2 className="w-4 h-4 text-[#087FE5]" />
              <span>{profile ? 'Edit Business Profile' : 'Configure Business Profile'}</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </Link>

            {profile?.lender_name && (
              <div className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 text-white text-xs font-semibold backdrop-blur-xs border border-white/10">
                <Landmark className="w-4 h-4 text-[#F59A16]" />
                <span>Primary Partner: {profile.lender_name}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error alert if any */}
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">Notice</p>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* 4 Core Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Business Profile Status */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Profile Status
              </span>
              <div
                className={`p-2 rounded-xl ${
                  isProfileComplete ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                }`}
              >
                {isProfileComplete ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Clock className="w-5 h-5" />
                )}
              </div>
            </div>
            <div className="text-xl font-bold text-[#071426] mb-1">
              {isProfileComplete ? 'Configured & Active' : 'Setup Incomplete'}
            </div>
            <p className="text-xs text-slate-500 leading-normal">
              {profile?.connector_status
                ? `Connector Status: ${profile.connector_status}`
                : 'Complete business registration details.'}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Business Type</span>
            <span className="font-semibold text-slate-800">{profile?.business_type || 'Individual Loan Connector'}</span>
          </div>
        </div>

        {/* Card 2: Business Contact Details */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Contact Details
              </span>
              <div className="p-2 rounded-xl bg-blue-50 text-[#087FE5]">
                <Phone className="w-5 h-5" />
              </div>
            </div>
            <div className="text-sm font-bold text-[#071426] mb-2 flex items-center gap-1.5 truncate">
              <Phone className="w-3.5 h-3.5 text-[#087FE5] shrink-0" />
              <span className="truncate">{profile?.mobile_number || 'No phone set'}</span>
            </div>
            <div className="text-xs text-slate-600 flex items-center gap-1.5 truncate mb-1">
              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{profile?.email || 'No email set'}</span>
            </div>
            <div className="text-xs text-slate-600 flex items-center gap-1.5 truncate">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">
                {[profile?.city, profile?.state].filter(Boolean).join(', ') || 'Address not configured'}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Owner</span>
            <span className="font-semibold text-slate-800">{profile?.owner_name || 'M. Lingaswamy'}</span>
          </div>
        </div>

        {/* Card 3: Active Loan Categories */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Active Categories
              </span>
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-[#071426] mb-1">
              {activeCategories.length}{' '}
              <span className="text-xs font-normal text-slate-400">Categories</span>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {activeCategories.length > 0 ? (
                activeCategories.slice(0, 3).map((cat) => (
                  <span
                    key={cat}
                    className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold"
                  >
                    {cat}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400 italic">No categories selected</span>
              )}
              {activeCategories.length > 3 && (
                <span className="inline-block px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-semibold">
                  +{activeCategories.length - 3} more
                </span>
              )}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Lender</span>
            <span className="font-semibold text-slate-800">{profile?.lender_name || 'Not linked'}</span>
          </div>
        </div>

        {/* Card 4: Profile Last Updated */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Last Updated
              </span>
              <div className="p-2 rounded-xl bg-amber-50 text-[#F59A16]">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="text-sm font-bold text-[#071426] mb-1 leading-snug">
              {formatLastUpdated(profile?.updated_at || profile?.created_at)}
            </div>
            <p className="text-xs text-slate-500 leading-normal mt-1">
              {profile?.updated_at ? 'Stored permanently in MySQL database.' : 'Profile has not been saved yet.'}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Database</span>
            <span className="font-semibold text-emerald-600">Hostinger MySQL</span>
          </div>
        </div>
      </div>

      {/* Business Details Breakdown Preview */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-[#071426]">Business Overview Summary</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified business profile parameters registered in MySQL.
            </p>
          </div>
          <Link
            to="/profile"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#087FE5] bg-blue-50 hover:bg-blue-100 transition-colors self-start sm:self-auto"
          >
            <span>Update Information</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          {/* Section 1 */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              A. Business Identity
            </h3>
            <div className="space-y-1.5 text-xs">
              <div>
                <span className="text-slate-400 block">Business Name:</span>
                <span className="font-semibold text-slate-800">{profile?.business_name || 'Zippy Loan Connector'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Owner Name:</span>
                <span className="font-semibold text-slate-800">{profile?.owner_name || 'M. Lingaswamy'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Start Date:</span>
                <span className="font-semibold text-slate-800">{profile?.business_start_date || 'Not specified'}</span>
              </div>
            </div>
          </div>

          {/* Section 2 */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              B. Lender & Connector
            </h3>
            <div className="space-y-1.5 text-xs">
              <div>
                <span className="text-slate-400 block">Lender Name:</span>
                <span className="font-semibold text-slate-800">{profile?.lender_name || 'ICICI Bank (Default Setup)'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Connector ID:</span>
                <span className="font-semibold text-slate-800">{profile?.connector_id || 'Pending issuance by bank'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Agreement Ref:</span>
                <span className="font-semibold text-slate-800">{profile?.agreement_reference || 'Optional / In progress'}</span>
              </div>
            </div>
          </div>

          {/* Section 3 */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              C. Registered Categories
            </h3>
            <div className="space-y-1.5">
              {activeCategories.length > 0 ? (
                activeCategories.map((c) => (
                  <div key={c} className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{c}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">No loan categories enabled yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
