const crypto = require('node:crypto');
const fs = require('node:fs');
const config = require('../config');
const { db, transaction } = require('../db/database');
const { logAuditEvent, logLeadEvent } = require('../middleware/audit');
const { isTenantAuthorizedForLead } = require('../middleware/auth');
const { checkIdempotency, recordIdempotency } = require('../middleware/idempotency');
const {
  hashIdentifier,
  legacyHashIdentifier,
  encryptPII,
  maskCustomerRecord
} = require('../services/piiMasker');
const {
  CURRENT_RULE_VERSION,
  evaluateEligiblePartners,
  dispatchLeadOffer,
  processExpiredOffers
} = require('../services/routingEngine');
const {
  calculateCommission,
  postCommissionEntry
} = require('../services/commissionEngine');
const {
  storeKYCDocument,
  generateDocumentAccessToken,
  retrieveKYCDocument
} = require('../services/documentStorage');

// Strict State Transition Matrix
const VALID_LIFECYCLE_TRANSITIONS = {
  'New': ['Eligible', 'Declined', 'Withdrawn'],
  'Eligible': ['Offered', 'Accepted', 'Declined', 'Withdrawn'], // Accepted allowed for direct connector intake
  'Offered': ['Accepted', 'Declined', 'Eligible'], // Declined offer returns to Eligible pool
  'Accepted': ['Contacted', 'Withdrawn', 'Declined'],
  'Contacted': ['Referred', 'Withdrawn', 'Declined'],
  'Referred': ['Lender Review', 'Declined', 'Withdrawn'],
  'Lender Review': ['Sanctioned', 'Declined', 'Withdrawn'],
  'Sanctioned': ['Disbursed', 'Declined', 'Withdrawn'],
  'Disbursed': [],
  'Declined': ['Eligible'], // Admin can reset declined lead to Eligible pool
  'Withdrawn': [],
  'Expired': ['Eligible']
};

function handleLeadRoutes(req, res, u, body, user) {
  // 1. GET /api/v1/leads (List Leads with strict tenant filtering, pagination, and server-side search)
  if (req.method === 'GET' && u.pathname === '/api/v1/leads') {
    const page = Math.max(1, parseInt(u.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(u.searchParams.get('limit') || '50', 10)));
    const offset = (page - 1) * limit;
    const statusFilter = u.searchParams.get('status');
    const searchQuery = (u.searchParams.get('q') || u.searchParams.get('search') || '').trim();
    const productCategory = u.searchParams.get('productCategory');

    const baseFrom = `
      FROM leads l
      JOIN customers c ON l.customer_id = c.id
      JOIN loan_products prod ON l.product_id = prod.id
      LEFT JOIN partners p ON l.assigned_partner_id = p.id
      LEFT JOIN lenders len ON l.lender_id = len.id
    `;
    const whereClauses = [];
    const params = [];

    // Tenant Isolation
    if (user.role === 'connector') {
      whereClauses.push('l.assigned_partner_id = ?');
      params.push(user.partnerId);
    } else if (user.role === 'lender') {
      whereClauses.push('l.lender_id = ?');
      params.push(user.lenderId);
    }

    if (statusFilter && statusFilter !== 'All') {
      whereClauses.push('l.status = ?');
      params.push(statusFilter);
    }

    if (productCategory && productCategory !== 'All') {
      whereClauses.push('prod.category = ?');
      params.push(productCategory);
    }

    if (searchQuery) {
      whereClauses.push('(l.lead_reference LIKE ? OR c.full_name LIKE ? OR p.name LIKE ? OR l.city LIKE ?)');
      const wild = `%${searchQuery}%`;
      params.push(wild, wild, wild, wild);
    }

    const whereSql = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : '';

    // Count total matches
    const countRow = db.prepare(`SELECT COUNT(*) as count ${baseFrom} ${whereSql}`).get(...params);
    const totalCount = countRow ? countRow.count : 0;

    const sql = `
      SELECT 
        l.id, l.lead_reference, l.requested_amount, l.city, l.state, 
        l.status, l.offer_sent_at, l.offer_expires_at, l.sanctioned_amount,
        l.disbursed_amount, l.estimated_commission, l.created_at, l.updated_at,
        l.assigned_partner_id, l.lender_id,
        c.full_name as customer_name,
        p.name as partner_name, p.tier as partner_tier,
        len.name as lender_name,
        prod.product_name, prod.category as product_category
      ${baseFrom} ${whereSql}
      ORDER BY l.id DESC
      LIMIT ? OFFSET ?
    `;

    const rawLeads = db.prepare(sql).all(...params, limit, offset);

    // Apply customer name masking for auditor role
    const leads = rawLeads.map(lead => {
      const isOwner = (user.role === 'connector' && lead.assigned_partner_id === user.partnerId) ||
                      (user.role === 'lender' && lead.lender_id === user.lenderId);
      let customerName = lead.customer_name;
      if (user.role === 'auditor') {
        customerName = customerName.split(' ').map(w => w.charAt(0) + '****').join(' ');
      }
      return {
        ...lead,
        customer_name: customerName,
        is_owner: isOwner
      };
    });

    return json(res, 200, {
      leads,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit) || 1
      }
    });
  }

  // 2. GET /api/v1/leads/:id (Detailed lead view)
  const matchLeadId = u.pathname.match(/^\/api\/v1\/leads\/(\d+)$/);
  if (req.method === 'GET' && matchLeadId) {
    const id = Number(matchLeadId[1]);
    const lead = db.prepare(`
      SELECT 
        l.*,
        p.name as partner_name, p.tier as partner_tier, p.territory as partner_territory,
        len.name as lender_name, len.code as lender_code,
        prod.product_name, prod.category as product_category, prod.sla_hours,
        prod.interest_rate_range, prod.document_checklist_json
      FROM leads l
      JOIN loan_products prod ON l.product_id = prod.id
      LEFT JOIN partners p ON l.assigned_partner_id = p.id
      LEFT JOIN lenders len ON l.lender_id = len.id
      WHERE l.id = ?
    `).get(id);

    // Non-enumerating: If lead not found or inaccessible to tenant, return 404
    if (!lead || !isTenantAuthorizedForLead(user, lead)) {
      return json(res, 404, { error: 'Lead not found' });
    }

    // Load customer from isolated PII table
    const rawCustomer = db.prepare('SELECT * FROM customers WHERE id=?').get(lead.customer_id);
    const isOwner = (user.role === 'connector' && lead.assigned_partner_id === user.partnerId) ||
                    (user.role === 'lender' && lead.lender_id === user.lenderId);
    const customer = maskCustomerRecord(rawCustomer, user.role, lead.status, isOwner);

    // Load consent receipt
    const consent = db.prepare('SELECT * FROM consent_receipts WHERE customer_id=? ORDER BY id DESC LIMIT 1').get(lead.customer_id);

    // Load KYC documents
    const documents = db.prepare(`
      SELECT id, document_type, opaque_key, original_name, file_size, mime_type, malware_status, uploaded_at 
      FROM kyc_documents 
      WHERE lead_id=?
    `).all(id);

    // Load event timeline
    const events = db.prepare('SELECT * FROM lead_events WHERE lead_id=? ORDER BY id DESC').all(id);

    // Load assignment history
    const assignments = db.prepare(`
      SELECT a.*, p.name as partner_name 
      FROM lead_assignments a 
      JOIN partners p ON a.partner_id = p.id 
      WHERE a.lead_id=? ORDER BY a.id DESC
    `).all(id);

    // Audit PII view event without leaking raw customer PII
    logAuditEvent({
      actorUsername: user.username,
      actorRole: user.role,
      actorIp: req.socket.remoteAddress || '127.0.0.1',
      eventType: 'LEAD_DETAILS_VIEWED',
      resourceType: 'lead',
      resourceId: String(id),
      actionSummary: `Viewed Lead #${id} (${lead.lead_reference}), PII masked: ${Boolean(customer?.is_masked)}`
    });

    return json(res, 200, {
      lead: {
        ...lead,
        document_checklist: JSON.parse(lead.document_checklist_json || '[]')
      },
      customer,
      consent,
      documents,
      events,
      assignments
    });
  }

  // 3. POST /api/v1/leads/intake (Consent-aware intake with non-enumerating deduplication & idempotency)
  if (req.method === 'POST' && u.pathname === '/api/v1/leads/intake') {
    if (user.role === 'auditor') {
      return json(res, 403, { error: 'Auditor role is strictly read-only' });
    }
    if (!['admin', 'operations', 'connector'].includes(user.role)) {
      return json(res, 403, { error: 'Not authorized for lead intake' });
    }

    const idempotencyKey = req.headers['idempotency-key'] || body?.idempotencyKey;
    const scope = `intake:${user.username}`;

    if (idempotencyKey) {
      const cached = checkIdempotency(db, idempotencyKey, scope);
      if (cached) {
        return json(res, cached.statusCode, cached.body);
      }
    }

    const {
      fullName,
      phone,
      email,
      pan,
      employmentType = 'Salaried',
      monthlyIncome = 50000,
      city = 'Hyderabad',
      state = 'Telangana',
      productId,
      requestedAmount,
      consentGranted = true,
      consentPurpose = 'Loan connector matching and authorized credit assessment under DPDP Act 2023',
      consentVersion = 'v1.2-2026-CONSENT'
    } = body || {};

    if (!fullName || !phone || !pan || !productId || !requestedAmount) {
      return json(res, 400, { error: 'Full name, phone, PAN, product selection, and requested amount are required' });
    }

    if (!consentGranted) {
      return json(res, 400, { error: 'Customer consent is mandatory for lead ingestion under DPDP Act 2023' });
    }

    // Deduplication check: check both current key and legacy key hashes
    const phoneHash = hashIdentifier(phone);
    const legacyPhone = legacyHashIdentifier(phone);
    const panHash = hashIdentifier(pan);
    const legacyPan = legacyHashIdentifier(pan);

    const existingCustomer = db.prepare(`
      SELECT id FROM customers 
      WHERE phone_hash IN (?, ?) OR pan_hash IN (?, ?)
    `).get(phoneHash, legacyPhone, panHash, legacyPan);

    if (existingCustomer) {
      // Check for active lead in-flight
      const activeLead = db.prepare(`
        SELECT id, lead_reference, status, assigned_partner_id, created_at 
        FROM leads 
        WHERE customer_id = ? 
          AND status NOT IN ('Disbursed', 'Declined', 'Withdrawn', 'Expired')
      `).get(existingCustomer.id);

      if (activeLead) {
        // If the same connector submitted the duplicate: return idempotent success
        if (user.role === 'connector' && Number(activeLead.assigned_partner_id) === Number(user.partnerId)) {
          const idempotentResp = {
            ok: true,
            leadId: activeLead.id,
            leadReference: activeLead.lead_reference,
            status: activeLead.status,
            message: 'Existing application returned for this applicant under your organization',
            idempotent: true
          };
          if (idempotencyKey) recordIdempotency(db, idempotencyKey, scope, 200, idempotentResp);
          return json(res, 200, idempotentResp);
        }

        // If another tenant or unassigned: Return generic conflict WITHOUT leaking other tenant's reference
        return json(res, 409, {
          error: 'An active loan application is already being processed for this customer under network deduplication policy.',
          code: 'ACTIVE_APPLICATION_EXISTS'
        });
      }
    }

    // Begin ACID transaction for customer + consent + lead creation
    const leadResult = transaction((dbSync) => {
      const now = new Date().toISOString();

      // 1. Create or retrieve customer in isolated PII store
      let customerId = existingCustomer ? existingCustomer.id : null;
      if (!customerId) {
        const custInsert = dbSync.prepare(`
          INSERT INTO customers (
            full_name, phone_hash, phone_encrypted, email_encrypted,
            pan_hash, pan_encrypted, employment_type, monthly_income,
            residence_city, residence_state, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          String(fullName).trim(),
          phoneHash,
          encryptPII(phone),
          encryptPII(email || ''),
          panHash,
          encryptPII(pan),
          employmentType,
          Number(monthlyIncome),
          city,
          state,
          now
        );
        customerId = Number(custInsert.lastInsertRowid);
      }

      // 2. Create Consent Receipt
      dbSync.prepare(`
        INSERT INTO consent_receipts (
          customer_id, consent_purpose, consent_version, channel,
          ip_hash, granted_at, expires_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')
      `).run(
        customerId,
        consentPurpose,
        consentVersion,
        user.role === 'connector' ? 'partner_assisted_intake' : 'operations_intake_desk',
        crypto.createHash('sha256').update(req.socket.remoteAddress || '127.0.0.1').digest('hex').slice(0, 16),
        now,
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      );

      // 3. Generate lead reference
      const leadRef = `LND-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const estimatedCommission = Math.round((Number(requestedAmount) * 1.25) / 100);

      // 4. Create Lead
      const leadInsert = dbSync.prepare(`
        INSERT INTO leads (
          lead_reference, customer_id, product_id, requested_amount,
          city, state, status, assigned_partner_id, lender_id,
          estimated_commission, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'Eligible', ?, null, ?, ?, ?)
      `).run(
        leadRef,
        customerId,
        Number(productId),
        Number(requestedAmount),
        city,
        state,
        user.role === 'connector' ? user.partnerId : null,
        estimatedCommission,
        now,
        now
      );

      const leadId = Number(leadInsert.lastInsertRowid);

      // 5. If connector created lead, direct intake automatically accepts to self
      if (user.role === 'connector' && user.partnerId) {
        dbSync.prepare(`
          UPDATE leads SET status = 'Accepted', assigned_partner_id = ? WHERE id = ?
        `).run(user.partnerId, leadId);

        dbSync.prepare('UPDATE partners SET active_leads_count = active_leads_count + 1 WHERE id=?').run(user.partnerId);

        dbSync.prepare(`
          INSERT INTO lead_assignments (
            lead_id, partner_id, rule_version_id, routing_method,
            candidate_scores_json, assigned_by, status, created_at
          ) VALUES (?, ?, 'CONNECTOR_DIRECT_INTAKE', 'Manual Dispatch', ?, ?, 'Accepted', ?)
        `).run(
          leadId,
          user.partnerId,
          JSON.stringify({ note: 'Direct Partner Sourced Lead', consentVersion }),
          user.username,
          now
        );
      }

      return { leadId, leadRef };
    });

    logLeadEvent({
      leadId: leadResult.leadId,
      actorUsername: user.username,
      actorRole: user.role,
      fromStatus: 'New',
      toStatus: user.role === 'connector' ? 'Accepted' : 'Eligible',
      actionName: 'lead_intake_created',
      notes: `Lead intake completed with verified customer consent (${consentVersion})`,
      reasonCode: 'INTAKE_VALIDATED'
    });

    logAuditEvent({
      actorUsername: user.username,
      actorRole: user.role,
      actorIp: req.socket.remoteAddress || '127.0.0.1',
      eventType: 'LEAD_INTAKE',
      resourceType: 'lead',
      resourceId: String(leadResult.leadId),
      actionSummary: `Ingested new consented lead #${leadResult.leadId} (${leadResult.leadRef})`
    });

    const responsePayload = {
      ok: true,
      leadId: leadResult.leadId,
      leadReference: leadResult.leadRef,
      message: 'Consented lead ingested successfully'
    };

    if (idempotencyKey) {
      recordIdempotency(db, idempotencyKey, scope, 201, responsePayload);
    }

    return json(res, 201, responsePayload);
  }

  // 4. POST /api/v1/leads/simulate-routing (Routing rule simulator & explainability)
  if (req.method === 'POST' && u.pathname === '/api/v1/leads/simulate-routing') {
    const { leadId, productId, requestedAmount, city, state } = body || {};

    let testLead = null;
    if (leadId) {
      testLead = db.prepare('SELECT * FROM leads WHERE id=?').get(Number(leadId));
    } else {
      testLead = {
        id: 0,
        product_id: Number(productId || 1),
        requested_amount: Number(requestedAmount || 500000),
        city: String(city || 'Hyderabad'),
        state: String(state || 'Telangana')
      };
    }

    if (!testLead) return json(res, 400, { error: 'Could not resolve lead parameters for simulation' });

    const evaluation = evaluateEligiblePartners(testLead);
    return json(res, 200, evaluation);
  }

  // 5. POST /api/v1/leads/:id/route (Execute dispatch to partner)
  const matchRoute = u.pathname.match(/^\/api\/v1\/leads\/(\d+)\/route$/);
  if (req.method === 'POST' && matchRoute) {
    if (user.role === 'auditor') {
      return json(res, 403, { error: 'Auditor role is strictly read-only' });
    }
    if (!['admin', 'operations'].includes(user.role)) {
      return json(res, 403, { error: 'Only Administrators and Operations staff can dispatch leads' });
    }

    const id = Number(matchRoute[1]);
    const lead = db.prepare('SELECT * FROM leads WHERE id=?').get(id);
    if (!lead) return json(res, 404, { error: 'Lead not found' });

    // Validate active customer consent
    const consent = db.prepare(`
      SELECT id FROM consent_receipts 
      WHERE customer_id = ? AND status = 'Active' AND expires_at > ?
    `).get(lead.customer_id, new Date().toISOString());

    if (!consent) {
      return json(res, 422, { error: 'Customer consent missing or expired: Cannot route lead without active customer consent' });
    }

    const { partnerId, routingMethod = 'Priority' } = body || {};
    let targetPartnerId = partnerId;
    let evalResult = null;

    if (!targetPartnerId) {
      evalResult = evaluateEligiblePartners(lead);
      if (!evalResult.recommendedPartner) {
        return json(res, 422, {
          error: 'No eligible partners found matching the category, territory, and capacity rules',
          disqualified: evalResult.disqualified
        });
      }
      targetPartnerId = evalResult.recommendedPartner.partnerId;
    } else {
      evalResult = evaluateEligiblePartners(lead);
    }

    try {
      const dispatchResult = dispatchLeadOffer({
        leadId: id,
        partnerId: Number(targetPartnerId),
        routingMethod,
        assignedBy: user.username,
        evaluationTrace: evalResult
      });

      logLeadEvent({
        leadId: id,
        actorUsername: user.username,
        actorRole: user.role,
        fromStatus: 'Eligible',
        toStatus: 'Offered',
        actionName: 'offer_dispatched',
        notes: `Offer dispatched to ${dispatchResult.partnerName} via ${routingMethod} algorithm (Expires in 24 hours)`,
        reasonCode: 'ROUTING_DISPATCH'
      });

      logAuditEvent({
        actorUsername: user.username,
        actorRole: user.role,
        actorIp: req.socket.remoteAddress || '127.0.0.1',
        eventType: 'LEAD_OFFERED',
        resourceType: 'lead',
        resourceId: String(id),
        actionSummary: `Dispatched lead #${id} offer to Partner #${targetPartnerId} (${dispatchResult.partnerName})`
      });

      return json(res, 200, dispatchResult);
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  // 6. POST /api/v1/leads/process-expired (Process offer SLA expiries and auto-reroute)
  if (req.method === 'POST' && u.pathname === '/api/v1/leads/process-expired') {
    if (user.role === 'auditor') {
      return json(res, 403, { error: 'Auditor role is strictly read-only' });
    }
    const results = processExpiredOffers();
    return json(res, 200, { ok: true, processedCount: results.length, details: results });
  }

  // 7. POST /api/v1/leads/:id/transition (Lifecycle state transitions)
  const matchTransition = u.pathname.match(/^\/api\/v1\/leads\/(\d+)\/transition$/);
  if (req.method === 'POST' && matchTransition) {
    if (user.role === 'auditor') {
      return json(res, 403, { error: 'Auditor role is strictly read-only' });
    }

    const id = Number(matchTransition[1]);
    const lead = db.prepare('SELECT * FROM leads WHERE id=?').get(id);

    // Non-enumerating: 404 if lead does not exist or user is unauthorized tenant
    if (!lead || !isTenantAuthorizedForLead(user, lead)) {
      return json(res, 404, { error: 'Lead not found' });
    }

    const { targetStatus, reasonCode = '', notes = '', sanctionedAmount, disbursedAmount, lenderId } = body || {};

    // 1. Role-specific permission enforcement
    if (['auditor', 'finance'].includes(user.role)) {
      return json(res, 403, { error: 'Auditor/Finance role is strictly read-only' });
    }

    if (user.role === 'connector') {
      const allowedForConnector = ['Accepted', 'Declined', 'Contacted', 'Referred', 'Withdrawn'];
      if (!allowedForConnector.includes(targetStatus)) {
        return json(res, 403, { error: `Connectors cannot transition leads directly to '${targetStatus}'` });
      }
    }

    if (['lender', 'reviewer'].includes(user.role)) {
      const allowedForLender = ['Lender Review', 'Sanctioned', 'Disbursed', 'Declined'];
      if (!allowedForLender.includes(targetStatus)) {
        return json(res, 403, { error: `Lender/Reviewer liaisons can only transition to: ${allowedForLender.join(', ')}` });
      }
    }

    // 2. Validate target status in state transition matrix
    const allowedNext = VALID_LIFECYCLE_TRANSITIONS[lead.status] || [];
    if (!allowedNext.includes(targetStatus)) {
      return json(res, 400, {
        error: `Invalid lifecycle transition: Cannot move lead from '${lead.status}' to '${targetStatus}'. Permitted transitions: [${allowedNext.join(', ')}]`
      });
    }

    const now = new Date().toISOString();

    // Handle transition within ACID transaction
    transaction((dbSync) => {
      let targetLenderId = lead.lender_id;
      if (lenderId) targetLenderId = Number(lenderId);
      else if (user.role === 'lender') targetLenderId = user.lenderId;

      let finalSanctioned = lead.sanctioned_amount;
      if (sanctionedAmount) finalSanctioned = Number(sanctionedAmount);

      let finalDisbursed = lead.disbursed_amount;
      if (disbursedAmount) finalDisbursed = Number(disbursedAmount);

      // If partner declines lead:
      if (targetStatus === 'Declined' && lead.status === 'Offered') {
        dbSync.prepare(`
          UPDATE lead_assignments 
          SET status = 'Declined', decline_reason = ? 
          WHERE lead_id = ? AND partner_id = ? AND status = 'Offered'
        `).run(notes || reasonCode || 'Partner declined lead', id, lead.assigned_partner_id);

        // Decrement partner capacity count
        if (lead.assigned_partner_id) {
          dbSync.prepare('UPDATE partners SET active_leads_count = MAX(0, active_leads_count - 1) WHERE id=?').run(lead.assigned_partner_id);
        }

        // Reset lead back to Eligible for fallback routing
        dbSync.prepare(`
          UPDATE leads 
          SET status = 'Eligible', assigned_partner_id = null, offer_sent_at = null, offer_expires_at = null, updated_at = ?
          WHERE id = ?
        `).run(now, id);

        logLeadEvent({
          leadId: id,
          actorUsername: user.username,
          actorRole: user.role,
          fromStatus: lead.status,
          toStatus: 'Eligible',
          actionName: 'partner_declined_lead',
          notes: notes || 'Partner declined offer; returned to network pool for fallback dispatch',
          reasonCode: reasonCode || 'PARTNER_DECLINE'
        });

        return;
      }

      // If accepted:
      if (targetStatus === 'Accepted' && lead.status === 'Offered') {
        dbSync.prepare(`
          UPDATE lead_assignments 
          SET status = 'Accepted' 
          WHERE lead_id = ? AND partner_id = ? AND status = 'Offered'
        `).run(id, lead.assigned_partner_id);
      }

      // Update lead
      dbSync.prepare(`
        UPDATE leads 
        SET status = ?, 
            lender_id = COALESCE(?, lender_id),
            sanctioned_amount = ?,
            disbursed_amount = ?,
            updated_at = ?
        WHERE id = ?
      `).run(targetStatus, targetLenderId, finalSanctioned, finalDisbursed, now, id);

      // If status becomes Disbursed: Trigger Commission Engine with retry idempotency!
      if (targetStatus === 'Disbursed') {
        const calc = calculateCommission({ leadId: id, triggerEvent: 'Disbursed' });
        postCommissionEntry({
          leadId: id,
          partnerId: lead.assigned_partner_id,
          triggerEvent: 'Disbursed',
          calculatedData: calc
        });

        // Decrement partner active count upon successful loan completion
        if (lead.assigned_partner_id) {
          dbSync.prepare('UPDATE partners SET active_leads_count = MAX(0, active_leads_count - 1) WHERE id=?').run(lead.assigned_partner_id);
        }
      }

      // If withdrawn or final declined:
      if (['Withdrawn', 'Declined'].includes(targetStatus) && lead.assigned_partner_id) {
        dbSync.prepare('UPDATE partners SET active_leads_count = MAX(0, active_leads_count - 1) WHERE id=?').run(lead.assigned_partner_id);
      }

      logLeadEvent({
        leadId: id,
        actorUsername: user.username,
        actorRole: user.role,
        fromStatus: lead.status,
        toStatus: targetStatus,
        actionName: `status_changed_to_${targetStatus.toLowerCase().replace(/\s+/g, '_')}`,
        notes: notes || `State transitioned from ${lead.status} to ${targetStatus}`,
        reasonCode: reasonCode || 'LIFECYCLE_PROGRESSION'
      });
    });

    logAuditEvent({
      actorUsername: user.username,
      actorRole: user.role,
      actorIp: req.socket.remoteAddress || '127.0.0.1',
      eventType: 'LEAD_STATUS_TRANSITION',
      resourceType: 'lead',
      resourceId: String(id),
      actionSummary: `Lead #${id} transitioned from '${lead.status}' to '${targetStatus}'`
    });

    return json(res, 200, { ok: true, leadId: id, status: targetStatus });
  }

  // 8. POST /api/v1/leads/:id/notes (Add operational note)
  const matchNote = u.pathname.match(/^\/api\/v1\/leads\/(\d+)\/notes$/);
  if (req.method === 'POST' && matchNote) {
    if (user.role === 'auditor') {
      return json(res, 403, { error: 'Auditor role is strictly read-only' });
    }
    const id = Number(matchNote[1]);
    const { note } = body || {};
    if (!note) return json(res, 400, { error: 'Note text is required' });

    const lead = db.prepare('SELECT * FROM leads WHERE id=?').get(id);
    if (!lead || !isTenantAuthorizedForLead(user, lead)) {
      return json(res, 404, { error: 'Lead not found' });
    }

    logLeadEvent({
      leadId: id,
      actorUsername: user.username,
      actorRole: user.role,
      fromStatus: lead.status,
      toStatus: lead.status,
      actionName: 'note_added',
      notes: String(note).trim(),
      reasonCode: 'OPERATIONAL_NOTE'
    });

    return json(res, 201, { ok: true, message: 'Note added to timeline' });
  }

  // 9. POST /api/v1/leads/:id/documents (Upload KYC document into encrypted vault)
  const matchDoc = u.pathname.match(/^\/api\/v1\/leads\/(\d+)\/documents$/);
  if (req.method === 'POST' && matchDoc) {
    if (user.role === 'auditor') {
      return json(res, 403, { error: 'Auditor role is strictly read-only' });
    }
    const id = Number(matchDoc[1]);
    const lead = db.prepare('SELECT * FROM leads WHERE id=?').get(id);
    if (!lead || !isTenantAuthorizedForLead(user, lead)) {
      return json(res, 404, { error: 'Lead not found' });
    }

    const { documentType = 'Identity Proof', fileName = 'document.pdf', contentBase64 } = body || {};
    let buffer = null;
    if (contentBase64) {
      buffer = Buffer.from(contentBase64, 'base64');
    } else {
      buffer = Buffer.from(`%PDF-1.4 Synthetic ${documentType} uploaded for Lead #${id} by ${user.username}`);
    }

    try {
      const docResult = storeKYCDocument({
        leadId: id,
        documentType,
        originalName: fileName,
        fileBuffer: buffer,
        mimeType: 'application/pdf',
        actorUsername: user.username
      });

      return json(res, 201, { ok: true, document: docResult });
    } catch (err) {
      return json(res, 400, { error: `Document upload failed: ${err.message}` });
    }
  }

  // 10. GET /api/v1/leads/:id/documents/:opaqueKey/token (Get short-lived download token)
  const matchDocToken = u.pathname.match(/^\/api\/v1\/leads\/(\d+)\/documents\/([a-f0-9-]+)\/token$/);
  if (req.method === 'GET' && matchDocToken) {
    const leadId = Number(matchDocToken[1]);
    const opaqueKey = matchDocToken[2];

    const lead = db.prepare('SELECT * FROM leads WHERE id=?').get(leadId);
    if (!lead || !isTenantAuthorizedForLead(user, lead)) {
      return json(res, 404, { error: 'Lead not found' });
    }

    const token = generateDocumentAccessToken(opaqueKey, user.username, leadId);
    return json(res, 200, {
      token,
      downloadUrl: `/api/v1/documents/download?token=${encodeURIComponent(token)}`,
      expiresInMinutes: 15
    });
  }

  // 11. GET /api/v1/documents/download (Stream encrypted private document after authorization recheck)
  if (req.method === 'GET' && u.pathname === '/api/v1/documents/download') {
    const token = u.searchParams.get('token');
    try {
      const { doc, fileBuffer, mimeType, fileName } = retrieveKYCDocument(
        token,
        user,
        req.socket.remoteAddress || '127.0.0.1'
      );

      res.writeHead(200, {
        'Content-Type': mimeType || 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
        'X-Robots-Tag': 'noindex, nofollow, noarchive'
      });
      res.end(fileBuffer);
      return true;
    } catch (err) {
      return json(res, 403, { error: `Document retrieval failed: ${err.message}` });
    }
  }

  // 12. POST /api/v1/leads/:id/purge-pii (Right to be Forgotten / DPDP compliance)
  const matchPurge = u.pathname.match(/^\/api\/v1\/leads\/(\d+)\/purge-pii$/);
  if (req.method === 'POST' && matchPurge) {
    if (!['admin'].includes(user.role)) {
      return json(res, 403, { error: 'Only Administrators can execute customer PII erasure' });
    }
    const id = Number(matchPurge[1]);
    const lead = db.prepare('SELECT * FROM leads WHERE id=?').get(id);
    if (!lead) return json(res, 404, { error: 'Lead not found' });

    const { reason = 'Customer Right to be Forgotten request under DPDP Act 2023' } = body || {};

    transaction((dbSync) => {
      const now = new Date().toISOString();

      // Redact customer identity
      dbSync.prepare(`
        UPDATE customers
        SET full_name = 'REDACTED (PURGED)',
            phone_hash = ?,
            phone_encrypted = '',
            email_encrypted = '',
            pan_hash = ?,
            pan_encrypted = ''
        WHERE id = ?
      `).run(`PURGED_PHONE_${lead.customer_id}`, `PURGED_PAN_${lead.customer_id}`, lead.customer_id);

      // Remove vault document files on disk and mark in DB
      const docs = dbSync.prepare('SELECT * FROM kyc_documents WHERE lead_id=?').all(id);
      for (const d of docs) {
        const filePath = require('path').join(config.STORAGE_DIR, `${d.opaque_key}.vault`);
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (e) {}
      }
      dbSync.prepare("UPDATE kyc_documents SET original_name = '[PURGED]', malware_status = 'Quarantined' WHERE lead_id=?").run(id);

      // Record auditable retention action
      dbSync.prepare(`
        INSERT INTO customer_retention_records (customer_id, action, reason, actor_username, actor_role, executed_at)
        VALUES (?, 'Purged', ?, ?, ?, ?)
      `).run(lead.customer_id, reason, user.username, user.role, now);

      logAuditEvent({
        actorUsername: user.username,
        actorRole: user.role,
        actorIp: req.socket.remoteAddress || '127.0.0.1',
        eventType: 'CUSTOMER_PII_PURGED',
        resourceType: 'customer',
        resourceId: String(lead.customer_id),
        actionSummary: `Executed customer PII erasure for Lead #${id} (${reason})`
      });
    });

    return json(res, 200, { ok: true, message: 'Customer PII successfully erased without modifying financial records' });
  }

  // 13. GET /api/v1/leads/:id/reminders (List follow-up reminders for lead)
  const matchReminders = u.pathname.match(/^\/api\/v1\/leads\/(\d+)\/reminders$/);
  if (req.method === 'GET' && matchReminders) {
    const id = Number(matchReminders[1]);
    const lead = db.prepare('SELECT * FROM leads WHERE id=?').get(id);
    if (!lead || !isTenantAuthorizedForLead(user, lead)) {
      return json(res, 404, { error: 'Lead not found' });
    }

    const reminders = db.prepare(`
      SELECT * FROM lead_reminders 
      WHERE lead_id = ? 
      ORDER BY due_date ASC
    `).all(id);

    return json(res, 200, { reminders });
  }

  // 14. POST /api/v1/leads/:id/reminders (Create follow-up task/reminder)
  if (req.method === 'POST' && matchReminders) {
    if (['auditor', 'finance'].includes(user.role)) {
      return json(res, 403, { error: 'Auditor/Finance role is strictly read-only' });
    }
    const id = Number(matchReminders[1]);
    const lead = db.prepare('SELECT * FROM leads WHERE id=?').get(id);
    if (!lead || !isTenantAuthorizedForLead(user, lead)) {
      return json(res, 404, { error: 'Lead not found' });
    }

    const { title, reminderType = 'Follow Up', dueDate, assignedTo, notes = '' } = body || {};
    if (!title || !dueDate) {
      return json(res, 400, { error: 'Reminder title and due date are required' });
    }

    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO lead_reminders (lead_id, assigned_to, title, reminder_type, due_date, status, notes, created_at)
      VALUES (?, ?, ?, ?, ?, 'Pending', ?, ?)
    `).run(
      id,
      assignedTo || user.email || user.username,
      String(title).trim(),
      reminderType,
      dueDate,
      notes,
      now
    );

    logAuditEvent({
      actorUsername: user.username,
      actorRole: user.role,
      actorIp: req.socket.remoteAddress || '127.0.0.1',
      eventType: 'REMINDER_CREATED',
      resourceType: 'lead_reminder',
      resourceId: String(result.lastInsertRowid),
      actionSummary: `Created reminder '${title}' for Lead #${id} (Due: ${dueDate.slice(0, 10)})`
    });

    return json(res, 201, {
      ok: true,
      reminderId: Number(result.lastInsertRowid),
      message: 'Reminder scheduled successfully'
    });
  }

  // 15. PUT /api/v1/leads/:id/reminders/:remId (Complete or update reminder)
  const matchRemId = u.pathname.match(/^\/api\/v1\/leads\/(\d+)\/reminders\/(\d+)$/);
  if (req.method === 'PUT' && matchRemId) {
    if (['auditor', 'finance'].includes(user.role)) {
      return json(res, 403, { error: 'Auditor/Finance role is strictly read-only' });
    }
    const leadId = Number(matchRemId[1]);
    const remId = Number(matchRemId[2]);

    const lead = db.prepare('SELECT * FROM leads WHERE id=?').get(leadId);
    if (!lead || !isTenantAuthorizedForLead(user, lead)) {
      return json(res, 404, { error: 'Lead not found' });
    }

    const { status = 'Completed', notes } = body || {};
    const valid = ['Pending', 'Completed', 'Cancelled'];
    if (!valid.includes(status)) {
      return json(res, 400, { error: `Invalid status. Choose from: ${valid.join(', ')}` });
    }

    const now = new Date().toISOString();
    const completedAt = status === 'Completed' ? now : null;

    db.prepare(`
      UPDATE lead_reminders 
      SET status = ?, completed_at = COALESCE(?, completed_at), notes = COALESCE(?, notes)
      WHERE id = ? AND lead_id = ?
    `).run(status, completedAt, notes || null, remId, leadId);

    return json(res, 200, { ok: true, reminderId: remId, status });
  }

  // 16. GET /api/v1/tasks (Pending tasks & follow-up reminders for current user/organization)
  if (req.method === 'GET' && u.pathname === '/api/v1/tasks') {
    let sql = `
      SELECT r.*, l.lead_reference, l.city, l.requested_amount, l.status as lead_status,
             c.full_name as customer_name
      FROM lead_reminders r
      JOIN leads l ON r.lead_id = l.id
      JOIN customers c ON l.customer_id = c.id
    `;
    const params = [];

    if (user.role === 'connector') {
      sql += " WHERE l.assigned_partner_id = ? AND r.status = 'Pending'";
      params.push(user.partnerId);
    } else if (['lender', 'reviewer'].includes(user.role)) {
      sql += " WHERE (l.lender_id = ? OR r.assigned_to = ?) AND r.status = 'Pending'";
      params.push(user.lenderId, user.username);
    } else {
      sql += " WHERE r.status = 'Pending'";
    }

    sql += ' ORDER BY r.due_date ASC LIMIT 20';
    const tasks = db.prepare(sql).all(...params);

    return json(res, 200, { tasks });
  }

  return false;
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
  return true;
}

module.exports = {
  handleLeadRoutes
};
