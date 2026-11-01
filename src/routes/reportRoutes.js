const { db } = require('../db/database');
const { logAuditEvent } = require('../middleware/audit');
const { maskPhone, maskEmail, maskPAN, maskName, decryptPII } = require('../services/piiMasker');

function handleReportRoutes(req, res, u, body, user) {
  // 1. GET /api/v1/reports/overview (Dashboard KPI Metrics)
  if (req.method === 'GET' && u.pathname === '/api/v1/reports/overview') {
    let leadFilter = '';
    const params = [];

    if (user.role === 'connector') {
      leadFilter = 'WHERE assigned_partner_id = ?';
      params.push(user.partnerId);
    } else if (user.role === 'lender') {
      leadFilter = 'WHERE lender_id = ?';
      params.push(user.lenderId);
    }

    const leads = db.prepare(`SELECT * FROM leads ${leadFilter}`).all(...params);
    const partners = db.prepare('SELECT * FROM partners').all();
    const lenders = db.prepare('SELECT * FROM lenders').all();

    // Commissions
    let commSql = 'SELECT * FROM commission_ledger';
    const commParams = [];
    if (user.role === 'connector') {
      commSql += ' WHERE partner_id = ?';
      commParams.push(user.partnerId);
    }
    const commissions = db.prepare(commSql).all(...commParams);

    // Funnel counts
    const funnel = {
      total: leads.length,
      eligible: leads.filter(l => l.status === 'Eligible').length,
      offered: leads.filter(l => l.status === 'Offered').length,
      accepted: leads.filter(l => l.status === 'Accepted').length,
      contacted: leads.filter(l => l.status === 'Contacted').length,
      referred: leads.filter(l => l.status === 'Referred').length,
      underReview: leads.filter(l => l.status === 'Lender Review').length,
      sanctioned: leads.filter(l => l.status === 'Sanctioned').length,
      disbursed: leads.filter(l => l.status === 'Disbursed').length,
      declined: leads.filter(l => l.status === 'Declined').length,
      withdrawn: leads.filter(l => l.status === 'Withdrawn').length
    };

    // Financial pipeline
    const requestedVol = leads.reduce((sum, l) => sum + (l.requested_amount || 0), 0);
    const disbursedVol = leads.reduce((sum, l) => sum + (l.disbursed_amount || 0), 0);
    const conversionRate = leads.length > 0 ? Math.round((funnel.disbursed / leads.length) * 100) : 0;

    const commissionMetrics = {
      accrued: commissions.filter(c => c.status === 'Accrued').reduce((s, c) => s + c.net_payable, 0),
      approved: commissions.filter(c => c.status === 'Approved').reduce((s, c) => s + c.net_payable, 0),
      paid: commissions.filter(c => c.status === 'Paid').reduce((s, c) => s + c.net_payable, 0),
      escrowHoldback: commissions.filter(c => c.status !== 'Reversed').reduce((s, c) => s + c.holdback_amount, 0)
    };

    // Recent activity events
    let recentEvents = [];
    if (['admin', 'operations', 'auditor'].includes(user.role)) {
      recentEvents = db.prepare('SELECT * FROM lead_events ORDER BY id DESC LIMIT 8').all();
    } else {
      recentEvents = db.prepare(`
        SELECT le.* FROM lead_events le 
        JOIN leads l ON le.lead_id = l.id 
        ${leadFilter.replace('WHERE', 'WHERE l.')}
        ORDER BY le.id DESC LIMIT 8
      `).all(...params);
    }

    return json(res, 200, {
      stats: {
        totalLeads: leads.length,
        activePartners: partners.filter(p => p.status === 'Approved').length,
        totalPartners: partners.length,
        activeLenders: lenders.filter(l => l.status === 'Active').length,
        requestedVolume: requestedVol,
        disbursedVolume: disbursedVol,
        conversionRate,
        commissions: commissionMetrics
      },
      funnel,
      recentEvents
    });
  }

  // 2. GET /api/v1/reports/audit-events (Immutable System Audit Trail)
  if (req.method === 'GET' && u.pathname === '/api/v1/reports/audit-events') {
    if (!['admin', 'auditor'].includes(user.role)) {
      return json(res, 403, { error: 'Only Administrators and Compliance Auditors can access system audit events' });
    }

    const limit = Math.min(100, Number(u.searchParams.get('limit') || 50));
    const events = db.prepare('SELECT * FROM audit_events ORDER BY id DESC LIMIT ?').all(limit);

    return json(res, 200, { events });
  }

  // 3. GET /api/v1/reports/export (Permission-Aware CSV Export with PII Masking)
  if (req.method === 'GET' && u.pathname === '/api/v1/reports/export') {
    let sql = `
      SELECT 
        l.lead_reference, l.status, l.requested_amount, l.sanctioned_amount, l.disbursed_amount,
        l.city, l.state, l.created_at,
        c.full_name as raw_name, c.phone_encrypted, c.email_encrypted, c.pan_encrypted,
        p.name as partner_name,
        len.name as lender_name,
        prod.product_name
      FROM leads l
      JOIN customers c ON l.customer_id = c.id
      JOIN loan_products prod ON l.product_id = prod.id
      LEFT JOIN partners p ON l.assigned_partner_id = p.id
      LEFT JOIN lenders len ON l.lender_id = len.id
    `;
    const params = [];

    if (user.role === 'connector') {
      sql += ' WHERE l.assigned_partner_id = ?';
      params.push(user.partnerId);
    } else if (user.role === 'lender') {
      sql += ' WHERE l.lender_id = ?';
      params.push(user.lenderId);
    }
    sql += ' ORDER BY l.id DESC';

    const rows = db.prepare(sql).all(...params);

    // Build CSV with permission-based masking
    const headers = ['Lead Reference', 'Customer Name', 'Phone', 'Email', 'PAN', 'Product', 'Partner', 'Lender', 'Requested Amt', 'Disbursed Amt', 'Status', 'City', 'Created Date'];
    const csvLines = [headers.join(',')];

    for (const r of rows) {
      const rawPhone = decryptPII(r.phone_encrypted);
      const rawEmail = decryptPII(r.email_encrypted);
      const rawPAN = decryptPII(r.pan_encrypted);

      let name = r.raw_name;
      let phone = rawPhone;
      let email = rawEmail;
      let pan = rawPAN;

      // Enforce role- and state-governed PII masking on exported records
      let shouldMask = false;
      if (user.role === 'auditor') {
        shouldMask = true;
      } else if (user.role === 'connector') {
        const unmaskedStatuses = ['Accepted', 'Contacted', 'Referred', 'Lender Review', 'Sanctioned', 'Disbursed'];
        shouldMask = !unmaskedStatuses.includes(r.status);
      } else if (user.role === 'lender') {
        const lenderStatuses = ['Lender Review', 'Sanctioned', 'Disbursed'];
        shouldMask = !lenderStatuses.includes(r.status);
      }

      if (shouldMask) {
        name = maskName(name);
        phone = maskPhone(phone);
        email = maskEmail(email);
        pan = maskPAN(pan);
      }

      csvLines.push([
        `"${r.lead_reference}"`,
        `"${name}"`,
        `"${phone}"`,
        `"${email}"`,
        `"${pan}"`,
        `"${r.product_name}"`,
        `"${r.partner_name || 'Unassigned'}"`,
        `"${r.lender_name || 'N/A'}"`,
        r.requested_amount,
        r.disbursed_amount || 0,
        `"${r.status}"`,
        `"${r.city}"`,
        `"${r.created_at.slice(0, 10)}"`
      ].join(','));
    }

    logAuditEvent({
      actorUsername: user.username,
      actorRole: user.role,
      actorIp: req.socket.remoteAddress || '127.0.0.1',
      eventType: 'REPORT_EXPORTED',
      resourceType: 'export_csv',
      actionSummary: `Exported ${rows.length} lead records (Auditor masked: ${user.role === 'auditor'})`
    });

    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="Veridian_Leads_Report_${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store'
    });
    res.end(csvLines.join('\n'));
    return true;
  }

  return false;
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
  return true;
}

module.exports = {
  handleReportRoutes
};
