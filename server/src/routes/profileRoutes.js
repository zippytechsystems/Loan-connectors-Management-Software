import { Router } from 'express';
import { getBusinessProfile, upsertBusinessProfile, logAuditEvent } from '../db/queries.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, businessProfileSchema } from '../middleware/validation.js';

const router = Router();

// Protect all profile routes with authentication
router.use(requireAuth);

/**
 * GET /api/business-profile
 * Fetches the saved business profile for the owner
 */
router.get('/', async (req, res, next) => {
  try {
    const profile = await getBusinessProfile();
    return res.json({
      success: true,
      profile: profile || null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/business-profile
 * Creates or updates the business profile
 */
router.post('/', validateBody(businessProfileSchema), async (req, res, next) => {
  try {
    const clientIp = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const updated = await upsertBusinessProfile(req.validatedBody);

    await logAuditEvent({
      adminUsername: req.user.username,
      action: 'BUSINESS_PROFILE_SAVED',
      ipAddress: clientIp,
      details: {
        business_name: updated.business_name,
        lender_name: updated.lender_name,
        categories_count: updated.loan_categories?.length || 0,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Business profile saved successfully',
      profile: updated,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/business-profile
 * Updates the existing business profile
 */
router.put('/', validateBody(businessProfileSchema), async (req, res, next) => {
  try {
    const clientIp = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const updated = await upsertBusinessProfile(req.validatedBody);

    await logAuditEvent({
      adminUsername: req.user.username,
      action: 'BUSINESS_PROFILE_UPDATED',
      ipAddress: clientIp,
      details: {
        business_name: updated.business_name,
        lender_name: updated.lender_name,
        categories_count: updated.loan_categories?.length || 0,
      },
    });

    return res.json({
      success: true,
      message: 'Business profile updated successfully',
      profile: updated,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
