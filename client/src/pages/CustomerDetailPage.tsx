import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type { Customer } from '../types';
import {
  Users,
  ArrowLeft,
  Phone,
  MapPin,
  Briefcase,
  Plus,
  FileText,
  Loader2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

export const CustomerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCustomer() {
      if (!id) return;
      setLoading(true);
      try {
        const res = await api.getCustomer(Number(id));
        if (res.success && res.customer) {
          setCustomer(res.customer);
        } else {
          setError(res.message || 'Failed to retrieve customer details');
        }
      } catch (err: any) {
        setError(err.message || 'Error connecting to database');
      } finally {
        setLoading(false);
      }
    }
    loadCustomer();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="w-10 h-10 text-[#087FE5] animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-500">Loading customer profile from MySQL...</p>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="bg-white rounded-3xl p-8 max-w-xl mx-auto text-center shadow-sm border border-slate-200">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">Customer Not Found</h3>
        <p className="text-sm text-slate-500 mt-1">{error || 'This customer record does not exist or has been removed.'}</p>
        <Link
          to="/customers"
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#087FE5] text-white text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Customers
        </Link>
      </div>
    );
  }

  const leads = customer.leads || [];

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
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/customers"
            className="p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs font-bold text-[#087FE5] bg-sky-50 px-2.5 py-0.5 rounded-lg border border-sky-100">
                {customer.customer_code}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                Active Customer
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-1">{customer.full_name}</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/leads', { state: { openNewLeadWithCustomer: customer } })}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#087FE5] to-[#12A8F5] text-white text-xs sm:text-sm font-bold shadow-md hover:brightness-110 transition-all"
          >
            <Plus className="w-4 h-4" /> Add Loan Lead
          </button>
        </div>
      </div>

      {/* Profile Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Contact & Personal Info */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 text-[#071426] font-bold text-sm">
            <Users className="w-4 h-4 text-[#087FE5]" />
            <h3>Personal & Contact</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Primary Mobile</span>
              <span className="text-slate-800 font-bold text-sm mt-0.5 block flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                {customer.mobile_number}
              </span>
            </div>

            {customer.alternate_mobile && (
              <div>
                <span className="text-slate-400 block font-medium">Alternate Contact</span>
                <span className="text-slate-700 font-medium block mt-0.5">{customer.alternate_mobile}</span>
              </div>
            )}

            <div>
              <span className="text-slate-400 block font-medium">Email Address</span>
              <span className="text-slate-800 font-medium block mt-0.5 truncate">
                {customer.email || 'Not provided'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block font-medium">Date of Birth</span>
              <span className="text-slate-700 font-medium block mt-0.5">
                {customer.date_of_birth || 'Not provided'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block font-medium">Customer Source</span>
              <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold">
                {customer.customer_source || 'Direct Enquiry'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Address Information */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 text-[#071426] font-bold text-sm">
            <MapPin className="w-4 h-4 text-[#087FE5]" />
            <h3>Address Information</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Street Address</span>
              <span className="text-slate-800 font-medium block mt-0.5">
                {customer.address || 'Not specified'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block font-medium">Area / Village</span>
              <span className="text-slate-800 font-medium block mt-0.5">
                {customer.area || 'Not specified'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-400 block font-medium">City</span>
                <span className="text-slate-800 font-bold block mt-0.5">
                  {customer.city || 'Not specified'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">District</span>
                <span className="text-slate-800 font-medium block mt-0.5">
                  {customer.district || 'Not specified'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-400 block font-medium">State</span>
                <span className="text-slate-800 font-medium block mt-0.5">
                  {customer.state || 'Telangana'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">PIN Code</span>
                <span className="text-slate-800 font-bold block mt-0.5">
                  {customer.pin_code || '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Professional & Financial Profile */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 text-[#071426] font-bold text-sm">
            <Briefcase className="w-4 h-4 text-[#087FE5]" />
            <h3>Professional & Income</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Employment Type</span>
              <span className="text-slate-800 font-bold text-sm block mt-0.5">
                {customer.employment_type || 'Individual'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block font-medium">Monthly Income</span>
              <span className="text-emerald-700 font-bold text-sm block mt-0.5">
                {customer.monthly_income ? formatCurrency(customer.monthly_income) : 'Not specified'}
              </span>
            </div>

            {customer.employer_name && (
              <div>
                <span className="text-slate-400 block font-medium">Employer / Company</span>
                <span className="text-slate-800 font-medium block mt-0.5">{customer.employer_name}</span>
              </div>
            )}

            {customer.business_name && (
              <div>
                <span className="text-slate-400 block font-medium">Business Name</span>
                <span className="text-slate-800 font-medium block mt-0.5">{customer.business_name}</span>
              </div>
            )}

            {customer.notes && (
              <div>
                <span className="text-slate-400 block font-medium">Notes</span>
                <p className="text-slate-600 italic block mt-0.5">{customer.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Linked Loan Leads Section */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Linked Loan Leads</h2>
            <p className="text-xs text-slate-500">
              Total {leads.length} loan enquiries submitted for this customer
            </p>
          </div>

          <button
            onClick={() => navigate('/leads', { state: { openNewLeadWithCustomer: customer } })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 text-[#087FE5] hover:bg-sky-100 text-xs font-bold transition-all"
          >
            <Plus className="w-4 h-4" /> New Lead
          </button>
        </div>

        {leads.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <FileText className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">No Loan Leads Linked Yet</h4>
            <p className="text-xs text-slate-500 mt-1">
              Create a loan enquiry (Personal, Business, Home, LAP, or Vehicle Loan) for this customer.
            </p>
            <button
              onClick={() => navigate('/leads', { state: { openNewLeadWithCustomer: customer } })}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#087FE5] text-white text-xs font-semibold shadow hover:bg-[#076ec8]"
            >
              <Plus className="w-4 h-4" /> Create First Loan Lead
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Lead ID</th>
                  <th className="py-3 px-4">Loan Category</th>
                  <th className="py-3 px-4">Required Amount</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Enquiry Date</th>
                  <th className="py-3 px-4">Next Follow-up</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {leads.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-xs font-bold text-[#087FE5] bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100">
                        {l.lead_code}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-800">{l.loan_type}</td>
                    <td className="py-3.5 px-4 font-bold text-emerald-700">
                      {formatCurrency(l.required_amount)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getPriorityBadge(l.priority)}`}>
                        {l.priority}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadge(l.lead_status)}`}>
                        {l.lead_status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500">{l.enquiry_date}</td>
                    <td className="py-3.5 px-4 text-xs text-slate-700 font-medium">
                      {l.next_followup_date || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        to={`/leads/${l.id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#087FE5] hover:text-[#065aa3] hover:underline"
                      >
                        <span>View</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
