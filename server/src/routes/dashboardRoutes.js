import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getDashboardSummary,
  getRecentCustomers,
  getRecentLeads,
} from '../db/queries.js';

const router = express.Router();

// Require authentication for all dashboard metrics
router.use(requireAuth);

/**
 * GET /api/dashboard/summary
 * Live metrics computed directly from MySQL database tables
 */
router.get('/summary', async (req, res) => {
  try {
    const summary = await getDashboardSummary();
    res.json({
      success: true,
      data: summary,
    });
  } catch (err) {
    console.error('[DASHBOARD] Summary fetch failed:', err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard metrics from database',
      error: err.message,
    });
  }
});

/**
 * GET /api/dashboard/recent-customers
 * Retrieve the most recently registered active customers
 */
router.get('/recent-customers', async (req, res) => {
  try {
    const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 5));
    const customers = await getRecentCustomers(limit);
    res.json({
      success: true,
      data: customers,
    });
  } catch (err) {
    console.error('[DASHBOARD] Recent customers fetch failed:', err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve recent customers',
      error: err.message,
    });
  }
});

/**
 * GET /api/dashboard/recent-leads
 * Retrieve the most recently logged loan leads
 */
router.get('/recent-leads', async (req, res) => {
  try {
    const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 5));
    const leads = await getRecentLeads(limit);
    res.json({
      success: true,
      data: leads,
    });
  } catch (err) {
    console.error('[DASHBOARD] Recent leads fetch failed:', err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve recent loan leads',
      error: err.message,
    });
  }
});

export default router;
