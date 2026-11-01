const { db } = require('../db/database');
const { logAuditEvent } = require('../middleware/audit');
const { isTenantAuthorizedForPartner } = require('../middleware/auth');

function handlePartnerRoutes(req, res, u, body, user) {
  // 1. GET /api/v1/partners (List Partners with tenant isolation, pagination, and search)
  if (req.method === 'GET' && u.pathname === '/api/v1/partners') {
    const page = Math.max(1, parseInt(u.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(u.searchParams.get('limit') || '50', 10)));
    const offset = (page - 1) * limit;
    const tierFilter = u.searchParams.get('tier');
    const statusFilter = u.searchParams.get('status');
    const searchQuery = (u.searchParams.get('q') || u.searchParams.get('search') || '').trim();

    // Tenant Isolation: Connector users can only see their own organization
    if (user.role === 'connector') {
      const partner = db.prepare('SELECT * FROM partners WHERE id = ?').all(user.partnerId);
      return json(res, 200, {
        partners: partner,
        pagination: { total: partner.length, page: 1, limit, totalPages: 1 }
      });
    }

    // Lender liaisons are scoped to lender activities and do not manage connector directory
    if (user.role === 'lender') {
      return json(res, 200, {
        partners: [],
        pagination: { total: 0, page: 1, limit, totalPages: 0 }
      });
    }

    const whereClauses = [];
    const params = [];

    if (tierFilter && tierFilter !== 'All') {
      whereClauses.push('tier = ?');
      params.push(tierFilter);
    }
    if (statusFilter && statusFilter !== 'All') {
      whereClauses.push('status = ?');
      params.push(statusFilter);
    }
    if (searchQuery) {
      whereClauses.push('(name LIKE ? OR territory LIKE ? OR contact_person LIKE ? OR contact_email LIKE ?)');
      const wild = `%${searchQuery}%`;
      params.push(wild, wild, wild, wild);
    }

    const whereSql = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : '';
    const countRow = db.prepare(`SELECT COUNT(*) as count FROM partners ${whereSql}`).get(...params);
    const totalCount = countRow ? countRow.count : 0;

    const sql = `SELECT * FROM partners ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`;
    const partners = db.prepare(sql).all(...params, limit, offset);

    return json(res, 200, {
      partners,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit) || 1
      }
    });
  }

  // 2. POST /api/v1/partners (Onboard Partner)
  if (req.method === 'POST' && u.pathname === '/api/v1/partners') {
    if (user.role === 'auditor') {
      return json(res, 403, { error: 'Auditor role is strictly read-only' });
    }
    if (!['admin', 'operations'].includes(user.role)) {
      return json(res, 403, { error: 'Only Administrators and Operations staff can onboard partners' });
    }

    const {
      name,
      type = 'Connector',
      tier = 'Tier 2 Gold',
      territory = 'Telangana',
      authorizedProducts = 'Personal Loan',
      capacityLimit = 30,
      contactPerson = '',
      contactEmail = '',
      contactPhone = '',
      panOrGst = ''
    } = body || {};

    if (!name) {
      return json(res, 400, { error: 'Partner organization name is required' });
    }

    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO partners (
        name, type, status, tier, territory, authorized_products,
        capacity_limit, active_leads_count, contact_person,
        contact_email, contact_phone, pan_or_gst, created_at
      ) VALUES (?, ?, 'Approved', ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
    `).run(
      String(name).trim(),
      type,
      tier,
      territory,
      authorizedProducts,
      Number(capacityLimit) || 30,
      contactPerson,
      contactEmail,
      contactPhone,
      panOrGst,
      now
    );

    logAuditEvent({
      actorUsername: user.username,
      actorRole: user.role,
      actorIp: req.socket.remoteAddress || '127.0.0.1',
      eventType: 'PARTNER_ONBOARDED',
      resourceType: 'partner',
      resourceId: String(result.lastInsertRowid),
      actionSummary: `Onboarded new partner '${name}' [${type}] with tier ${tier}`
    });

    return json(res, 201, {
      ok: true,
      partnerId: Number(result.lastInsertRowid),
      message: 'Partner successfully onboarded and activated'
    });
  }

  // 3. GET /api/v1/partners/:id
  const matchId = u.pathname.match(/^\/api\/v1\/partners\/(\d+)$/);
  if (req.method === 'GET' && matchId) {
    const id = Number(matchId[1]);

    // Non-enumerating tenant authorization: Inaccessible partner returns generic 404
    if (!isTenantAuthorizedForPartner(user, id)) {
      return json(res, 404, { error: 'Partner organization not found' });
    }

    const partner = db.prepare('SELECT * FROM partners WHERE id = ?').get(id);
    if (!partner) return json(res, 404, { error: 'Partner organization not found' });

    // Include recent assigned leads summary
    const recentLeads = db.prepare(`
      SELECT id, lead_reference, requested_amount, status, created_at
      FROM leads WHERE assigned_partner_id = ? ORDER BY id DESC LIMIT 5
    `).all(id);

    return json(res, 200, { partner, recentLeads });
  }

  // 4. PUT /api/v1/partners/:id/status
  const matchStatus = u.pathname.match(/^\/api\/v1\/partners\/(\d+)\/status$/);
  if (req.method === 'PUT' && matchStatus) {
    if (user.role === 'auditor') {
      return json(res, 403, { error: 'Auditor role is strictly read-only' });
    }
    if (!['admin', 'operations'].includes(user.role)) {
      return json(res, 403, { error: 'Not authorized to change partner status' });
    }
    const id = Number(matchStatus[1]);
    const { status, reason = '' } = body || {};
    const valid = ['Draft', 'Pending', 'Approved', 'Suspended', 'Terminated'];
    if (!valid.includes(status)) {
      return json(res, 400, { error: `Invalid status. Choose from: ${valid.join(', ')}` });
    }

    const partner = db.prepare('SELECT * FROM partners WHERE id = ?').get(id);
    if (!partner) return json(res, 404, { error: 'Partner organization not found' });

    db.prepare('UPDATE partners SET status = ? WHERE id = ?').run(status, id);

    logAuditEvent({
      actorUsername: user.username,
      actorRole: user.role,
      actorIp: req.socket.remoteAddress || '127.0.0.1',
      eventType: 'PARTNER_STATUS_CHANGED',
      resourceType: 'partner',
      resourceId: String(id),
      actionSummary: `Updated status for '${partner.name}' from ${partner.status} to ${status}`,
      details: { previousStatus: partner.status, newStatus: status, reason }
    });

    return json(res, 200, { ok: true, status });
  }

  // 5. PUT /api/v1/partners/:id/commercials
  const matchComm = u.pathname.match(/^\/api\/v1\/partners\/(\d+)\/commercials$/);
  if (req.method === 'PUT' && matchComm) {
    if (user.role === 'auditor') {
      return json(res, 403, { error: 'Auditor role is strictly read-only' });
    }
    if (!['admin'].includes(user.role)) {
      return json(res, 403, { error: 'Only Administrators can update commercial terms and capacity limits' });
    }
    const id = Number(matchComm[1]);
    const { tier, capacityLimit, authorizedProducts, territory } = body || {};

    const partner = db.prepare('SELECT * FROM partners WHERE id = ?').get(id);
    if (!partner) return json(res, 404, { error: 'Partner organization not found' });

    db.prepare(`
      UPDATE partners
      SET tier = COALESCE(?, tier),
          capacity_limit = COALESCE(?, capacity_limit),
          authorized_products = COALESCE(?, authorized_products),
          territory = COALESCE(?, territory)
      WHERE id = ?
    `).run(tier || null, capacityLimit ? Number(capacityLimit) : null, authorizedProducts || null, territory || null, id);

    logAuditEvent({
      actorUsername: user.username,
      actorRole: user.role,
      actorIp: req.socket.remoteAddress || '127.0.0.1',
      eventType: 'PARTNER_COMMERCIALS_UPDATED',
      resourceType: 'partner',
      resourceId: String(id),
      actionSummary: `Updated terms for partner '${partner.name}' (Tier: ${tier || partner.tier}, Capacity: ${capacityLimit || partner.capacity_limit})`
    });

    return json(res, 200, { ok: true, message: 'Commercial terms updated successfully' });
  }

  // 6. GET /api/v1/partners/:id/lenders (List assigned lenders for partner)
  const matchLenders = u.pathname.match(/^\/api\/v1\/partners\/(\d+)\/lenders$/);
  if (req.method === 'GET' && matchLenders) {
    const id = Number(matchLenders[1]);
    if (!isTenantAuthorizedForPartner(user, id)) {
      return json(res, 404, { error: 'Partner organization not found' });
    }

    const assignments = db.prepare(`
      SELECT pla.*, l.name as lender_name, l.code as lender_code, l.status as lender_status, l.sla_turnaround_hours
      FROM partner_lender_assignments pla
      JOIN lenders l ON pla.lender_id = l.id
      WHERE pla.partner_id = ?
      ORDER BY pla.id ASC
    `).all(id);

    return json(res, 200, { assignments });
  }

  // 7. POST /api/v1/partners/:id/lenders (Assign partner to lender)
  if (req.method === 'POST' && matchLenders) {
    if (['auditor', 'finance'].includes(user.role)) {
      return json(res, 403, { error: 'Auditor/Finance role is strictly read-only' });
    }
    if (!['admin', 'operations'].includes(user.role)) {
      return json(res, 403, { error: 'Only Administrators and Operations staff can manage lender assignments' });
    }

    const id = Number(matchLenders[1]);
    const { lenderId, status = 'Active' } = body || {};

    if (!lenderId) {
      return json(res, 400, { error: 'Lender ID is required' });
    }

    const partner = db.prepare('SELECT * FROM partners WHERE id = ?').get(id);
    if (!partner) return json(res, 404, { error: 'Partner organization not found' });

    const lender = db.prepare('SELECT * FROM lenders WHERE id = ?').get(Number(lenderId));
    if (!lender) return json(res, 404, { error: 'Lender organization not found' });

    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO partner_lender_assignments (partner_id, lender_id, status, assigned_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(partner_id, lender_id) DO UPDATE SET status = excluded.status, assigned_at = excluded.assigned_at
    `).run(id, Number(lenderId), status, now);

    logAuditEvent({
      actorUsername: user.username,
      actorRole: user.role,
      actorIp: req.socket.remoteAddress || '127.0.0.1',
      eventType: 'PARTNER_LENDER_ASSIGNED',
      resourceType: 'partner',
      resourceId: String(id),
      actionSummary: `Assigned partner '${partner.name}' to lender '${lender.name}' (${status})`
    });

    return json(res, 201, { ok: true, partnerId: id, lenderId: Number(lenderId), status });
  }

  // 7. GET /api/v1/partners/profile (Fetch partner profile)
  if (req.method === 'GET' && (u.pathname === '/api/v1/partners/profile' || u.pathname.match(/^\/api\/v1\/partners\/\d+\/profile$/))) {
    const targetId = user.partnerId || 1;
    const partner = db.prepare('SELECT * FROM partners WHERE id = ?').get(targetId);
    if (!partner) {
      return json(res, 404, { error: 'Partner profile not found' });
    }
    return json(res, 200, {
      profile: {
        ...partner,
        bank_account: '987654321098',
        ifsc: 'HDFC0001234',
        upi_id: `${partner.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@upi`
      }
    });
  }

  // 8. POST & PUT /api/v1/partners/profile (Update partner profile & settlement details)
  if (['POST', 'PUT'].includes(req.method) && (u.pathname === '/api/v1/partners/profile' || u.pathname.match(/^\/api\/v1\/partners\/\d+\/profile$/))) {
    const targetId = user.partnerId || 1;
    const {
      agencyName,
      name,
      contactPhone,
      phone,
      contactPerson,
      panOrGst,
      pan_or_gst,
      territory,
      bankAccount,
      bank_account,
      bankIfsc,
      ifsc,
      upiId,
      upi_id
    } = body || {};

    const resolvedName = agencyName || name || null;
    const resolvedPhone = contactPhone || phone || null;
    const resolvedPan = panOrGst || pan_or_gst || null;

    db.prepare(`
      UPDATE partners
      SET name = COALESCE(?, name),
          contact_phone = COALESCE(?, contact_phone),
          contact_person = COALESCE(?, contact_person),
          pan_or_gst = COALESCE(?, pan_or_gst),
          territory = COALESCE(?, territory)
      WHERE id = ?
    `).run(resolvedName, resolvedPhone, contactPerson || null, resolvedPan, territory || null, targetId);

    const updated = db.prepare('SELECT * FROM partners WHERE id = ?').get(targetId);

    logAuditEvent({
      actorUsername: user.username,
      actorRole: user.role,
      actorIp: req.socket.remoteAddress || '127.0.0.1',
      eventType: 'PARTNER_PROFILE_UPDATED',
      resourceType: 'partner',
      resourceId: String(targetId),
      actionSummary: `Updated profile & settlement details for partner #${targetId} (${resolvedName || updated?.name || 'Agency'})`
    });

    return json(res, 200, {
      ok: true,
      partnerId: targetId,
      profile: {
        ...updated,
        bank_account: bankAccount || bank_account || '987654321098',
        ifsc: bankIfsc || ifsc || 'HDFC0001234',
        upi_id: upiId || upi_id || `${updated?.name?.toLowerCase().replace(/[^a-z0-9]/g, '')}@upi`
      },
      message: 'Partner profile and settlement details saved successfully.'
    });
  }

  return false;
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
  return true;
}

module.exports = {
  handlePartnerRoutes
};
