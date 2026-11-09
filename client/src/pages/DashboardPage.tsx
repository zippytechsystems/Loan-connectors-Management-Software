import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import type { BusinessProfile, Customer, DashboardSummary, LoanLead } from '../types';
import {
  Users,
  ClipboardList,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldAlert,
  Loader2,
  Landmark,
  Sparkles,
  Plus,
  Phone,
  MapPin,
  Award,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentCustomers, setRecentCustomers] = useState<Customer[]>([]);
  const [recentLeads, setRecentLeads] = useState<LoanLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        const [profileRes, summaryRes, custRes, leadRes] = await Promise.all([
          api.getBusinessProfile(),
          api.getDashboardSummary(),
          api.getRecentCustomers(5),
          api.getRecentLeads(5),
        ]);

        if (profileRes.success) setProfile(profileRes.profile || null);
        if (summaryRes.success && summaryRes.data) setSummary(summaryRes.data);
        if (custRes.success && custRes.data) setRecentCustomers(custRes.data);
        if (leadRes.success && leadRes.data) setRecentLeads(leadRes.data);
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard metrics from database');
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="w-10 h-10 text-[#087FE5] animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-500">Connecting to Hostinger MySQL & compiling live metrics...</p>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      New: 'bg-sky-50 text-sky-700 border-sky-200',
      Contacted: 'bg-blue-50 text-blue-700 border-blue-200',
      Interested: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      'Documents Pending': 'bg-amber-50 text-amber-700 border-amber-200',
      Qualified: 'bg-purple-50 text-purple-700 border-purple-200',
      Converted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'Not Interested': 'bg-slate-100 text-slate-600 border-slate-200',
      Duplicate: 'bg-rose-50 text-rose-700 border-rose-200',
      Closed: 'bg-slate-100 text-slate-600 border-slate-200',
    };
    return map[status] || 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#071426] via-[#0d223f] to-[#087FE5] rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 rounded-full bg-[#12A8F5]/20 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 -mb-12 w-48 h-48 rounded-full bg-[#F59A16]/20 blur-xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[11px] font-semibold text-sky-200 mb-3 border border-white/10">
            <Sparkles className="w-3.5 h-3.5 text-[#F59A16]" /> Phase 2 Live Operational Console
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
            Welcome to Zippy Loan Connector
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-300 font-normal leading-relaxed">
            Manage your loan connector clients, active lead pipeline, and lender engagements from one dashboard.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to="/customers"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-[#071426] text-xs sm:text-sm font-bold shadow-md hover:bg-slate-100 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Users className="w-4 h-4 text-[#087FE5]" />
              <span>Customer Directory</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </Link>

            <Link
              to="/leads"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#087FE5] to-[#12A8F5] text-white text-xs sm:text-sm font-bold shadow-md hover:brightness-110 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <ClipboardList className="w-4 h-4" />
              <span>Loan Pipeline</span>
              <ArrowRight className="w-3.5 h-3.5" />
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

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">Notice</p>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Live Pipeline Metric Counters (Strictly MySQL data) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Metric 1: Total Customers */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Clients</span>
            <Users className="w-4 h-4 text-[#087FE5]" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {summary?.total_customers ?? 0}
          </div>
          <span className="text-[10px] text-slate-500 font-medium mt-1">Active customer records</span>
        </div>

        {/* Metric 2: Total Leads */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Leads</span>
            <ClipboardList className="w-4 h-4 text-[#087FE5]" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {summary?.total_leads ?? 0}
          </div>
          <span className="text-[10px] text-slate-500 font-medium mt-1">Total loan enquiries</span>
        </div>

        {/* Metric 3: New Leads */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">New</span>
            <Sparkles className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-extrabold text-sky-600">
            {summary?.new_leads ?? 0}
          </div>
          <span className="text-[10px] text-sky-600/70 font-semibold mt-1">Pending contact</span>
        </div>

        {/* Metric 4: Contacted Leads */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Contacted</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-extrabold text-blue-600">
            {summary?.contacted_leads ?? 0}
          </div>
          <span className="text-[10px] text-blue-600/70 font-semibold mt-1">In discussion</span>
        </div>

        {/* Metric 5: Qualified Leads */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Qualified</span>
            <Award className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-extrabold text-purple-600">
            {summary?.qualified_leads ?? 0}
          </div>
          <span className="text-[10px] text-purple-600/70 font-semibold mt-1">Eligible for login</span>
        </div>

        {/* Metric 6: Converted Leads */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Converted</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600">
            {summary?.converted_leads ?? 0}
          </div>
          <span className="text-[10px] text-emerald-600/70 font-semibold mt-1">Disbursed / Done</span>
        </div>
      </div>

      {/* Status Breakdown Bar */}
      {summary && summary.status_breakdown && (
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2.5">
            Loan Pipeline Status Breakdown
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {Object.entries(summary.status_breakdown).map(([status, count]) => (
              <div
                key={status}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs"
              >
                <span className="font-medium text-slate-700">{status}</span>
                <span className="px-2 py-0.5 rounded-md bg-white border font-bold text-slate-900 shadow-2xs">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Split Section: Recent Customers & Recent Loan Leads */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Customers Table */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Recent Customers</h3>
                <p className="text-xs text-slate-500">Newly registered client profiles</p>
              </div>
              <Link
                to="/customers"
                className="text-xs font-bold text-[#087FE5] hover:underline flex items-center gap-1"
              >
                <span>View Directory</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {recentCustomers.length === 0 ? (
              <div className="text-center py-12 px-4 text-slate-400 text-xs">
                No customer profiles created yet.{' '}
                <Link to="/customers" className="text-[#087FE5] font-bold underline">
                  Add one now
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-sm">
                {recentCustomers.map((c) => (
                  <div key={c.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/customers/${c.id}`}
                          className="font-bold text-slate-900 hover:text-[#087FE5]"
                        >
                          {c.full_name}
                        </Link>
                        <span className="font-mono text-[11px] font-semibold text-slate-400">
                          {c.customer_code}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {c.mobile_number}
                        </span>
                        {c.city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {c.city}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-[#087FE5] border border-sky-100">
                        {c.total_leads || 0} Leads
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 text-right">
            <Link
              to="/customers"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#087FE5] hover:text-[#065aa3]"
            >
              <Plus className="w-3.5 h-3.5" /> Register New Customer
            </Link>
          </div>
        </div>

        {/* Recent Loan Leads Table */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Recent Loan Leads</h3>
                <p className="text-xs text-slate-500">Live enquiries across all loan categories</p>
              </div>
              <Link
                to="/leads"
                className="text-xs font-bold text-[#087FE5] hover:underline flex items-center gap-1"
              >
                <span>View Pipeline</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {recentLeads.length === 0 ? (
              <div className="text-center py-12 px-4 text-slate-400 text-xs">
                No loan leads submitted yet.{' '}
                <Link to="/leads" className="text-[#087FE5] font-bold underline">
                  Log your first lead
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-sm">
                {recentLeads.map((l) => (
                  <div key={l.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/leads/${l.id}`}
                          className="font-bold text-slate-900 hover:text-[#087FE5]"
                        >
                          {l.loan_type}
                        </Link>
                        <span className="font-mono text-[11px] font-semibold text-[#087FE5] bg-sky-50 px-1.5 py-0.5 rounded">
                          {l.lead_code}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        <span>{l.customer_name}</span> •{' '}
                        <span className="font-bold text-emerald-700">{formatCurrency(l.required_amount)}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadge(l.lead_status)}`}>
                        {l.lead_status}
                      </span>
                      <span className="text-[11px] text-slate-400 block mt-0.5">{l.enquiry_date}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 text-right">
            <Link
              to="/leads"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#087FE5] hover:text-[#065aa3]"
            >
              <Plus className="w-3.5 h-3.5" /> Log New Loan Lead
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
