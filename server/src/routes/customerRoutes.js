import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, customerSchema, customerUpdateSchema } from '../middleware/validation.js';
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  checkCustomerDuplicate,
  logAuditEvent,
} from '../db/queries.js';

const router = express.Router();

// All customer routes require authentication
router.use(requireAuth);

/**
 * GET /api/customers
 * Paginated list of active customers with optional search and city filters
 */
router.get('/', async (req, res) => {
  try {
    const { search = '', city = '', sort = 'newest', page = 1, limit = 10 } = req.query;
    const data = await getCustomers({
      search: String(search),
      city: String(city),
      sort: String(sort),
      page: Number(page) || 1,
      limit: Number(limit) || 10,
    });

    res.json({
      success: true,
      customers: data.customers,
      pagination: data.pagination,
    });
  } catch (err) {
    console.error('[CUSTOMERS] Error fetching list:', err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve customers from database',
      error: err.message,
    });
  }
});

/**
 * GET /api/customers/check-duplicate
 * Checks if a mobile number or email already belongs to an existing active customer
 */
router.get('/check-duplicate', async (req, res) => {
  try {
    const { mobile_number, email, excludeId } = req.query;
    if (!mobile_number && !email) {
      return res.status(400).json({
        success: false,
        message: 'mobile_number or email query parameter is required',
      });
    }

    const existing = await checkCustomerDuplicate({
      mobile_number: mobile_number ? String(mobile_number) : null,
      email: email ? String(email) : null,
      excludeId: excludeId ? Number(excludeId) : null,
    });

    res.json({
      success: true,
      exists: !!existing,
      customer: existing || null,
    });
  } catch (err) {
    console.error('[CUSTOMERS] Duplicate check failed:', err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to check customer duplication',
    });
  }
});

/**
 * GET /api/customers/:id
 * Retrieve single customer with all linked loan leads
 */
router.get('/:id', async (req, res) => {
  try {
    const customerId = Number(req.params.id);
    if (isNaN(customerId)) {
      return res.status(400).json({ success: false, message: 'Invalid customer ID' });
    }

    const customer = await getCustomerById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    res.json({
      success: true,
      customer,
    });
  } catch (err) {
    console.error('[CUSTOMERS] Error fetching customer:', err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve customer details',
    });
  }
});

/**
 * POST /api/customers
 * Register a new customer
 */
router.post('/', validateBody(customerSchema), async (req, res) => {
  try {
    const body = req.validatedBody;

    // Check duplicate mobile or email
    const duplicate = await checkCustomerDuplicate({
      mobile_number: body.mobile_number,
      email: body.email,
    });

    // If duplicate check header or flag is not explicitly overridden
    if (duplicate && !req.query.force) {
      return res.status(409).json({
        success: false,
        isDuplicate: true,
        message: `Customer already exists with this mobile number (${duplicate.customer_code} - ${duplicate.full_name}).`,
        existingCustomer: duplicate,
      });
    }

    const customer = await createCustomer(body);

    await logAuditEvent({
      adminUsername: req.user?.username,
      action: 'CUSTOMER_CREATED',
      details: {
        customer_id: customer.id,
        customer_code: customer.customer_code,
        name: customer.full_name,
        mobile: customer.mobile_number,
      },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Customer registered successfully',
      customer,
    });
  } catch (err) {
    console.error('[CUSTOMERS] Error creating customer:', err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to create customer record in database',
      error: err.message,
    });
  }
});

/**
 * PUT /api/customers/:id
 * Update an existing customer profile
 */
router.put('/:id', validateBody(customerUpdateSchema), async (req, res) => {
  try {
    const customerId = Number(req.params.id);
    if (isNaN(customerId)) {
      return res.status(400).json({ success: false, message: 'Invalid customer ID' });
    }

    const existing = await getCustomerById(customerId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const body = req.validatedBody;

    // Check duplicate mobile or email for another customer
    if (body.mobile_number || body.email) {
      const duplicate = await checkCustomerDuplicate({
        mobile_number: body.mobile_number || existing.mobile_number,
        email: body.email || existing.email,
        excludeId: customerId,
      });

      if (duplicate && !req.query.force) {
        return res.status(409).json({
          success: false,
          isDuplicate: true,
          message: `Another customer (${duplicate.customer_code} - ${duplicate.full_name}) already uses this mobile number or email.`,
          existingCustomer: duplicate,
        });
      }
    }

    const updated = await updateCustomer(customerId, {
      ...existing,
      ...body,
    });

    await logAuditEvent({
      adminUsername: req.user?.username,
      action: 'CUSTOMER_UPDATED',
      details: {
        customer_id: customerId,
        customer_code: existing.customer_code,
      },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Customer updated successfully',
      customer: updated,
    });
  } catch (err) {
    console.error('[CUSTOMERS] Error updating customer:', err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to update customer details',
      error: err.message,
    });
  }
});

/**
 * DELETE /api/customers/:id
 * Safe delete / archive customer
 */
router.delete('/:id', async (req, res) => {
  try {
    const customerId = Number(req.params.id);
    if (isNaN(customerId)) {
      return res.status(400).json({ success: false, message: 'Invalid customer ID' });
    }

    const customer = await getCustomerById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const result = await deleteCustomer(customerId);

    await logAuditEvent({
      adminUsername: req.user?.username,
      action: 'CUSTOMER_ARCHIVED',
      details: {
        customer_id: customerId,
        customer_code: customer.customer_code,
        hasLinkedLeads: result.hasLinkedLeads,
      },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: result.message,
      hasLinkedLeads: result.hasLinkedLeads,
    });
  } catch (err) {
    console.error('[CUSTOMERS] Error archiving customer:', err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to archive customer',
      error: err.message,
    });
  }
});

export default router;
