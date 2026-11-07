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

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  errors?: Array<{ field: string; message: string }>;
  user?: User;
  profile?: BusinessProfile | null;
  data?: T;
}
