import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  validateBody,
  leadCreateSchema,
  leadUpdateSchema,
  leadStatusSchema,
  ALLOWED_LOAN_CATEGORIES,
} from '../middleware/validation.js';
import {
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  updateLeadStatus,
  getLeadStatusHistory,
  createCustomer,
  logAuditEvent,
} from '../db/queries.js';

const router = express.Router();

// All lead routes require authentication
router.use(requireAuth);

/**
 * GET /api/leads
 * Paginated list of loan leads with search, filters for loan type, status, source, date range
 */
router.get('/', async (req, res) => {
  try {
    const {
      search = '',
      loan_type = '',
      lead_status = '',
      lead_source = '',
      startDate = '',
      endDate = '',
      sort = 'newest',
      page = 1,
      limit = 10,
    } = req.query;

    const data = await getLeads({
      search: String(search),
      loan_type: String(loan_type),
      lead_status: String(lead_status),
      lead_source: String(lead_source),
      startDate: String(startDate),
      endDate: String(endDate),
      sort: String(sort),
      page: Number(page) || 1,
      limit: Number(limit) || 10,
    });

    res.json({
      success: true,
      leads: data.leads,
      pagination: data.pagination,
    });
  } catch (err) {
    console.error('[LEADS] Error fetching list:', err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve loan leads from database',
      error: err.message,
    });
  }
});

/**
 * GET /api/leads/:id
 * Retrieve a single loan lead with customer profile and status history
 */
router.get('/:id', async (req, res) => {
  try {
    const leadId = Number(req.params.id);
    if (isNaN(leadId)) {
      return res.status(400).json({ success: false, message: 'Invalid lead ID' });
    }

    const lead = await getLeadById(leadId);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Loan lead not found' });
    }

    res.json({
      success: true,
      lead,
    });
  } catch (err) {
    console.error('[LEADS] Error fetching lead:', err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve lead details',
      error: err.message,
    });
  }
});

/**
 * GET /api/leads/:id/history
 * Fetch audit status history for a specific lead
 */
router.get('/:id/history', async (req, res) => {
  try {
    const leadId = Number(req.params.id);
    if (isNaN(leadId)) {
      return res.status(400).json({ success: false, message: 'Invalid lead ID' });
    }

    const history = await getLeadStatusHistory(leadId);
    res.json({
      success: true,
      history,
    });
  } catch (err) {
    console.error('[LEADS] Error fetching lead history:', err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve lead history',
      error: err.message,
    });
  }
});

/**
 * POST /api/leads
 * Create a new loan lead. Supports either an existing customer_id or inline customer registration.
 * STRICT: Prohibits Agriculture Loan!
 */
router.post('/', validateBody(leadCreateSchema), async (req, res) => {
  try {
    const body = req.validatedBody;

    // Strict safety check for Agriculture Loan
    if (
      body.loan_type.toLowerCase().includes('agri') ||
      !ALLOWED_LOAN_CATEGORIES.includes(body.loan_type)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Agriculture Loan is strictly prohibited. Allowed categories: ' + ALLOWED_LOAN_CATEGORIES.join(', '),
      });
    }

    let customerId = body.customer_id;

    // If inline new customer was submitted
    if (!customerId && body.customer) {
      const newCustomer = await createCustomer(body.customer);
      customerId = newCustomer.id;
    }

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'Valid customer ID is required to create a loan lead',
      });
    }

    const adminUsername = req.user?.username || 'Admin';
    const adminId = req.user?.id || null;

    const lead = await createLead(
      {
        ...body,
        customer_id: customerId,
      },
      adminUsername,
      adminId
    );

    await logAuditEvent({
      adminUsername,
      action: 'LEAD_CREATED',
      details: {
        lead_id: lead.id,
        lead_code: lead.lead_code,
        customer_id: customerId,
        loan_type: lead.loan_type,
        amount: lead.required_amount,
      },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Loan lead created successfully',
      lead,
    });
  } catch (err) {
    console.error('[LEADS] Error creating lead:', err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to create loan lead in database',
      error: err.message,
    });
  }
});

/**
 * PUT /api/leads/:id
 * Update loan lead details
 */
router.put('/:id', validateBody(leadUpdateSchema), async (req, res) => {
  try {
    const leadId = Number(req.params.id);
    if (isNaN(leadId)) {
      return res.status(400).json({ success: false, message: 'Invalid lead ID' });
    }

    const existing = await getLeadById(leadId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Loan lead not found' });
    }

    const body = req.validatedBody;

    // Strict safety check for Agriculture Loan
    if (
      body.loan_type.toLowerCase().includes('agri') ||
      !ALLOWED_LOAN_CATEGORIES.includes(body.loan_type)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Agriculture Loan is strictly prohibited. Allowed categories: ' + ALLOWED_LOAN_CATEGORIES.join(', '),
      });
    }

    const updated = await updateLead(leadId, body);

    await logAuditEvent({
      adminUsername: req.user?.username,
      action: 'LEAD_UPDATED',
      details: {
        lead_id: leadId,
        lead_code: existing.lead_code,
        loan_type: updated.loan_type,
      },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Loan lead updated successfully',
      lead: updated,
    });
  } catch (err) {
    console.error('[LEADS] Error updating lead:', err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to update loan lead',
      error: err.message,
    });
  }
});

/**
 * PATCH /api/leads/:id/status
 * Update lead status and record change in lead_status_history
 */
router.patch('/:id/status', validateBody(leadStatusSchema), async (req, res) => {
  try {
    const leadId = Number(req.params.id);
    if (isNaN(leadId)) {
      return res.status(400).json({ success: false, message: 'Invalid lead ID' });
    }

    const existing = await getLeadById(leadId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Loan lead not found' });
    }

    const { new_status, change_notes } = req.validatedBody;
    const adminUsername = req.user?.username || 'Admin';

    const updated = await updateLeadStatus(leadId, {
      new_status,
      change_notes,
      changed_by: adminUsername,
    });

    await logAuditEvent({
      adminUsername,
      action: 'LEAD_STATUS_CHANGED',
      details: {
        lead_id: leadId,
        lead_code: existing.lead_code,
        previous_status: existing.lead_status,
        new_status,
        change_notes,
      },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: `Lead status updated from "${existing.lead_status}" to "${new_status}"`,
      lead: updated,
    });
  } catch (err) {
    console.error('[LEADS] Error updating lead status:', err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to update lead status',
      error: err.message,
    });
  }
});

export default router;
