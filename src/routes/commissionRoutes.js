const { db } = require('../db/database');
const { logAuditEvent } = require('../middleware/audit');
const { postReversalEntry } = require('../services/commissionEngine');

function handleCommissionRoutes(req, res, u, body, user) {
  // 1. GET /api/v1/commissions/plans (List versioned commission plans)
  if (req.method === 'GET' && u.pathname === '/api/v1/commissions/plans') {
    const plans = db.prepare('SELECT * FROM commission_plans ORDER BY id DESC').all();
    const parsed = plans.map(p => ({
      ...p,
      rules_config: JSON.parse(p.rules_config_json || '{}')
    }));
    return json(res, 200, { plans: parsed });
  }

  // 2. POST /api/v1/commissions/plans (Create versioned plan)
  if (req.method === 'POST' && u.pathname === '/api/v1/commissions/plans') {
    if (user.role === 'auditor') {
      return json(res, 403, { error: 'Auditor role is strictly read-only' });
    }
    if (!['admin'].includes(user.role)) {
      return json(res, 403, { error: 'Only Administrators can configure commission plans' });
    }

    const {
      name,
      version = 'v1.0',
      planType = 'Percentage',
      triggerEvent = 'Disbursed',
      holdbackPercent = 10,
      capAmount = 150000,
      rulesConfig = { rate: 1.25 },
      effectiveDate = new Date().toISOString().slice(0, 10)
    } = body || {};

    if (!name) return json(res, 400, { error: 'Plan name is required' });

    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO commission_plans (
        name, version, plan_type, rules_config_json,
        trigger_event, holdback_percent, cap_amount, effective_date, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      String(name).trim(),
      version,
      planType,
      JSON.stringify(rulesConfig),
      triggerEvent,
      Number(holdbackPercent) || 0,
      Number(capAmount) || 0,
      effectiveDate,
      now
    );

    logAuditEvent({
      actorUsername: user.username,
      actorRole: user.role,
      actorIp: req.socket.remoteAddress || '127.0.0.1',
      eventType: 'COMMISSION_PLAN_CREATED',
      resourceType: 'commission_plan',
      resourceId: String(result.lastInsertRowid),
      actionSummary: `Created commission plan '${name}' [${planType}] version ${version} (Effective: ${effectiveDate})`
    });

    return json(res, 201, { ok: true, planId: Number(result.lastInsertRowid) });
  }

  // 3. GET /api/v1/commissions/ledger (Immutable ledger entries with strict tenant filter)
  if (req.method === 'GET' && u.pathname === '/api/v1/commissions/ledger') {
    // Lenders do not receive or view connector partner commission ledgers
    if (user.role === 'lender') {
      return json(res, 200, {
        entries: [],
        stats: { totalAccrued: 0, totalApproved: 0, totalPaid: 0, totalHoldback: 0, totalReversed: 0 },
        pagination: { total: 0, page: 1, limit: 50, totalPages: 0 }
      });
    }

    const page = Math.max(1, parseInt(u.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(u.searchParams.get('limit') || '50', 10)));
    const offset = (page - 1) * limit;
    const statusFilter = u.searchParams.get('status');

    const baseFrom = `
      FROM commission_ledger cl
      JOIN partners p ON cl.partner_id = p.id
      JOIN leads l ON cl.lead_id = l.id
    `;
    const whereClauses = [];
    const params = [];

    // Tenant Isolation: Connectors only see their own commissions
    if (user.role === 'connector') {
      whereClauses.push('cl.partner_id = ?');
      params.push(user.partnerId);
    }

    if (statusFilter && statusFilter !== 'All') {
      whereClauses.push('cl.status = ?');
      params.push(statusFilter);
    }

    const whereSql = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : '';
    const countRow = db.prepare(`SELECT COUNT(*) as count ${baseFrom} ${whereSql}`).get(...params);
    const totalCount = countRow ? countRow.count : 0;

    const sql = `
      SELECT 
        cl.*,
        p.name as partner_name, p.tier as partner_tier,
        l.lead_reference, l.requested_amount, l.disbursed_amount
      ${baseFrom} ${whereSql}
      ORDER BY cl.id DESC
      LIMIT ? OFFSET ?
    `;

    const entries = db.prepare(sql).all(...params, limit, offset);

    // Summary statistics across tenant scope
    let statsSql = `SELECT status, net_payable, holdback_amount FROM commission_ledger cl`;
    const statsParams = [];
    if (user.role === 'connector') {
      statsSql += ' WHERE cl.partner_id = ?';
      statsParams.push(user.partnerId);
    }
    const allTenantEntries = db.prepare(statsSql).all(...statsParams);

    const stats = {
      totalAccrued: allTenantEntries.filter(e => e.status === 'Accrued').reduce((sum, e) => sum + e.net_payable, 0),
      totalApproved: allTenantEntries.filter(e => e.status === 'Approved').reduce((sum, e) => sum + e.net_payable, 0),
      totalPaid: allTenantEntries.filter(e => e.status === 'Paid').reduce((sum, e) => sum + e.net_payable, 0),
      totalHoldback: allTenantEntries.filter(e => e.status !== 'Reversed').reduce((sum, e) => sum + e.holdback_amount, 0),
      totalReversed: allTenantEntries.filter(e => e.status === 'Reversed').reduce((sum, e) => sum + Math.abs(e.net_payable), 0)
    };

    return json(res, 200, {
      entries,
      stats,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit) || 1
      }
    });
  }

  // 4. POST /api/v1/commissions/ledger/:id/approve
  const matchApprove = u.pathname.match(/^\/api\/v1\/commissions\/ledger\/(\d+)\/approve$/);
  if (req.method === 'POST' && matchApprove) {
    if (user.role === 'auditor') {
      return json(res, 403, { error: 'Auditor role is strictly read-only' });
    }
    if (!['admin', 'operations', 'finance'].includes(user.role)) {
      return json(res, 403, { error: 'Not authorized to approve commission payments' });
    }
    const id = Number(matchApprove[1]);
    const entry = db.prepare('SELECT * FROM commission_ledger WHERE id=?').get(id);
    if (!entry) return json(res, 404, { error: 'Ledger entry not found' });
    if (entry.status !== 'Accrued') {
      return json(res, 400, { error: `Entry is in '${entry.status}' status (must be Accrued to approve)` });
    }

    db.prepare(`
      UPDATE commission_ledger 
      SET status = 'Approved', approved_by = ? 
      WHERE id = ?
    `).run(user.username, id);

    logAuditEvent({
      actorUsername: user.username,
      actorRole: user.role,
      actorIp: req.socket.remoteAddress || '127.0.0.1',
      eventType: 'COMMISSION_APPROVED',
      resourceType: 'commission_ledger',
      resourceId: String(id),
      actionSummary: `Approved commission ${entry.ledger_code} (Net: ₹${entry.net_payable.toLocaleString('en-IN')}) for partner #${entry.partner_id}`
    });

    return json(res, 200, { ok: true, status: 'Approved' });
  }

  // 5. POST /api/v1/commissions/ledger/:id/pay
  const matchPay = u.pathname.match(/^\/api\/v1\/commissions\/ledger\/(\d+)\/pay$/);
  if (req.method === 'POST' && matchPay) {
    if (user.role === 'auditor') {
      return json(res, 403, { error: 'Auditor role is strictly read-only' });
    }
    if (!['admin', 'finance'].includes(user.role)) {
      return json(res, 403, { error: 'Only Administrators and Finance officers can record commission settlement payouts' });
    }
    const id = Number(matchPay[1]);
    const { payoutReference = `NEFT-UTR-${Math.floor(10000000 + Math.random() * 90000000)}` } = body || {};

    const entry = db.prepare('SELECT * FROM commission_ledger WHERE id=?').get(id);
    if (!entry) return json(res, 404, { error: 'Ledger entry not found' });
    if (!['Accrued', 'Approved'].includes(entry.status)) {
      return json(res, 400, { error: `Entry is in '${entry.status}' status (cannot pay unapproved or reversed entry)` });
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE commission_ledger 
      SET status = 'Paid', payout_reference = ?, settled_at = ? 
      WHERE id = ?
    `).run(payoutReference, now, id);

    logAuditEvent({
      actorUsername: user.username,
      actorRole: user.role,
      actorIp: req.socket.remoteAddress || '127.0.0.1',
      eventType: 'COMMISSION_SETTLED',
      resourceType: 'commission_ledger',
      resourceId: String(id),
      actionSummary: `Settled payout for ${entry.ledger_code} (Ref: ${payoutReference}, Net: ₹${entry.net_payable.toLocaleString('en-IN')})`
    });

    return json(res, 200, { ok: true, status: 'Paid', payoutReference, settledAt: now });
  }

  // 6. POST /api/v1/commissions/ledger/:id/reverse (Post clawback reversal without deleting history)
  const matchReverse = u.pathname.match(/^\/api\/v1\/commissions\/ledger\/(\d+)\/reverse$/);
  if (req.method === 'POST' && matchReverse) {
    if (user.role === 'auditor') {
      return json(res, 403, { error: 'Auditor role is strictly read-only' });
    }
    if (!['admin', 'finance'].includes(user.role)) {
      return json(res, 403, { error: 'Only Administrators and Finance officers can post commission clawbacks and reversals' });
    }
    const id = Number(matchReverse[1]);
    const { reason = 'Lender clawback adjustment' } = body || {};

    try {
      const reversal = postReversalEntry({
        originalLedgerId: id,
        actorUsername: user.username,
        reason
      });

      logAuditEvent({
        actorUsername: user.username,
        actorRole: user.role,
        actorIp: req.socket.remoteAddress || '127.0.0.1',
        eventType: 'COMMISSION_REVERSED',
        resourceType: 'commission_ledger',
        resourceId: String(id),
        actionSummary: `Posted reversal ${reversal.reversalCode} against ${reversal.originalLedgerCode}`,
        details: { reason, amount: reversal.reversedAmount, originalLedgerId: id }
      });

      return json(res, 200, { ok: true, reversal });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  // 7. GET /api/v1/commissions/statement (Statement for reconciliation)
  if (req.method === 'GET' && u.pathname === '/api/v1/commissions/statement') {
    if (user.role === 'lender') {
      return json(res, 404, { error: 'Commission statement not found' });
    }

    let targetPartnerId = user.partnerId;

    // Connector attempting to view foreign partner statement gets non-enumerating 404
    if (user.role === 'connector') {
      const queryPartnerId = u.searchParams.get('partnerId');
      if (queryPartnerId && Number(queryPartnerId) !== Number(user.partnerId)) {
        return json(res, 404, { error: 'Partner not found' });
      }
      targetPartnerId = user.partnerId;
    } else if (['admin', 'operations', 'auditor'].includes(user.role)) {
      targetPartnerId = Number(u.searchParams.get('partnerId') || user.partnerId || 1);
    }

    const partner = db.prepare('SELECT * FROM partners WHERE id=?').get(targetPartnerId);
    if (!partner) return json(res, 404, { error: 'Partner not found' });

    const entries = db.prepare(`
      SELECT cl.*, l.lead_reference, l.disbursed_amount 
      FROM commission_ledger cl 
      JOIN leads l ON cl.lead_id = l.id 
      WHERE cl.partner_id = ? 
      ORDER BY cl.id DESC
    `).all(targetPartnerId);

    const statement = {
      statementDate: new Date().toISOString(),
      partnerName: partner.name,
      partnerTier: partner.tier,
      territory: partner.territory,
      period: 'October 2026 - Present',
      summary: {
        accruedTotal: entries.filter(e => e.status === 'Accrued').reduce((a, b) => a + b.net_payable, 0),
        approvedTotal: entries.filter(e => e.status === 'Approved').reduce((a, b) => a + b.net_payable, 0),
        paidTotal: entries.filter(e => e.status === 'Paid').reduce((a, b) => a + b.net_payable, 0),
        holdbackEscrow: entries.filter(e => e.status !== 'Reversed').reduce((a, b) => a + b.holdback_amount, 0),
        reversedTotal: entries.filter(e => e.status === 'Reversed').reduce((a, b) => a + Math.abs(b.net_payable), 0)
      },
      lineItems: entries
    };

    return json(res, 200, { statement });
  }

  return false;
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
  return true;
}

module.exports = {
  handleCommissionRoutes
};
