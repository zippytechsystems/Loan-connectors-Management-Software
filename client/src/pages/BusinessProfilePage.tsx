import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { ALLOWED_LOAN_CATEGORIES } from '../types';
import type { BusinessProfile, LoanCategory } from '../types';
import {
  Building2,
  Phone,
  MapPin,
  Landmark,
  Layers,
  FileText,
  Save,
  RotateCcw,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Info,
} from 'lucide-react';

export const BusinessProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [businessName, setBusinessName] = useState<string>('Zippy Loan Connector');
  const [ownerName, setOwnerName] = useState<string>('M. Lingaswamy');
  const [businessType, setBusinessType] = useState<string>('Individual Loan Connector');
  const [businessDescription, setBusinessDescription] = useState<string>('');
  const [businessStartDate, setBusinessStartDate] = useState<string>('');

  const [mobileNumber, setMobileNumber] = useState<string>('');
  const [whatsappNumber, setWhatsappNumber] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [alternateContact, setAlternateContact] = useState<string>('');

  const [addressLine, setAddressLine] = useState<string>('');
  const [area, setArea] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [district, setDistrict] = useState<string>('');
  const [state, setState] = useState<string>('Telangana');
  const [pinCode, setPinCode] = useState<string>('');
  const [country, setCountry] = useState<string>('India');

  const [lenderName, setLenderName] = useState<string>('ICICI Bank');
  const [connectorId, setConnectorId] = useState<string>('');
  const [agreementReference, setAgreementReference] = useState<string>('');
  const [agreementStartDate, setAgreementStartDate] = useState<string>('');
  const [connectorStatus, setConnectorStatus] = useState<BusinessProfile['connector_status']>('Active');
  const [notes, setNotes] = useState<string>('');

  const [loanCategories, setLoanCategories] = useState<LoanCategory[]>([
    'Personal Loan',
    'Business Loan',
    'Home Loan',
  ]);

  const [businessNotes, setBusinessNotes] = useState<string>('');
  const [websiteUrl, setWebsiteUrl] = useState<string>('');
  const [logoPath, setLogoPath] = useState<string>('/logo.svg');

  // Load existing profile from MySQL
  const loadProfile = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.getBusinessProfile();
      if (res.success && res.profile) {
        populateForm(res.profile);
        setProfile(res.profile);
      } else {
        // Defaults if no record exists yet
        setBusinessName('Zippy Loan Connector');
        setOwnerName('M. Lingaswamy');
        setBusinessType('Individual Loan Connector');
        setCountry('India');
        setLenderName('ICICI Bank');
        setConnectorStatus('Active');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to fetch business profile from MySQL.');
    } finally {
      setLoading(false);
    }
  };

  const populateForm = (data: BusinessProfile) => {
    setBusinessName(data.business_name || 'Zippy Loan Connector');
    setOwnerName(data.owner_name || 'M. Lingaswamy');
    setBusinessType(data.business_type || 'Individual Loan Connector');
    setBusinessDescription(data.business_description || '');
    setBusinessStartDate(data.business_start_date ? data.business_start_date.substring(0, 10) : '');

    setMobileNumber(data.mobile_number || '');
    setWhatsappNumber(data.whatsapp_number || '');
    setEmail(data.email || '');
    setAlternateContact(data.alternate_contact || '');

    setAddressLine(data.address_line || '');
    setArea(data.area || '');
    setCity(data.city || '');
    setDistrict(data.district || '');
    setState(data.state || 'Telangana');
    setPinCode(data.pin_code || '');
    setCountry(data.country || 'India');

    setLenderName(data.lender_name || 'ICICI Bank');
    setConnectorId(data.connector_id || '');
    setAgreementReference(data.agreement_reference || '');
    setAgreementStartDate(data.agreement_start_date ? data.agreement_start_date.substring(0, 10) : '');
    setConnectorStatus(data.connector_status || 'Active');
    setNotes(data.business_notes || '');

    // Strictly ensure no Agriculture Loan category
    const validCats = (data.loan_categories || []).filter(
      (cat) => ALLOWED_LOAN_CATEGORIES.includes(cat) && !cat.toLowerCase().includes('agri')
    );
    setLoanCategories(validCats);

    setBusinessNotes(data.business_notes || '');
    setWebsiteUrl(data.website_url || '');
    setLogoPath(data.logo_path || '/logo.svg');
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleToggleCategory = (category: LoanCategory) => {
    // Agriculture loan check guard
    if (category.toLowerCase().includes('agri')) return;

    if (loanCategories.includes(category)) {
      setLoanCategories(loanCategories.filter((c) => c !== category));
    } else {
      setLoanCategories([...loanCategories, category]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    // Client-side validations
    if (!businessName.trim()) {
      setErrorMessage('Business Name is required.');
      return;
    }
    if (!ownerName.trim()) {
      setErrorMessage('Owner Name is required.');
      return;
    }
    if (!mobileNumber.trim()) {
      setErrorMessage('Mobile Number is required.');
      return;
    }
    if (!whatsappNumber.trim()) {
      setErrorMessage('WhatsApp Number is required.');
      return;
    }
    if (!email.trim()) {
      setErrorMessage('Email Address is required.');
      return;
    }

    const payload: Partial<BusinessProfile> = {
      business_name: businessName.trim(),
      owner_name: ownerName.trim(),
      business_type: businessType.trim(),
      business_description: businessDescription.trim() || null,
      business_start_date: businessStartDate || null,
      mobile_number: mobileNumber.trim(),
      whatsapp_number: whatsappNumber.trim(),
      email: email.trim(),
      alternate_contact: alternateContact.trim() || null,
      address_line: addressLine.trim() || null,
      area: area.trim() || null,
      city: city.trim() || null,
      district: district.trim() || null,
      state: state.trim() || null,
      pin_code: pinCode.trim() || null,
      country: country.trim() || 'India',
      lender_name: lenderName.trim() || null,
      connector_id: connectorId.trim() || null,
      agreement_reference: agreementReference.trim() || null,
      agreement_start_date: agreementStartDate || null,
      connector_status: connectorStatus,
      loan_categories: loanCategories,
      business_notes: businessNotes.trim() || notes.trim() || null,
      website_url: websiteUrl.trim() || null,
      logo_path: logoPath.trim() || null,
    };

    setSaving(true);
    try {
      const res = await api.saveBusinessProfile(payload);
      if (res.success && res.profile) {
        setProfile(res.profile);
        populateForm(res.profile);
        setSuccessMessage('Business Profile successfully saved permanently to Hostinger MySQL database!');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const errorDetail = res.errors?.map((err) => `${err.field}: ${err.message}`).join(', ');
        setErrorMessage(errorDetail || res.message || 'Failed to save business profile.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      populateForm(profile);
      setSuccessMessage('Reverted form changes to last saved MySQL profile.');
    } else {
      loadProfile();
    }
    setErrorMessage(null);
  };

  const handleReset = () => {
    setBusinessName('Zippy Loan Connector');
    setOwnerName('M. Lingaswamy');
    setBusinessType('Individual Loan Connector');
    setBusinessDescription('');
    setBusinessStartDate('');
    setMobileNumber('');
    setWhatsappNumber('');
    setEmail('');
    setAlternateContact('');
    setAddressLine('');
    setArea('');
    setCity('');
    setDistrict('');
    setState('Telangana');
    setPinCode('');
    setCountry('India');
    setLenderName('ICICI Bank');
    setConnectorId('');
    setAgreementReference('');
    setAgreementStartDate('');
    setConnectorStatus('Active');
    setLoanCategories(['Personal Loan', 'Business Loan', 'Home Loan']);
    setBusinessNotes('');
    setWebsiteUrl('');
    setLogoPath('/logo.svg');
    setSuccessMessage('Form reset to initial defaults. Click Save Profile to apply.');
    setErrorMessage(null);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="w-10 h-10 text-[#087FE5] animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-500">Fetching business profile from Hostinger MySQL...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#071426]">
            Business Profile Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Configure and maintain verified connector identity and institutional lender linkages.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold self-start sm:self-auto">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Single Record Architecture</span>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-sm text-emerald-800 font-medium">
            {successMessage}
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-sm text-rose-800 font-medium">
            {errorMessage}
          </div>
        </div>
      )}

      {/* Main Profile Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* SECTION A: Business Information */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="p-2 rounded-xl bg-blue-50 text-[#087FE5]">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#071426]">A. Business Information</h2>
              <p className="text-xs text-slate-500">Core business identity registered for the loan connector.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Business Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Zippy Loan Connector"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#087FE5] focus:ring-2 focus:ring-[#087FE5]/20 focus:outline-hidden font-medium text-[#071426]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Owner Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="M. Lingaswamy"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#087FE5] focus:ring-2 focus:ring-[#087FE5]/20 focus:outline-hidden font-medium text-[#071426]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Business Type <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                placeholder="Individual Loan Connector"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#087FE5] focus:ring-2 focus:ring-[#087FE5]/20 focus:outline-hidden font-medium text-[#071426]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Business Start Date (Optional)
              </label>
              <input
                type="date"
                value={businessStartDate}
                onChange={(e) => setBusinessStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#087FE5] focus:ring-2 focus:ring-[#087FE5]/20 focus:outline-hidden font-medium text-[#071426]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Business Description
              </label>
              <textarea
                rows={2}
                value={businessDescription}
                onChange={(e) => setBusinessDescription(e.target.value)}
                placeholder="Brief summary of loan connector services and territory operations..."
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#087FE5] focus:ring-2 focus:ring-[#087FE5]/20 focus:outline-hidden font-medium text-[#071426]"
              />
            </div>
          </div>
        </div>

        {/* SECTION B: Contact Information */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="p-2 rounded-xl bg-blue-50 text-[#087FE5]">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#071426]">B. Contact Information</h2>
              <p className="text-xs text-slate-500">Official communication channels for clients and lenders.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Mobile Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                placeholder="e.g. +91 98490 12345"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#087FE5] focus:ring-2 focus:ring-[#087FE5]/20 focus:outline-hidden font-medium text-[#071426]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                WhatsApp Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="e.g. +91 98490 12345"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#087FE5] focus:ring-2 focus:ring-[#087FE5]/20 focus:outline-hidden font-medium text-[#071426]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. m.lingaswamy@zippyconnector.com"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#087FE5] focus:ring-2 focus:ring-[#087FE5]/20 focus:outline-hidden font-medium text-[#071426]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Alternate Contact Number (Optional)
              </label>
              <input
                type="tel"
                value={alternateContact}
                onChange={(e) => setAlternateContact(e.target.value)}
                placeholder="Optional secondary phone"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#087FE5] focus:ring-2 focus:ring-[#087FE5]/20 focus:outline-hidden font-medium text-[#071426]"
              />
            </div>
          </div>
        </div>

        {/* SECTION C: Business Address */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="p-2 rounded-xl bg-blue-50 text-[#087FE5]">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#071426]">C. Business Address</h2>
              <p className="text-xs text-slate-500">Physical operating location and regional territory.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Address Line
              </label>
              <input
                type="text"
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                placeholder="Door No, Street Name, Landmark"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#087FE5] focus:ring-2 focus:ring-[#087FE5]/20 focus:outline-hidden font-medium text-[#071426]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Village / Area
              </label>
              <input
                type="text"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="e.g. Nacharam"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#087FE5] focus:ring-2 focus:ring-[#087FE5]/20 focus:outline-hidden font-medium text-[#071426]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                City
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Hyderabad"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#087FE5] focus:ring-2 focus:ring-[#087FE5]/20 focus:outline-hidden font-medium text-[#071426]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                District
              </label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="e.g. Medchal-Malkajgiri"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#087FE5] focus:ring-2 focus:ring-[#087FE5]/20 focus:outline-hidden font-medium text-[#071426]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                State
              </label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="Telangana"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#087FE5] focus:ring-2 focus:ring-[#087FE5]/20 focus:outline-hidden font-medium text-[#071426]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                PIN Code
              </label>
              <input
                type="text"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                placeholder="e.g. 500076"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#087FE5] focus:ring-2 focus:ring-[#087FE5]/20 focus:outline-hidden font-medium text-[#071426]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Country
              </label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="India"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#087FE5] focus:ring-2 focus:ring-[#087FE5]/20 focus:outline-hidden font-medium text-[#071426]"
              />
            </div>
          </div>
        </div>

        {/* SECTION D: Lender / Connector Information */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="p-2 rounded-xl bg-blue-50 text-[#087FE5]">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#071426]">D. Lender / Connector Information</h2>
              <p className="text-xs text-slate-500">
                Institutional partnerships and DSA/connector agreement identifiers.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-blue-900 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-[#087FE5] shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Security Protocol:</strong> ICICI Bank is configured as the default partner.
              Connector ID and Agreement Reference are optional until official issuance by the bank.
              Never enter bank passwords, OTPs, or banking login credentials here.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Lender Name
              </label>
              <input
                type="text"
                value={lenderName}
                onChange={(e) => setLenderName(e.target.value)}
                placeholder="e.g. ICICI Bank"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#087FE5] focus:ring-2 focus:ring-[#087FE5]/20 focus:outline-hidden font-medium text-[#071426]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Connector Status
              </label>
              <select
                value={connectorStatus}
                onChange={(e) => setConnectorStatus(e.target.value as any)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#087FE5] focus:ring-2 focus:ring-[#087FE5]/20 focus:outline-hidden font-medium text-[#071426] bg-white cursor-pointer"
              >
                <option value="Active">Active</option>
                <option value="In Process">In Process</option>
                <option value="Agreement Signed">Agreement Signed</option>
                <option value="Pending Verification">Pending Verification</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Connector ID (Optional until received)
              </label>
              <input
                type="text"
                value={connectorId}
                onChange={(e) => setConnectorId(e.target.value)}
                placeholder="Leave blank until bank issues"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#087FE5] focus:ring-2 focus:ring-[#087FE5]/20 focus:outline-hidden font-medium text-[#071426]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Agreement Reference (Optional)
              </label>
              <input
                type="text"
                value={agreementReference}
                onChange={(e) => setAgreementReference(e.target.value)}
                placeholder="Leave blank until contract signed"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#087FE5] focus:ring-2 focus:ring-[#087FE5]/20 focus:outline-hidden font-medium text-[#071426]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Agreement Start Date (Optional)
              </label>
              <input
                type="date"
                value={agreementStartDate}
                onChange={(e) => setAgreementStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#087FE5] focus:ring-2 focus:ring-[#087FE5]/20 focus:outline-hidden font-medium text-[#071426]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Lender Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Branch liaison or regional desk contact details"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#087FE5] focus:ring-2 focus:ring-[#087FE5]/20 focus:outline-hidden font-medium text-[#071426]"
              />
            </div>
          </div>
        </div>

        {/* SECTION E: Loan Categories */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="p-2 rounded-xl bg-blue-50 text-[#087FE5]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#071426]">E. Loan Categories</h2>
              <p className="text-xs text-slate-500">
                Select authorized retail and commercial loan products.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600">
            <strong>Permitted Categories:</strong> Personal Loan, Business Loan, Home Loan, Loan Against Property, Vehicle Loan.
            <span className="text-slate-400 block mt-0.5">Agriculture Loan is strictly excluded per business policy.</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {ALLOWED_LOAN_CATEGORIES.map((category) => {
              const isSelected = loanCategories.includes(category);
              return (
                <button
                  type="button"
                  key={category}
                  onClick={() => handleToggleCategory(category)}
                  className={`flex items-center justify-between p-4 rounded-xl border text-sm font-semibold transition-all cursor-pointer text-left ${
                    isSelected
                      ? 'border-[#087FE5] bg-blue-50/50 text-[#071426] shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
                  }`}
                >
                  <span>{category}</span>
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                      isSelected
                        ? 'bg-[#087FE5] border-[#087FE5] text-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* SECTION F: Additional Information */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="p-2 rounded-xl bg-blue-50 text-[#087FE5]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#071426]">F. Additional Information</h2>
              <p className="text-xs text-slate-500">Internal notes, web presence, and brand assets.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Website URL (Optional)
              </label>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://zippyloanconnector.com"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#087FE5] focus:ring-2 focus:ring-[#087FE5]/20 focus:outline-hidden font-medium text-[#071426]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Profile Logo Path (Optional)
              </label>
              <input
                type="text"
                value={logoPath}
                onChange={(e) => setLogoPath(e.target.value)}
                placeholder="/logo.svg"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#087FE5] focus:ring-2 focus:ring-[#087FE5]/20 focus:outline-hidden font-medium text-[#071426]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Business Notes
              </label>
              <textarea
                rows={3}
                value={businessNotes}
                onChange={(e) => setBusinessNotes(e.target.value)}
                placeholder="Additional business observations, operational instructions, or remarks..."
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#087FE5] focus:ring-2 focus:ring-[#087FE5]/20 focus:outline-hidden font-medium text-[#071426]"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="sticky bottom-4 z-20 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 shadow-lg flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <XCircle className="w-4 h-4 text-slate-500" />
              <span>Cancel</span>
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-slate-400" />
              <span>Reset Form</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#087FE5] to-[#12A8F5] text-white text-xs sm:text-sm font-bold shadow-md hover:from-[#076ecc] hover:to-[#087FE5] transition-all disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving to MySQL...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{profile ? 'Update Profile' : 'Save Profile'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
