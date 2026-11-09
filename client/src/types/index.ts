export interface User {
  id: number;
  username: string;
  role: string;
  createdAt?: string;
}

export type LoanCategory =
  | 'Personal Loan'
  | 'Business Loan'
  | 'Home Loan'
  | 'Loan Against Property'
  | 'Vehicle Loan';

export const ALLOWED_LOAN_CATEGORIES: LoanCategory[] = [
  'Personal Loan',
  'Business Loan',
  'Home Loan',
  'Loan Against Property',
  'Vehicle Loan',
];

export type LeadStatus =
  | 'New'
  | 'Contacted'
  | 'Interested'
  | 'Documents Pending'
  | 'Qualified'
  | 'Converted'
  | 'Not Interested'
  | 'Duplicate'
  | 'Closed';

export const ALLOWED_LEAD_STATUSES: LeadStatus[] = [
  'New',
  'Contacted',
  'Interested',
  'Documents Pending',
  'Qualified',
  'Converted',
  'Not Interested',
  'Duplicate',
  'Closed',
];

export type LeadPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export const ALLOWED_PRIORITIES: LeadPriority[] = ['Low', 'Medium', 'High', 'Urgent'];

export interface BusinessProfile {
  id?: number;
  business_name: string;
  owner_name: string;
  business_type: string;
  business_description?: string | null;
  business_start_date?: string | null;
  mobile_number: string;
  whatsapp_number: string;
  email: string;
  alternate_contact?: string | null;
  address_line?: string | null;
  area?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  pin_code?: string | null;
  country: string;
  lender_name?: string | null;
  connector_id?: string | null;
  agreement_reference?: string | null;
  agreement_start_date?: string | null;
  connector_status: 'Active' | 'In Process' | 'Agreement Signed' | 'Pending Verification' | 'Inactive';
  loan_categories: LoanCategory[];
  business_notes?: string | null;
  website_url?: string | null;
  logo_path?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Customer {
  id: number;
  customer_code: string;
  full_name: string;
  mobile_number: string;
  alternate_mobile?: string | null;
  email?: string | null;
  date_of_birth?: string | null;
  address?: string | null;
  area?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  pin_code?: string | null;
  employment_type?: string | null;
  monthly_income?: number | null;
  employer_name?: string | null;
  business_name?: string | null;
  occupation?: string | null;
  customer_source?: string | null;
  notes?: string | null;
  is_active: number;
  total_leads?: number;
  leads?: LoanLead[];
  created_at?: string;
  updated_at?: string;
}

export interface LeadStatusHistory {
  id: number;
  lead_id: number;
  previous_status?: string | null;
  new_status: string;
  changed_by: string;
  change_notes?: string | null;
  created_at: string;
}

export interface LoanLead {
  id: number;
  lead_code: string;
  customer_id: number;
  loan_type: LoanCategory;
  required_amount: number;
  employment_type?: string | null;
  monthly_income?: number | null;
  business_name?: string | null;
  lead_source?: string | null;
  enquiry_date: string;
  priority: LeadPriority;
  lead_status: LeadStatus;
  next_followup_date?: string | null;
  followup_notes?: string | null;
  admin_id?: number | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined fields from customer
  customer_code?: string;
  customer_name?: string;
  customer_mobile?: string;
  customer_alternate_mobile?: string | null;
  customer_email?: string | null;
  customer_city?: string | null;
  customer_area?: string | null;
  customer_district?: string | null;
  customer_state?: string | null;
  customer_pin?: string | null;
  status_history?: LeadStatusHistory[];
}

export interface DashboardSummary {
  total_customers: number;
  total_leads: number;
  new_leads: number;
  contacted_leads: number;
  qualified_leads: number;
  converted_leads: number;
  status_breakdown: Record<string, number>;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  errors?: Array<{ field: string; message: string }>;
  user?: User;
  profile?: BusinessProfile | null;
  customer?: Customer;
  customers?: Customer[];
  lead?: LoanLead;
  leads?: LoanLead[];
  history?: LeadStatusHistory[];
  pagination?: PaginationMeta;
  data?: T;
  exists?: boolean;
  isDuplicate?: boolean;
  existingCustomer?: Customer | null;
  hasLinkedLeads?: boolean;
}
