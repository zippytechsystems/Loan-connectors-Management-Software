import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import type { LeadStatus, LoanLead } from '../types';
import { ALLOWED_LEAD_STATUSES } from '../types';
import {
  ArrowLeft,
  User,
  Phone,
  MapPin,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  X,
} from 'lucide-react';

export const LeadDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [lead, setLead] = useState<LoanLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status Change Modal State
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<LeadStatus>('Contacted');
  const [changeNotes, setChangeNotes] = useState('');
  const [submittingStatus, setSubmittingStatus] = useState(false);

  // Follow-up Update Modal State
  const [isFollowupModalOpen, setIsFollowupModalOpen] = useState(false);
  const [followupDate, setFollowupDate] = useState('');
  const [followupNotes, setFollowupNotes] = useState('');
  const [submittingFollowup, setSubmittingFollowup] = useState(false);

  // Toast Notification
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const loadLead = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.getLead(Number(id));
      if (res.success && res.lead) {
        setLead(res.lead);
        setNewStatus(res.lead.lead_status);
        setFollowupDate(res.lead.next_followup_date || '');
        setFollowupNotes(res.lead.followup_notes || '');
      } else {
        setError(res.message || 'Failed to retrieve loan lead details');
      }
    } catch (err: any) {
      setError(err.message || 'Network error fetching loan lead');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLead();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="w-10 h-10 text-[#087FE5] animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-500">Loading lead details from MySQL...</p>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="bg-white rounded-3xl p-8 max-w-xl mx-auto text-center shadow-sm border border-slate-200">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">Lead Not Found</h3>
        <p className="text-sm text-slate-500 mt-1">{error || 'This loan lead record does not exist or has been removed.'}</p>
        <Link
          to="/leads"
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#087FE5] text-white text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Lead Pipeline
        </Link>
      </div>
    );
  }

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingStatus(true);
    try {
      const res = await api.updateLeadStatus(lead.id, newStatus, changeNotes);
      if (res.success) {
        showToast('success', res.message || 'Lead status updated');
        setIsStatusModalOpen(false);
        setChangeNotes('');
        loadLead();
      } else {
        showToast('error', res.message || 'Failed to update lead status');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Network error');
    } finally {
      setSubmittingStatus(false);
    }
  };

  const handleFollowupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingFollowup(true);
    try {
      const res = await api.updateLead(lead.id, {
        loan_type: lead.loan_type,
        required_amount: lead.required_amount,
        employment_type: lead.employment_type,
        monthly_income: lead.monthly_income,
        business_name: lead.business_name,
        lead_source: lead.lead_source,
        enquiry_date: lead.enquiry_date,
        priority: lead.priority,
        next_followup_date: followupDate || null,
        followup_notes: followupNotes || null,
        notes: lead.notes,
      });

      if (res.success) {
        showToast('success', 'Follow-up schedule updated!');
        setIsFollowupModalOpen(false);
        loadLead();
      } else {
        showToast('error', res.message || 'Failed to update follow-up schedule');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Network error');
    } finally {
      setSubmittingFollowup(false);
    }
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

  const getPriorityBadge = (priority: string) => {
    const map: Record<string, string> = {
      Low: 'bg-slate-100 text-slate-600',
      Medium: 'bg-sky-100 text-sky-700',
      High: 'bg-amber-100 text-amber-800 font-bold',
      Urgent: 'bg-rose-100 text-rose-800 font-bold',
    };
    return map[priority] || 'bg-slate-100 text-slate-600';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const statusHistory = lead.status_history || [];

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-white text-sm font-semibold transition-all transform animate-bounce-short ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/leads"
            className="p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs font-bold text-[#087FE5] bg-sky-50 px-2.5 py-0.5 rounded-lg border border-sky-100">
                {lead.lead_code}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadge(lead.lead_status)}`}>
                {lead.lead_status}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getPriorityBadge(lead.priority)}`}>
                Priority: {lead.priority}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-1">
              {lead.loan_type} — {formatCurrency(lead.required_amount)}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsFollowupModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-50 transition-all shadow-sm"
          >
            <Calendar className="w-4 h-4 text-slate-500" />
            <span>Follow-up Date</span>
          </button>
          <button
            onClick={() => setIsStatusModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#087FE5] to-[#12A8F5] text-white text-xs sm:text-sm font-bold shadow-md hover:brightness-110 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Update Status</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Details & History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Customer & Loan Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Customer Info Summary */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-50 text-[#087FE5] flex items-center justify-center font-bold">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{lead.customer_name}</h3>
                  <span className="text-xs font-mono text-slate-400">{lead.customer_code}</span>
                </div>
              </div>

              <Link
                to={`/customers/${lead.customer_id}`}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#087FE5] hover:underline"
              >
                <span>View Full Customer Profile</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Primary Mobile</span>
                <span className="text-slate-800 font-bold mt-0.5 block flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-400" />
                  {lead.customer_mobile}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Email</span>
                <span className="text-slate-800 font-medium mt-0.5 block truncate">
                  {lead.customer_email || 'Not provided'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">City / Location</span>
                <span className="text-slate-800 font-medium mt-0.5 block flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  {lead.customer_city || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Loan Requirements & Details */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100">
              Loan Requirement Specifications
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Loan Category</span>
                <span className="text-slate-900 font-bold text-sm mt-0.5 block">{lead.loan_type}</span>
              </div>

              <div>
                <span className="text-slate-400 block font-medium">Required Loan Amount</span>
                <span className="text-emerald-700 font-extrabold text-base mt-0.5 block">
                  {formatCurrency(lead.required_amount)}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block font-medium">Employment Type</span>
                <span className="text-slate-800 font-semibold mt-0.5 block">
                  {lead.employment_type || 'Salaried'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block font-medium">Monthly Income</span>
                <span className="text-slate-800 font-semibold mt-0.5 block">
                  {lead.monthly_income ? formatCurrency(lead.monthly_income) : '—'}
                </span>
              </div>

              {lead.business_name && (
                <div className="sm:col-span-2">
                  <span className="text-slate-400 block font-medium">Business / Entity Name</span>
                  <span className="text-slate-800 font-medium mt-0.5 block">{lead.business_name}</span>
                </div>
              )}

              <div>
                <span className="text-slate-400 block font-medium">Lead Source</span>
                <span className="text-slate-700 font-medium mt-0.5 block">{lead.lead_source}</span>
              </div>

              <div>
                <span className="text-slate-400 block font-medium">Enquiry Date</span>
                <span className="text-slate-700 font-medium mt-0.5 block">{lead.enquiry_date}</span>
              </div>

              {lead.notes && (
                <div className="sm:col-span-2">
                  <span className="text-slate-400 block font-medium">General Lead Notes</span>
                  <p className="text-slate-700 italic mt-0.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    {lead.notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Next Follow-up Schedule */}
          <div className="bg-gradient-to-br from-white to-sky-50/50 rounded-3xl p-6 shadow-sm border border-sky-100">
            <div className="flex items-center justify-between pb-3 border-b border-sky-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#087FE5]" />
                <h3 className="text-sm font-bold text-slate-900">Next Follow-up Target</h3>
              </div>
              <button
                onClick={() => setIsFollowupModalOpen(true)}
                className="text-xs font-bold text-[#087FE5] hover:underline"
              >
                Change Date
              </button>
            </div>

            <div className="pt-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">Target Date:</span>
                <span className="font-bold text-sm text-slate-900">
                  {lead.next_followup_date || 'No follow-up date currently scheduled'}
                </span>
              </div>

              {lead.followup_notes && (
                <div className="mt-2.5">
                  <span className="text-slate-500 font-medium block">Follow-up Instructions:</span>
                  <p className="text-slate-700 mt-1 bg-white p-3 rounded-xl border border-slate-200">
                    {lead.followup_notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Lead Status Audit History Timeline */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">Status History Timeline</h3>
            </div>

            {statusHistory.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No status changes recorded yet.</p>
            ) : (
              <div className="mt-4 relative pl-4 border-l-2 border-slate-200 space-y-6">
                {statusHistory.map((item, idx) => (
                  <div key={item.id} className="relative group">
                    {/* Circle marker */}
                    <div
                      className={`absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                        idx === 0 ? 'bg-[#087FE5] ring-4 ring-sky-100' : 'bg-slate-300'
                      }`}
                    />

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.previous_status ? (
                          <div className="flex items-center gap-1 text-xs">
                            <span className="text-slate-500 line-through">{item.previous_status}</span>
                            <span className="text-slate-400">→</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${getStatusBadge(item.new_status)}`}>
                              {item.new_status}
                            </span>
                          </div>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${getStatusBadge(item.new_status)}`}>
                            {item.new_status} (Initial)
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-400 flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        <span>
                          {new Date(item.created_at).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span>•</span>
                        <span className="font-semibold text-slate-600">{item.changed_by}</span>
                      </div>

                      {item.change_notes && (
                        <p className="text-xs text-slate-600 mt-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          {item.change_notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Update Status Modal */}
      {isStatusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Update Lead Status</h3>
                <p className="text-xs text-slate-500">Record a new stage in this loan's pipeline.</p>
              </div>
              <button
                onClick={() => setIsStatusModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStatusSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Current Status: <span className="font-bold text-slate-900">{lead.lead_status}</span>
                </label>
                <label className="block text-xs font-semibold text-slate-700 mb-1 mt-3">
                  New Status <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as LeadStatus)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#087FE5]/30 focus:border-[#087FE5]"
                >
                  {ALLOWED_LEAD_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Status Change Notes / Action Summary
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Sent loan application package to bank; waiting for credit appraisal."
                  value={changeNotes}
                  onChange={(e) => setChangeNotes(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#087FE5]/30 focus:border-[#087FE5]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsStatusModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingStatus}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#087FE5] text-white text-xs font-bold shadow hover:bg-[#076ec8] disabled:opacity-50"
                >
                  {submittingStatus && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Status Change</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Follow-up Schedule Modal */}
      {isFollowupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Schedule Next Follow-up</h3>
                <p className="text-xs text-slate-500">Set next call or document pickup target date.</p>
              </div>
              <button
                onClick={() => setIsFollowupModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFollowupSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Next Follow-up Date
                </label>
                <input
                  type="date"
                  value={followupDate}
                  onChange={(e) => setFollowupDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#087FE5]/30 focus:border-[#087FE5]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Follow-up Notes / Agenda
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Call borrower to collect original property documents for login..."
                  value={followupNotes}
                  onChange={(e) => setFollowupNotes(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#087FE5]/30 focus:border-[#087FE5]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFollowupModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingFollowup}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#087FE5] text-white text-xs font-bold shadow hover:bg-[#076ec8] disabled:opacity-50"
                >
                  {submittingFollowup && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Schedule</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
