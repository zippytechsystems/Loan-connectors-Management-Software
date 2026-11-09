import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type { Customer } from '../types';
import {
  Users,
  Search,
  Plus,
  Eye,
  Edit2,
  Trash2,
  AlertTriangle,
  Loader2,
  ArrowUpDown,
  X,
  Phone,
  Mail,
  MapPin,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export const CustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    full_name: '',
    mobile_number: '',
    alternate_mobile: '',
    email: '',
    date_of_birth: '',
    address: '',
    area: '',
    city: '',
    district: '',
    state: 'Telangana',
    pin_code: '',
    employment_type: 'Salaried',
    monthly_income: '',
    employer_name: '',
    business_name: '',
    occupation: '',
    customer_source: 'Direct Enquiry',
    notes: '',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Duplicate Warning State
  const [duplicateWarning, setDuplicateWarning] = useState<Customer | null>(null);

  // Delete Dialog State
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toast Notification
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await api.getCustomers({
        search,
        city: cityFilter,
        sort,
        page,
        limit: 10,
      });

      if (res.success && res.customers) {
        setCustomers(res.customers);
        if (res.pagination) {
          setTotalPages(res.pagination.totalPages);
          setTotalCount(res.pagination.total);
        }
      } else {
        showToast('error', res.message || 'Failed to fetch customers');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [search, cityFilter, sort, page]);

  const openCreateModal = () => {
    setModalMode('create');
    setEditingCustomer(null);
    setDuplicateWarning(null);
    setFormError(null);
    setFieldErrors({});
    setFormData({
      full_name: '',
      mobile_number: '',
      alternate_mobile: '',
      email: '',
      date_of_birth: '',
      address: '',
      area: '',
      city: '',
      district: '',
      state: 'Telangana',
      pin_code: '',
      employment_type: 'Salaried',
      monthly_income: '',
      employer_name: '',
      business_name: '',
      occupation: '',
      customer_source: 'Direct Enquiry',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (c: Customer) => {
    setModalMode('edit');
    setEditingCustomer(c);
    setDuplicateWarning(null);
    setFormError(null);
    setFieldErrors({});
    setFormData({
      full_name: c.full_name || '',
      mobile_number: c.mobile_number || '',
      alternate_mobile: c.alternate_mobile || '',
      email: c.email || '',
      date_of_birth: c.date_of_birth || '',
      address: c.address || '',
      area: c.area || '',
      city: c.city || '',
      district: c.district || '',
      state: c.state || 'Telangana',
      pin_code: c.pin_code || '',
      employment_type: c.employment_type || 'Salaried',
      monthly_income: c.monthly_income ? String(c.monthly_income) : '',
      employer_name: c.employer_name || '',
      business_name: c.business_name || '',
      occupation: c.occupation || '',
      customer_source: c.customer_source || 'Direct Enquiry',
      notes: c.notes || '',
    });
    setIsModalOpen(true);
  };

  const checkDuplicate = async (mobile: string, email?: string) => {
    if (!mobile || mobile.length < 10) return;
    try {
      const res = await api.checkCustomerDuplicate({
        mobile_number: mobile,
        email: email || undefined,
        excludeId: editingCustomer ? editingCustomer.id : undefined,
      });

      if (res.success && res.exists && res.customer) {
        setDuplicateWarning(res.customer);
      } else {
        setDuplicateWarning(null);
      }
    } catch (e) {
      // Ignore background check failure
    }
  };

  const handleSubmit = async (e: React.FormEvent, force = false) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    // Basic frontend checks
    if (!formData.full_name.trim()) {
      setFieldErrors((prev) => ({ ...prev, full_name: 'Full Name is required' }));
      return;
    }
    if (!formData.mobile_number.trim() || formData.mobile_number.length < 10) {
      setFieldErrors((prev) => ({ ...prev, mobile_number: 'Mobile Number must be at least 10 digits' }));
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<Customer> = {
        ...formData,
        monthly_income: formData.monthly_income ? Number(formData.monthly_income) : null,
      };

      if (modalMode === 'create') {
        const res = await api.createCustomer(payload, force);
        if (res.success) {
          showToast('success', `Customer ${res.customer?.full_name} registered successfully!`);
          setIsModalOpen(false);
          loadCustomers();
        } else if (res.isDuplicate && res.existingCustomer) {
          setDuplicateWarning(res.existingCustomer);
          setFormError(res.message || 'Duplicate customer detected');
        } else {
          setFormError(res.message || 'Failed to register customer');
          if (res.errors) {
            const errs: Record<string, string> = {};
            res.errors.forEach((err) => (errs[err.field] = err.message));
            setFieldErrors(errs);
          }
        }
      } else if (editingCustomer) {
        const res = await api.updateCustomer(editingCustomer.id, payload, force);
        if (res.success) {
          showToast('success', 'Customer profile updated successfully!');
          setIsModalOpen(false);
          loadCustomers();
        } else if (res.isDuplicate && res.existingCustomer) {
          setDuplicateWarning(res.existingCustomer);
          setFormError(res.message || 'Duplicate phone/email detected');
        } else {
          setFormError(res.message || 'Failed to update customer');
          if (res.errors) {
            const errs: Record<string, string> = {};
            res.errors.forEach((err) => (errs[err.field] = err.message));
            setFieldErrors(errs);
          }
        }
      }
    } catch (err: any) {
      setFormError(err.message || 'An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await api.deleteCustomer(deleteTarget.id);
      if (res.success) {
        showToast('success', res.message || 'Customer safely removed');
        setDeleteTarget(null);
        loadCustomers();
      } else {
        showToast('error', res.message || 'Failed to remove customer');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete customer');
    } finally {
      setDeleting(false);
    }
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
            <Users className="w-3.5 h-3.5 text-[#F59A16]" /> Phase 2 Customer Directory
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Customer Management
          </h1>
          <p className="mt-1 text-sm text-slate-300 font-normal">
            Register and manage customer profiles with real-time lead counts.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="relative z-10 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-[#087FE5] to-[#12A8F5] text-white text-sm font-bold shadow-lg hover:brightness-110 transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
        >
          <Plus className="w-5 h-5" />
          <span>Add New Customer</span>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-1 w-full flex-col sm:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, mobile, code, email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 rounded-xl text-sm bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#087FE5]/30 focus:border-[#087FE5] transition-all"
            />
          </div>

          {/* City Filter */}
          <div className="relative w-full sm:w-48">
            <input
              type="text"
              placeholder="Filter by city..."
              value={cityFilter}
              onChange={(e) => {
                setCityFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3.5 py-2 rounded-xl text-sm bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#087FE5]/30 focus:border-[#087FE5] transition-all"
            />
          </div>
        </div>

        {/* Sort & Stats */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <button
            onClick={() => setSort((prev) => (prev === 'newest' ? 'oldest' : 'newest'))}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
            <span>Sort: {sort === 'newest' ? 'Newest First' : 'Oldest First'}</span>
          </button>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-2 rounded-xl">
            {totalCount} Total
          </span>
        </div>
      </div>

      {/* Customer Data Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-[#087FE5] animate-spin mb-3" />
            <p className="text-sm font-medium text-slate-500">Loading customers from MySQL...</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-20 px-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800">No Customers Found</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
              {search || cityFilter
                ? 'No customers match your search criteria. Try clearing the filters.'
                : 'Start by adding your first customer to begin managing loan leads.'}
            </p>
            {!search && !cityFilter && (
              <button
                onClick={openCreateModal}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#087FE5] text-white text-xs font-semibold shadow hover:bg-[#076ec8]"
              >
                <Plus className="w-4 h-4" /> Add First Customer
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Customer ID</th>
                  <th className="py-3.5 px-4">Full Name</th>
                  <th className="py-3.5 px-4">Contact</th>
                  <th className="py-3.5 px-4">City</th>
                  <th className="py-3.5 px-4 text-center">Loan Leads</th>
                  <th className="py-3.5 px-4">Created Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* ID */}
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-xs font-bold text-[#087FE5] bg-sky-50 px-2 py-1 rounded-md border border-sky-100">
                        {c.customer_code}
                      </span>
                    </td>

                    {/* Name */}
                    <td className="py-3.5 px-4">
                      <Link
                        to={`/customers/${c.id}`}
                        className="font-bold text-slate-900 hover:text-[#087FE5] transition-colors block"
                      >
                        {c.full_name}
                      </Link>
                      <span className="text-xs text-slate-500 block">{c.employment_type || 'Individual'}</span>
                    </td>

                    {/* Contact */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{c.mobile_number}</span>
                      </div>
                      {c.email && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span className="truncate max-w-[180px]">{c.email}</span>
                        </div>
                      )}
                    </td>

                    {/* City */}
                    <td className="py-3.5 px-4 text-xs font-medium text-slate-700">
                      {c.city ? (
                        <div className="flex items-center gap-1 text-slate-700">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{c.city}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Total Leads */}
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          (c.total_leads || 0) > 0
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {c.total_leads || 0}
                      </span>
                    </td>

                    {/* Created Date */}
                    <td className="py-3.5 px-4 text-xs text-slate-500">
                      {c.created_at ? new Date(c.created_at).toLocaleDateString('en-IN') : '—'}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          to={`/customers/${c.id}`}
                          title="View Profile & Leads"
                          className="p-1.5 rounded-lg text-slate-600 hover:text-[#087FE5] hover:bg-sky-50 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => openEditModal(c)}
                          title="Edit Customer"
                          className="p-1.5 rounded-lg text-slate-600 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(c)}
                          title="Archive / Remove"
                          className="p-1.5 rounded-lg text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
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

      {/* Customer Registration / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full my-8 overflow-hidden border border-slate-200 animate-scale-up">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#071426] to-[#087FE5] px-6 py-5 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">
                  {modalMode === 'create' ? 'Register New Customer' : `Edit Customer (${editingCustomer?.customer_code})`}
                </h3>
                <p className="text-xs text-sky-200">
                  {modalMode === 'create'
                    ? 'Enter customer profile details. A unique ID will be automatically generated.'
                    : 'Update existing customer details and contact information.'}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Duplicate Alert Banner */}
            {duplicateWarning && (
              <div className="mx-6 mt-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 text-xs text-amber-900">
                  <p className="font-bold">Possible Duplicate Customer Detected!</p>
                  <p className="mt-0.5">
                    A customer with this phone number already exists:{' '}
                    <strong>{duplicateWarning.customer_code}</strong> ({duplicateWarning.full_name}).
                  </p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsModalOpen(false);
                        navigate(`/customers/${duplicateWarning.id}`);
                      }}
                      className="px-3 py-1 rounded-lg bg-amber-600 text-white font-bold hover:bg-amber-700"
                    >
                      View Existing Customer
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleSubmit(e, true)}
                      className="px-3 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 font-semibold hover:bg-amber-100"
                    >
                      Proceed Anyway
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* General Form Error */}
            {formError && !duplicateWarning && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Modal Body Form */}
            <form onSubmit={(e) => handleSubmit(e, false)} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Section 1: Personal Details */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  1. Personal & Contact Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kumar"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className={`w-full px-3.5 py-2 text-sm rounded-xl border bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 ${
                        fieldErrors.full_name
                          ? 'border-rose-400 focus:ring-rose-200'
                          : 'border-slate-200 focus:ring-[#087FE5]/30 focus:border-[#087FE5]'
                      }`}
                    />
                    {fieldErrors.full_name && (
                      <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.full_name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Mobile Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="10-digit mobile number"
                      value={formData.mobile_number}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({ ...formData, mobile_number: val });
                        if (val.length >= 10) checkDuplicate(val, formData.email);
                      }}
                      className={`w-full px-3.5 py-2 text-sm rounded-xl border bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 ${
                        fieldErrors.mobile_number
                          ? 'border-rose-400 focus:ring-rose-200'
                          : 'border-slate-200 focus:ring-[#087FE5]/30 focus:border-[#087FE5]'
                      }`}
                    />
                    {fieldErrors.mobile_number && (
                      <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.mobile_number}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Alternate Mobile</label>
                    <input
                      type="tel"
                      placeholder="Optional secondary contact"
                      value={formData.alternate_mobile}
                      onChange={(e) => setFormData({ ...formData, alternate_mobile: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#087FE5]/30 focus:border-[#087FE5]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      placeholder="customer@example.com"
                      value={formData.email}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({ ...formData, email: val });
                        if (formData.mobile_number.length >= 10) checkDuplicate(formData.mobile_number, val);
                      }}
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#087FE5]/30 focus:border-[#087FE5]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Date of Birth</label>
                    <input
                      type="date"
                      value={formData.date_of_birth}
                      onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#087FE5]/30 focus:border-[#087FE5]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Source</label>
                    <select
                      value={formData.customer_source}
                      onChange={(e) => setFormData({ ...formData, customer_source: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#087FE5]/30 focus:border-[#087FE5]"
                    >
                      <option value="Direct Enquiry">Direct Enquiry</option>
                      <option value="Customer Referral">Customer Referral</option>
                      <option value="Social Media">Social Media</option>
                      <option value="Cold Call">Cold Call</option>
                      <option value="Channel Partner">Channel Partner</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Address Information */}
              <div className="pt-2 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  2. Address Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Street Address</label>
                    <input
                      type="text"
                      placeholder="House No, Street, Landmark"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#087FE5]/30 focus:border-[#087FE5]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Area / Village</label>
                    <input
                      type="text"
                      placeholder="Area or Village name"
                      value={formData.area}
                      onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#087FE5]/30 focus:border-[#087FE5]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">City / Town</label>
                    <input
                      type="text"
                      placeholder="e.g. Hyderabad"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#087FE5]/30 focus:border-[#087FE5]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">District</label>
                    <input
                      type="text"
                      placeholder="e.g. Medchal"
                      value={formData.district}
                      onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#087FE5]/30 focus:border-[#087FE5]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">PIN Code</label>
                    <input
                      type="text"
                      placeholder="6-digit PIN code"
                      value={formData.pin_code}
                      onChange={(e) => setFormData({ ...formData, pin_code: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#087FE5]/30 focus:border-[#087FE5]"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Professional & Financial Details */}
              <div className="pt-2 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  3. Professional & Income Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
                      <option value="Professional (Doctor/CA/Lawyer)">Professional (Doctor/CA/Lawyer)</option>
                      <option value="Freelancer/Consultant">Freelancer/Consultant</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Monthly Income (₹)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 50000"
                      value={formData.monthly_income}
                      onChange={(e) => setFormData({ ...formData, monthly_income: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#087FE5]/30 focus:border-[#087FE5]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Employer / Company Name
                    </label>
                    <input
                      type="text"
                      placeholder="Optional company name"
                      value={formData.employer_name}
                      onChange={(e) => setFormData({ ...formData, employer_name: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#087FE5]/30 focus:border-[#087FE5]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Business Name</label>
                    <input
                      type="text"
                      placeholder="Optional business entity name"
                      value={formData.business_name}
                      onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#087FE5]/30 focus:border-[#087FE5]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Preferences</label>
                    <textarea
                      rows={2}
                      placeholder="Add any specific customer notes or requirements..."
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
                  <span>{modalMode === 'create' ? 'Save Customer' : 'Update Customer'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Archival Confirmation Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-center text-lg font-bold text-slate-900">Archive Customer?</h3>
            <p className="text-center text-xs text-slate-500 mt-2 leading-relaxed">
              Are you sure you want to remove <strong>{deleteTarget.full_name}</strong> (
              {deleteTarget.customer_code})?
            </p>

            {(deleteTarget.total_leads || 0) > 0 && (
              <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                <strong>Notice:</strong> This customer has{' '}
                <strong>{deleteTarget.total_leads} linked loan lead(s)</strong>. To protect audit integrity, the
                record will be safely archived without deleting historical loan leads.
              </div>
            )}

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Archive</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
