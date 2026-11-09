import { z } from 'zod';

export const ALLOWED_LOAN_CATEGORIES = [
  'Personal Loan',
  'Business Loan',
  'Home Loan',
  'Loan Against Property',
  'Vehicle Loan',
];

export const ALLOWED_LEAD_STATUSES = [
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

export const ALLOWED_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username / Email is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

// =============================================================================
// PHASE 2: CUSTOMER VALIDATION SCHEMAS
// =============================================================================
export const customerSchema = z.object({
  full_name: z.string().trim().min(1, 'Customer Full Name is required'),
  mobile_number: z
    .string()
    .trim()
    .min(10, 'Mobile Number must be at least 10 digits')
    .regex(/^[0-9+\-\s()]{10,20}$/, 'Invalid Mobile Number format'),
  alternate_mobile: z
    .string()
    .trim()
    .nullable()
    .optional()
    .refine((v) => !v || /^[0-9+\-\s()]{10,20}$/.test(v), {
      message: 'Invalid Alternate Mobile Number format',
    }),
  email: z
    .string()
    .trim()
    .nullable()
    .optional()
    .refine((v) => !v || z.string().email().safeParse(v).success, {
      message: 'Invalid email address format',
    }),
  date_of_birth: z.string().nullable().optional(),
  address: z.string().trim().nullable().optional(),
  area: z.string().trim().nullable().optional(),
  city: z.string().trim().nullable().optional(),
  district: z.string().trim().nullable().optional(),
  state: z.string().trim().nullable().optional(),
  pin_code: z.string().trim().nullable().optional(),
  employment_type: z.string().trim().nullable().optional(),
  monthly_income: z
    .union([z.number(), z.string()])
    .nullable()
    .optional()
    .transform((val) => (val === '' || val === null || val === undefined ? null : Number(val))),
  employer_name: z.string().trim().nullable().optional(),
  business_name: z.string().trim().nullable().optional(),
  occupation: z.string().trim().nullable().optional(),
  customer_source: z.string().trim().default('Direct Enquiry'),
  notes: z.string().trim().nullable().optional(),
});

export const customerUpdateSchema = customerSchema.partial();

// =============================================================================
// PHASE 2: LEAD VALIDATION SCHEMAS
// =============================================================================
export const leadCreateSchema = z.object({
  customer_id: z.number().int().positive('Valid Customer ID is required').optional(),
  // Support creating a customer inline with the lead
  customer: customerSchema.optional(),
  loan_type: z
    .string()
    .trim()
    .refine(
      (val) => {
        if (val.toLowerCase().includes('agri')) return false;
        return ALLOWED_LOAN_CATEGORIES.includes(val);
      },
      {
        message:
          'Loan type must only be Personal Loan, Business Loan, Home Loan, Loan Against Property, or Vehicle Loan. Agriculture Loan is strictly disallowed.',
      }
    ),
  required_amount: z
    .union([z.number(), z.string()])
    .transform((v) => Number(v))
    .refine((v) => !isNaN(v) && v > 0, 'Required amount must be a positive number'),
  employment_type: z.string().trim().nullable().optional(),
  monthly_income: z
    .union([z.number(), z.string()])
    .nullable()
    .optional()
    .transform((val) => (val === '' || val === null || val === undefined ? null : Number(val))),
  business_name: z.string().trim().nullable().optional(),
  lead_source: z.string().trim().default('Direct Enquiry'),
  enquiry_date: z.string().optional().default(() => new Date().toISOString().substring(0, 10)),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).default('Medium'),
  lead_status: z
    .enum([
      'New',
      'Contacted',
      'Interested',
      'Documents Pending',
      'Qualified',
      'Converted',
      'Not Interested',
      'Duplicate',
      'Closed',
    ])
    .default('New'),
  next_followup_date: z.string().nullable().optional(),
  followup_notes: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
}).refine((data) => data.customer_id || data.customer, {
  message: 'Either customer_id or customer details must be provided',
  path: ['customer_id'],
});

export const leadUpdateSchema = z.object({
  loan_type: z
    .string()
    .trim()
    .refine(
      (val) => {
        if (val.toLowerCase().includes('agri')) return false;
        return ALLOWED_LOAN_CATEGORIES.includes(val);
      },
      {
        message:
          'Loan type must only be Personal Loan, Business Loan, Home Loan, Loan Against Property, or Vehicle Loan. Agriculture Loan is strictly disallowed.',
      }
    ),
  required_amount: z
    .union([z.number(), z.string()])
    .transform((v) => Number(v))
    .refine((v) => !isNaN(v) && v > 0, 'Required amount must be a positive number'),
  employment_type: z.string().trim().nullable().optional(),
  monthly_income: z
    .union([z.number(), z.string()])
    .nullable()
    .optional()
    .transform((val) => (val === '' || val === null || val === undefined ? null : Number(val))),
  business_name: z.string().trim().nullable().optional(),
  lead_source: z.string().trim().default('Direct Enquiry'),
  enquiry_date: z.string(),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).default('Medium'),
  next_followup_date: z.string().nullable().optional(),
  followup_notes: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

export const leadStatusSchema = z.object({
  new_status: z.enum([
    'New',
    'Contacted',
    'Interested',
    'Documents Pending',
    'Qualified',
    'Converted',
    'Not Interested',
    'Duplicate',
    'Closed',
  ]),
  change_notes: z.string().trim().nullable().optional(),
});

export const businessProfileSchema = z.object({
  business_name: z.string().trim().min(1, 'Business Name is required'),
  owner_name: z.string().trim().min(1, 'Owner Name is required'),
  business_type: z.string().trim().min(1, 'Business Type is required'),
  business_description: z.string().trim().nullable().optional(),
  business_start_date: z.string().nullable().optional(),
  mobile_number: z.string().trim().min(10, 'Mobile Number must be at least 10 digits')
    .regex(/^[0-9+\-\s()]{10,20}$/, 'Invalid Mobile Number format'),
  whatsapp_number: z.string().trim().min(10, 'WhatsApp Number must be at least 10 digits')
    .regex(/^[0-9+\-\s()]{10,20}$/, 'Invalid WhatsApp Number format'),
  email: z.string().trim().email('Invalid email address format'),
  alternate_contact: z.string().trim().nullable().optional(),
  address_line: z.string().trim().nullable().optional(),
  area: z.string().trim().nullable().optional(),
  city: z.string().trim().nullable().optional(),
  district: z.string().trim().nullable().optional(),
  state: z.string().trim().nullable().optional(),
  pin_code: z.string().trim().nullable().optional(),
  country: z.string().trim().default('India'),
  lender_name: z.string().trim().nullable().optional(),
  connector_id: z.string().trim().nullable().optional(),
  agreement_reference: z.string().trim().nullable().optional(),
  agreement_start_date: z.string().nullable().optional(),
  connector_status: z.enum(['Active', 'In Process', 'Agreement Signed', 'Pending Verification', 'Inactive']).default('Active'),
  loan_categories: z.array(z.string()).refine(
    (cats) => {
      // Must not contain Agriculture Loan
      const hasAgri = cats.some((c) => c.toLowerCase().includes('agri'));
      if (hasAgri) return false;
      // All items must be in ALLOWED_LOAN_CATEGORIES
      return cats.every((c) => ALLOWED_LOAN_CATEGORIES.includes(c));
    },
    {
      message: 'Loan categories must only be: Personal Loan, Business Loan, Home Loan, Loan Against Property, or Vehicle Loan. Agriculture Loan is strictly disallowed.',
    }
  ).default([]),
  business_notes: z.string().trim().nullable().optional(),
  website_url: z.string().trim().nullable().optional(),
  logo_path: z.string().trim().nullable().optional(),
});

export function validateBody(schema) {
  return (req, res, next) => {
    try {
      req.validatedBody = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: err.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Invalid request payload',
      });
    }
  };
}
