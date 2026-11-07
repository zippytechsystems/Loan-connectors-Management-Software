import { z } from 'zod';

export const ALLOWED_LOAN_CATEGORIES = [
  'Personal Loan',
  'Business Loan',
  'Home Loan',
  'Loan Against Property',
  'Vehicle Loan',
];

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username / Email is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
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
