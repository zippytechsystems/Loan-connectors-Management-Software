import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import type { Customer, LeadPriority, LeadStatus, LoanCategory, LoanLead } from '../types';
import { ALLOWED_LOAN_CATEGORIES, ALLOWED_LEAD_STATUSES, ALLOWED_PRIORITIES } from '../types';
import {
  ClipboardList,
  Search,
  Plus,
  Eye,
  Edit2,
  CheckCircle2,
  ArrowUpDown,
  X,
  Phone,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';

export const LeadsPage: React.FC = () => {
  const location = useLocation();
  const [leads, setLeads] = useState<LoanLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [loanTypeFilter, setLoanTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // New Lead Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingLead, setEditingLead] = useState<LoanLead | null>(null);

  // Customer Choice (Existing vs New)
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing');
  const [existingCustomers, setExistingCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');

  // Form Fields
  const [formData, setFormData] = useState({
    loan_type: 'Personal Loan' as LoanCategory,
    required_amount: '',
    employment_type: 'Salaried',
    monthly_income: '',
    business_name: '',
    lead_source: 'Direct Enquiry',
    enquiry_date: new Date().toISOString().substring(0, 10),
    priority: 'Medium' as LeadPriority,
    lead_status: 'New' as LeadStatus,
    next_followup_date: '',
    followup_notes: '',
    notes: '',
    // Inline new customer fields
    new_full_name: '',
    new_mobile_number: '',
    new_email: '',
    new_city: '',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Quick Status Update Modal State
  const [statusModalLead, setStatusModalLead] = useState<LoanLead | null>(null);
  const [targetStatus, setTargetStatus] = useState<LeadStatus>('Contacted');
  const [statusNotes, setStatusNotes] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Toast Notification
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const loadLeads = async () => {
    setLoading(true);
    try {
      const res = await api.getLeads({
        search,
        loan_type: loanTypeFilter,
        lead_status: statusFilter,
        sort,
        page,
        limit: 10,
      });

      if (res.success && res.leads) {
        setLeads(res.leads);
        if (res.pagination) {
          setTotalPages(res.pagination.totalPages);
          setTotalCount(res.pagination.total);
        }
      } else {
        showToast('error', res.message || 'Failed to fetch loan leads');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to fetch loan leads');
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerList = async () => {
    try {
      const res = await api.getCustomers({ limit: 100 });
      if (res.success && res.customers) {
        setExistingCustomers(res.customers);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadLeads();
  }, [search, loanTypeFilter, statusFilter, priorityFilter, sort, page]);

  // Handle incoming navigation state (e.g. from Customer Details "Add Loan Lead")
  useEffect(() => {
    if (location.state && location.state.openNewLeadWithCustomer) {
      const targetCust: Customer = location.state.openNewLeadWithCustomer;
      openCreateModal(targetCust);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const openCreateModal = (prefillCustomer?: Customer) => {
    setModalMode('create');
    setEditingLead(null);
    setFormError(null);
    setFieldErrors({});
    loadCustomerList();

    if (prefillCustomer) {
      setCustomerMode('existing');
      setSelectedCustomerId(prefillCustomer.id);
      setFormData((prev) => ({
        ...prev,
        loan_type: 'Personal Loan',
        required_amount: '',
        employment_type: prefillCustomer.employment_type || 'Salaried',
        monthly_income: prefillCustomer.monthly_income ? String(prefillCustomer.monthly_income) : '',
        business_name: prefillCustomer.business_name || '',
        lead_source: prefillCustomer.customer_source || 'Direct Enquiry',
        enquiry_date: new Date().toISOString().substring(0, 10),
        priority: 'Medium',
        lead_status: 'New',
        next_followup_date: '',
        followup_notes: '',
        notes: '',
      }));
    } else {
      setCustomerMode('existing');
      setSelectedCustomerId('');
      setFormData({
        loan_type: 'Personal Loan',
        required_amount: '',
        employment_type: 'Salaried',
        monthly_income: '',
        business_name: '',
        lead_source: 'Direct Enquiry',
        enquiry_date: new Date().toISOString().substring(0, 10),
        priority: 'Medium',
        lead_status: 'New',
        next_followup_date: '',
        followup_notes: '',
        notes: '',
        new_full_name: '',
        new_mobile_number: '',
        new_email: '',
        new_city: '',
      });
    }
    setIsModalOpen(true);
  };

  const openEditModal = (lead: LoanLead) => {
    setModalMode('edit');
    setEditingLead(lead);
    setFormError(null);
    setFieldErrors({});
    setFormData({
      loan_type: lead.loan_type,
      required_amount: String(lead.required_amount),
      employment_type: lead.employment_type || 'Salaried',
      monthly_income: lead.monthly_income ? String(lead.monthly_income) : '',
      business_name: lead.business_name || '',
      lead_source: lead.lead_source || 'Direct Enquiry',
      enquiry_date: lead.enquiry_date,
      priority: lead.priority,
      lead_status: lead.lead_status,
      next_followup_date: lead.next_followup_date || '',
      followup_notes: lead.followup_notes || '',
      notes: lead.notes || '',
      new_full_name: '',
      new_mobile_number: '',
      new_email: '',
      new_city: '',
    });
    setIsModalOpen(true);
  };

  const openQuickStatusModal = (lead: LoanLead) => {
    setStatusModalLead(lead);
    setTargetStatus(lead.lead_status);
    setStatusNotes('');
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModalLead) return;
    setUpdatingStatus(true);
    try {
      const res = await api.updateLeadStatus(statusModalLead.id, targetStatus, statusNotes);
      if (res.success) {
        showToast('success', res.message || 'Lead status updated');
        setStatusModalLead(null);
        loadLeads();
      } else {
        showToast('error', res.message || 'Failed to update status');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Status update failed');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    // STRICT CHECK: Agriculture Loan must never be submitted
    if (formData.loan_type.toLowerCase().includes('agri')) {
      setFormError('Agriculture Loan is prohibited.');
      return;
    }

    if (!formData.required_amount || Number(formData.required_amount) <= 0) {
      setFieldErrors((prev) => ({ ...prev, required_amount: 'Please enter a valid loan amount' }));
      return;
    }

    setSaving(true);
    try {
      if (modalMode === 'create') {
        let payload: any = {
          loan_type: formData.loan_type,
          required_amount: Number(formData.required_amount),
          employment_type: formData.employment_type,
          monthly_income: formData.monthly_income ? Number(formData.monthly_income) : null,
          business_name: formData.business_name || null,
          lead_source: formData.lead_source,
          enquiry_date: formData.enquiry_date,
          priority: formData.priority,
          lead_status: formData.lead_status,
          next_followup_date: formData.next_followup_date || null,
          followup_notes: formData.followup_notes || null,
          notes: formData.notes || null,
        };

        if (customerMode === 'existing') {
          if (!selectedCustomerId) {
            setFormError('Please select a customer for this lead');
            setSaving(false);
            return;
          }
          payload.customer_id = Number(selectedCustomerId);
        } else {
          // Inline new customer
          if (!formData.new_full_name.trim() || !formData.new_mobile_number.trim()) {
            setFormError('Customer Full Name and Mobile Number are required');
            setSaving(false);
            return;
          }
          payload.customer = {
            full_name: formData.new_full_name,
            mobile_number: formData.new_mobile_number,
            email: formData.new_email || null,
            city: formData.new_city || null,
            employment_type: formData.employment_type,
            monthly_income: formData.monthly_income ? Number(formData.monthly_income) : null,
            business_name: formData.business_name || null,
            customer_source: formData.lead_source,
          };
        }

        const res = await api.createLead(payload);
        if (res.success) {
          showToast('success', `Lead ${res.lead?.lead_code} logged successfully!`);
          setIsModalOpen(false);
          loadLeads();
        } else {
          setFormError(res.message || 'Failed to create lead');
        }
      } else if (editingLead) {
        const payload = {
          loan_type: formData.loan_type,
          required_amount: Number(formData.required_amount),
          employment_type: formData.employment_type,
          monthly_income: formData.monthly_income ? Number(formData.monthly_income) : null,
          business_name: formData.business_name || null,
          lead_source: formData.lead_source,
          enquiry_date: formData.enquiry_date,
          priority: formData.priority,
          next_followup_date: formData.next_followup_date || null,
          followup_notes: formData.followup_notes || null,
          notes: formData.notes || null,
        };

        const res = await api.updateLead(editingLead.id, payload);
        if (res.success) {
          showToast('success', 'Loan lead updated successfully!');
          setIsModalOpen(false);
          loadLeads();
        } else {
          setFormError(res.message || 'Failed to update lead');
        }
      }
    } catch (err: any) {
      setFormError(err.message || 'An unexpected error occurred');
    } finally {
      setSaving(false);
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

  return (
    <div className="space-y-6 animate-fade-in">
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

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-[#071426] via-[#0d223f] to-[#087FE5] rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-[11px] font-semibold text-sky-200 mb-2 border border-white/10">
            <ClipboardList className="w-3.5 h-3.5 text-[#F59A16]" /> Phase 2 Loan Pipeline
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Loan Lead Management
          </h1>
          <p className="mt-1 text-sm text-slate-300 font-normal">
            Track and process loan leads with audit status history and follow-up schedules.
          </p>
        </div>

        <button
          onClick={() => openCreateModal()}
          className="relative z-10 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-[#087FE5] to-[#12A8F5] text-white text-sm font-bold shadow-lg hover:brightness-110 transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
        >
          <Plus className="w-5 h-5" />
          <span>Add New Lead</span>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 flex flex-col lg:flex-row items-center justify-between gap-3">
        <div className="flex flex-1 w-full flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search code, customer, mobile..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 rounded-xl text-sm bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#087FE5]/30 focus:border-[#087FE5] transition-all"
            />
          </div>

          {/* Loan Type Filter */}
          <select
            value={loanTypeFilter}
            onChange={(e) => {
              setLoanTypeFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#087FE5]/30"
          >
            <option value="">All Loan Types</option>
            {ALLOWED_LOAN_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#087FE5]/30"
          >
            <option value="">All Statuses</option>
            {ALLOWED_LEAD_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#087FE5]/30"
          >
            <option value="">All Priorities</option>
            {ALLOWED_PRIORITIES.map((pr) => (
              <option key={pr} value={pr}>
                {pr}
              </option>
            ))}
          </select>
        </div>

        {/* Sort & Count */}
        <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
          <button
            onClick={() => setSort((prev) => (prev === 'newest' ? 'oldest' : 'newest'))}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
            <span>{sort === 'newest' ? 'Newest First' : 'Oldest First'}</span>
          </button>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-2 rounded-xl">
            {totalCount} Leads
          </span>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-[#087FE5] animate-spin mb-3" />
            <p className="text-sm font-medium text-slate-500">Loading loan leads from MySQL...</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-20 px-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <ClipboardList className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800">No Loan Leads Found</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
              {search || loanTypeFilter || statusFilter
                ? 'No loan leads match your filter selection. Try clearing filters.'
                : 'Log a new loan enquiry for an existing or new customer.'}
            </p>
            {!search && !loanTypeFilter && !statusFilter && (
              <button
                onClick={() => openCreateModal()}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#087FE5] text-white text-xs font-semibold shadow hover:bg-[#076ec8]"
              >
                <Plus className="w-4 h-4" /> Add First Lead
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Lead ID</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Loan Type</th>
                  <th className="py-3.5 px-4">Required Amount</th>
                  <th className="py-3.5 px-4">Priority</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Next Follow-up</th>
                  <th className="py-3.5 px-4">Enquiry Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {leads.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Lead Code */}
                    <td className="py-3.5 px-4">
                      <Link
                        to={`/leads/${l.id}`}
                        className="font-mono text-xs font-bold text-[#087FE5] bg-sky-50 px-2 py-1 rounded-md border border-sky-100 hover:bg-sky-100"
                      >
                        {l.lead_code}
                      </Link>
                    </td>

                    {/* Customer */}
                    <td className="py-3.5 px-4">
                      <Link
                        to={`/customers/${l.customer_id}`}
                        className="font-bold text-slate-900 hover:text-[#087FE5] transition-colors block"
                      >
                        {l.customer_name}
                      </Link>
                      <span className="text-xs text-slate-500 block flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {l.customer_mobile}
                      </span>
                    </td>

                    {/* Loan Type */}
                    <td className="py-3.5 px-4 font-semibold text-slate-800">{l.loan_type}</td>

                    {/* Amount */}
                    <td className="py-3.5 px-4 font-bold text-emerald-700">
                      {formatCurrency(l.required_amount)}
                    </td>

                    {/* Priority */}
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getPriorityBadge(l.priority)}`}>
                        {l.priority}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => openQuickStatusModal(l)}
                        title="Click to update status"
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border transition-transform hover:scale-105 ${getStatusBadge(
                          l.lead_status
                        )}`}
                      >
                        <span>{l.lead_status}</span>
                        <RefreshCw className="w-2.5 h-2.5 opacity-60" />
                      </button>
                    </td>

                    {/* Next Follow-up */}
                    <td className="py-3.5 px-4 text-xs font-medium text-slate-700">
                      {l.next_followup_date || <span className="text-slate-400">—</span>}
                    </td>

                    {/* Enquiry Date */}
                    <td className="py-3.5 px-4 text-xs text-slate-500">{l.enquiry_date}</td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          to={`/leads/${l.id}`}
                          title="View Details & History"
                          className="p-1.5 rounded-lg text-slate-600 hover:text-[#087FE5] hover:bg-sky-50 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => openEditModal(l)}
                          title="Edit Lead"
                          className="p-1.5 rounded-lg text-slate-600 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 font-semibold disabled:opacity-40 hover:bg-slate-50 transition-all"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 font-semibold disabled:opacity-40 hover:bg-slate-50 transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Lead Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full my-8 overflow-hidden border border-slate-200 animate-scale-up">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#071426] to-[#087FE5] px-6 py-5 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">
                  {modalMode === 'create' ? 'Create New Loan Lead' : `Edit Lead (${editingLead?.lead_code})`}
                </h3>
                <p className="text-xs text-sky-200">
                  {modalMode === 'create'
                    ? 'Log a new loan enquiry with customer details and follow-up targets.'
                    : 'Update loan requirement specifications.'}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Customer Selection (Only in Create Mode) */}
              {modalMode === 'create' && (
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                    1. Customer Selection
                  </h4>
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setCustomerMode('existing')}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                        customerMode === 'existing'
                          ? 'bg-[#087FE5] text-white border-[#087FE5] shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Select Existing Customer
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerMode('new')}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                        customerMode === 'new'
                          ? 'bg-[#087FE5] text-white border-[#087FE5] shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      + Register New Customer
                    </button>
                  </div>

                  {customerMode === 'existing' ? (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Select Customer <span className="text-rose-500">*</span>
                      </label>
                      <select
                        required
                        value={selectedCustomerId}
                        onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#087FE5]/30 focus:border-[#087FE5]"
                      >
                        <option value="">-- Choose registered customer --</option>
                        {existingCustomers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.customer_code} — {c.full_name} ({c.mobile_number}) - {c.city || 'No City'}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Customer Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Full name"
                          value={formData.new_full_name}
                          onChange={(e) => setFormData({ ...formData, new_full_name: e.target.value })}
                          className="w-full px-3 py-1.5 text-sm rounded-xl border border-slate-200 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Mobile Number <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="tel"
                          required
                          placeholder="10 digits"
                          value={formData.new_mobile_number}
                          onChange={(e) => setFormData({ ...formData, new_mobile_number: e.target.value })}
                          className="w-full px-3 py-1.5 text-sm rounded-xl border border-slate-200 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                        <input
                          type="email"
                          placeholder="Optional email"
                          value={formData.new_email}
                          onChange={(e) => setFormData({ ...formData, new_email: e.target.value })}
                          className="w-full px-3 py-1.5 text-sm rounded-xl border border-slate-200 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                        <input
                          type="text"
                          placeholder="City / Location"
                          value={formData.new_city}
                          onChange={(e) => setFormData({ ...formData, new_city: e.target.value })}
                          className="w-full px-3 py-1.5 text-sm rounded-xl border border-slate-200 bg-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Loan Information */}
              <div className="pt-2 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                  2. Loan Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Strict Loan Category Dropdown (NO Agriculture Loan) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Loan Category <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.loan_type}
                      onChange={(e) =>
                        setFormData({ ...formData, loan_type: e.target.value as LoanCategory })
                      }
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#087FE5]/30 focus:border-[#087FE5]"
                    >
                      {ALLOWED_LOAN_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Agriculture Loan is strictly prohibited and excluded.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Required Loan Amount (₹) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 500000"
                      value={formData.required_amount}
                      onChange={(e) => setFormData({ ...formData, required_amount: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#087FE5]/30 focus:border-[#087FE5]"
                    />
                    {fieldErrors.required_amount && (
                      <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.required_amount}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Employment Type</label>
                    <select
                      value={formData.employment_type}
                      onChange={(e) => setFormData({ ...formData, employment_type: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#087FE5]/30 focus:border-[#087FE5]"
                    >
                      <option value="Salaried">Salaried</option>
                      <option value="Self-Employed">Self-Employed</option>
                      <option value="Business Owner">Business Owner</option>
                      <option value="Professional (Doctor/CA)">Professional (Doctor/CA)</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Monthly Income (₹)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 60000"
                      value={formData.monthly_income}
                      onChange={(e) => setFormData({ ...formData, monthly_income: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#087FE5]/30 focus:border-[#087FE5]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Business Name</label>
                    <input
                      type="text"
                      placeholder="Optional business entity name"
                      value={formData.business_name}
                      onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#087FE5]/30 focus:border-[#087FE5]"
                    />
                  </div>
                </div>
              </div>

              {/* Lead Information */}
              <div className="pt-2 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                  3. Lead Status & Follow-up Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Lead Source</label>
                    <select
                      value={formData.lead_source}
                      onChange={(e) => setFormData({ ...formData, lead_source: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#087FE5]/30 focus:border-[#087FE5]"
                    >
                      <option value="Direct Enquiry">Direct Enquiry</option>
                      <option value="Customer Referral">Customer Referral</option>
                      <option value="Social Media">Social Media</option>
                      <option value="Cold Call">Cold Call</option>
                      <option value="Channel Partner">Channel Partner</option>
                      <option value="Website Walk-in">Website Walk-in</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Enquiry Date</label>
                    <input
                      type="date"
                      required
                      value={formData.enquiry_date}
                      onChange={(e) => setFormData({ ...formData, enquiry_date: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#087FE5]/30 focus:border-[#087FE5]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
                    <select
                      value={formData.priority}
                      onChange={(e) =>
                        setFormData({ ...formData, priority: e.target.value as LeadPriority })
                      }
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#087FE5]/30 focus:border-[#087FE5]"
                    >
                      {ALLOWED_PRIORITIES.map((pr) => (
                        <option key={pr} value={pr}>
                          {pr}
                        </option>
                      ))}
                    </select>
                  </div>

                  {modalMode === 'create' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Status</label>
                      <select
                        value={formData.lead_status}
                        onChange={(e) =>
                          setFormData({ ...formData, lead_status: e.target.value as LeadStatus })
                        }
                        className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#087FE5]/30 focus:border-[#087FE5]"
                      >
                        {ALLOWED_LEAD_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Next Follow-up Date</label>
                    <input
                      type="date"
                      value={formData.next_followup_date}
                      onChange={(e) => setFormData({ ...formData, next_followup_date: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#087FE5]/30 focus:border-[#087FE5]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Follow-up Notes</label>
                    <input
                      type="text"
                      placeholder="e.g. Call back on Monday after 3 PM regarding salary slips"
                      value={formData.followup_notes}
                      onChange={(e) => setFormData({ ...formData, followup_notes: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#087FE5]/30 focus:border-[#087FE5]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">General Notes</label>
                    <textarea
                      rows={2}
                      placeholder="Requirements, customer expectations, lender preferences..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#087FE5]/30 focus:border-[#087FE5]"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#087FE5] to-[#12A8F5] text-white text-sm font-bold shadow-md hover:brightness-110 disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{modalMode === 'create' ? 'Create Lead' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Status Update Modal */}
      {statusModalLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Update Lead Status</h3>
                <p className="text-xs text-slate-500">
                  {statusModalLead.lead_code} — {statusModalLead.customer_name}
                </p>
              </div>
              <button
                onClick={() => setStatusModalLead(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStatusSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Current Status:{' '}
                  <span className="font-bold text-slate-900">{statusModalLead.lead_status}</span>
                </label>
                <label className="block text-xs font-semibold text-slate-700 mb-1 mt-3">
                  New Status <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value as LeadStatus)}
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
                  Status Change Notes / Reason
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Customer provided 3 months bank statement; moving to Documents Pending..."
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#087FE5]/30 focus:border-[#087FE5]"
                />
                <span className="text-[11px] text-slate-400 block mt-1">
                  This change will be permanently logged in the status audit timeline.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setStatusModalLead(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingStatus}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#087FE5] text-white text-xs font-bold shadow hover:bg-[#076ec8] disabled:opacity-50"
                >
                  {updatingStatus && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Record Status Change</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
