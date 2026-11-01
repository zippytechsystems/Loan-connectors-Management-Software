const { db } = require('../db/database');
const { logAuditEvent } = require('../middleware/audit');

function handleCatalogRoutes(req, res, u, body, user) {
  // GET /api/v1/catalog/lenders
  if (req.method === 'GET' && u.pathname === '/api/v1/catalog/lenders') {
    const lenders = db.prepare('SELECT * FROM lenders ORDER BY id ASC').all();
    return json(res, 200, { lenders });
  }

  // POST /api/v1/catalog/lenders
  if (req.method === 'POST' && u.pathname === '/api/v1/catalog/lenders') {
    if (user.role === 'auditor') {
      return json(res, 403, { error: 'Auditor role is strictly read-only' });
    }
    if (!['admin'].includes(user.role)) {
      return json(res, 403, { error: 'Only Administrators can register institutional lenders' });
    }
    const { name, code, contactEmail = '', slaHours = 48 } = body || {};
    if (!name || !code) {
      return json(res, 400, { error: 'Lender name and unique code are required' });
    }

    try {
      const now = new Date().toISOString();
      const result = db.prepare(`
        INSERT INTO lenders (name, code, status, contact_email, sla_turnaround_hours, created_at)
        VALUES (?, ?, 'Active', ?, ?, ?)
      `).run(String(name).trim(), String(code).trim().toUpperCase(), contactEmail, Number(slaHours) || 48, now);

      logAuditEvent({
        actorUsername: user.username,
        actorRole: user.role,
        actorIp: req.socket.remoteAddress || '127.0.0.1',
        eventType: 'LENDER_REGISTERED',
        resourceType: 'lender',
        resourceId: String(result.lastInsertRowid),
        actionSummary: `Registered partner lender institution '${name}' (${code})`
      });

      return json(res, 201, { ok: true, lenderId: Number(result.lastInsertRowid) });
    } catch (err) {
      return json(res, 400, { error: `Failed to register lender: ${err.message}` });
    }
  }

  // GET /api/v1/catalog/products
  if (req.method === 'GET' && u.pathname === '/api/v1/catalog/products') {
    let sql = `
      SELECT p.*, l.name as lender_name, l.code as lender_code
      FROM loan_products p
      JOIN lenders l ON p.lender_id = l.id
    `;
    const params = [];

    // Lender liaisons only see products offered by their institution
    if (user.role === 'lender') {
      sql += ' WHERE p.lender_id = ?';
      params.push(user.lenderId);
    }
    sql += ' ORDER BY p.id ASC';

    const products = db.prepare(sql).all(...params);
    // Parse JSON checklist
    const parsed = products.map(p => ({
      ...p,
      document_checklist: JSON.parse(p.document_checklist_json || '[]')
    }));

    return json(res, 200, { products: parsed });
  }

  // POST /api/v1/catalog/products
  if (req.method === 'POST' && u.pathname === '/api/v1/catalog/products') {
    if (!['admin'].includes(user.role)) {
      return json(res, 403, { error: 'Only Administrators can create or version loan products' });
    }

    const {
      lenderId,
      category,
      productName,
      minAmount = 50000,
      maxAmount = 5000000,
      minCibil = 650,
      minMonthlyIncome = 25000,
      interestRateRange = '10.50% - 15.00%',
      territories = 'Telangana, Andhra Pradesh',
      documentChecklist = ['PAN Card', 'Bank Statements (3M)', 'Income Proof'],
      slaHours = 24,
      effectiveFrom = '2026-01-01',
      effectiveTo = '2027-12-31'
    } = body || {};

    if (!lenderId || !category || !productName) {
      return json(res, 400, { error: 'Lender ID, product category, and product name are required' });
    }

    const result = db.prepare(`
      INSERT INTO loan_products (
        lender_id, category, product_name, min_amount, max_amount,
        min_cibil, min_monthly_income, interest_rate_range, territories,
        document_checklist_json, sla_hours, effective_from, effective_to, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')
    `).run(
      Number(lenderId),
      category,
      String(productName).trim(),
      Number(minAmount),
      Number(maxAmount),
      Number(minCibil),
      Number(minMonthlyIncome),
      interestRateRange,
      territories,
      JSON.stringify(documentChecklist),
      Number(slaHours) || 24,
      effectiveFrom,
      effectiveTo
    );

    logAuditEvent({
      actorUsername: user.username,
      actorRole: user.role,
      actorIp: req.socket.remoteAddress || '127.0.0.1',
      eventType: 'PRODUCT_CREATED',
      resourceType: 'loan_product',
      resourceId: String(result.lastInsertRowid),
      actionSummary: `Created product '${productName}' for lender #${lenderId}`
    });

    return json(res, 201, { ok: true, productId: Number(result.lastInsertRowid) });
  }

  return false;
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
  return true;
}

module.exports = {
  handleCatalogRoutes
};
