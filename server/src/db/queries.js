import { getPool } from './connection.js';

// =============================================================================
// PHASE 1: ADMIN & BUSINESS PROFILE QUERIES
// =============================================================================

/**
 * Fetch an admin user by username
 */
export async function getAdminByUsername(username) {
  const pool = getPool();
  const sql = `
    SELECT id, username, password_hash, role, is_active, created_at, updated_at
    FROM admins
    WHERE username = ?
    LIMIT 1
  `;
  const [rows] = await pool.execute(sql, [username]);
  return rows[0] || null;
}

/**
 * Create a new admin user
 */
export async function createAdmin({ username, passwordHash, role = 'admin' }) {
  const pool = getPool();
  const sql = `
    INSERT INTO admins (username, password_hash, role, is_active)
    VALUES (?, ?, ?, 1)
  `;
  const [result] = await pool.execute(sql, [username, passwordHash, role]);
  return { id: result.insertId, username, role };
}

/**
 * Count total admin accounts
 */
export async function getAdminCount() {
  const pool = getPool();
  const [rows] = await pool.query('SELECT COUNT(*) AS total FROM admins');
  return rows[0].total;
}

/**
 * Update an admin's password hash
 */
export async function updateAdminPassword(username, newPasswordHash) {
  const pool = getPool();
  const sql = `
    UPDATE admins
    SET password_hash = ?, updated_at = NOW()
    WHERE username = ?
  `;
  const [result] = await pool.execute(sql, [newPasswordHash, username]);
  return (result.affectedRows || result.changedRows || 0) > 0;
}

/**
 * Fetch the active business profile (Single Owner Profile)
 */
export async function getBusinessProfile() {
  const pool = getPool();
  const sql = `
    SELECT 
      id, business_name, owner_name, business_type, business_description,
      DATE_FORMAT(business_start_date, '%Y-%m-%d') AS business_start_date,
      mobile_number, whatsapp_number, email, alternate_contact,
      address_line, area, city, district, state, pin_code, country,
      lender_name, connector_id, agreement_reference,
      DATE_FORMAT(agreement_start_date, '%Y-%m-%d') AS agreement_start_date,
      connector_status, loan_categories, business_notes, website_url, logo_path,
      created_at, updated_at
    FROM business_profiles
    ORDER BY id ASC
    LIMIT 1
  `;
  const [rows] = await pool.query(sql);
  if (!rows[0]) return null;

  const profile = { ...rows[0] };
  if (profile.loan_categories) {
    try {
      profile.loan_categories = typeof profile.loan_categories === 'string'
        ? JSON.parse(profile.loan_categories)
        : profile.loan_categories;
    } catch (e) {
      profile.loan_categories = [];
    }
  } else {
    profile.loan_categories = [];
  }
  return profile;
}

/**
 * Save or update the business profile (Ensuring No Duplicate Profiles)
 */
export async function upsertBusinessProfile(data) {
  const pool = getPool();
  const existing = await getBusinessProfile();

  const categoriesJson = JSON.stringify(data.loan_categories || []);

  if (existing) {
    const updateSql = `
      UPDATE business_profiles SET
        business_name = ?,
        owner_name = ?,
        business_type = ?,
        business_description = ?,
        business_start_date = ?,
        mobile_number = ?,
        whatsapp_number = ?,
        email = ?,
        alternate_contact = ?,
        address_line = ?,
        area = ?,
        city = ?,
        district = ?,
        state = ?,
        pin_code = ?,
        country = ?,
        lender_name = ?,
        connector_id = ?,
        agreement_reference = ?,
        agreement_start_date = ?,
        connector_status = ?,
        loan_categories = ?,
        business_notes = ?,
        website_url = ?,
        logo_path = ?,
        updated_at = NOW()
      WHERE id = ?
    `;
    const params = [
      data.business_name ?? existing.business_name,
      data.owner_name ?? existing.owner_name,
      data.business_type ?? existing.business_type,
      data.business_description ?? null,
      data.business_start_date || null,
      data.mobile_number ?? existing.mobile_number,
      data.whatsapp_number ?? existing.whatsapp_number,
      data.email ?? existing.email,
      data.alternate_contact || null,
      data.address_line || null,
      data.area || null,
      data.city || null,
      data.district || null,
      data.state || null,
      data.pin_code || null,
      data.country || 'India',
      data.lender_name || null,
      data.connector_id || null,
      data.agreement_reference || null,
      data.agreement_start_date || null,
      data.connector_status || 'Active',
      categoriesJson,
      data.business_notes || null,
      data.website_url || null,
      data.logo_path || null,
      existing.id,
    ];
    await pool.execute(updateSql, params);
    return getBusinessProfile();
  }

  const insertSql = `
    INSERT INTO business_profiles (
      business_name, owner_name, business_type, business_description,
      business_start_date, mobile_number, whatsapp_number, email,
      alternate_contact, address_line, area, city, district, state,
      pin_code, country, lender_name, connector_id, agreement_reference,
      agreement_start_date, connector_status, loan_categories,
      business_notes, website_url, logo_path, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, NOW(), NOW()
    )
  `;
  const insertParams = [
    data.business_name || 'Zippy Loan Connector',
    data.owner_name || 'M. Lingaswamy',
    data.business_type || 'Individual Loan Connector',
    data.business_description || null,
    data.business_start_date || null,
    data.mobile_number || '',
    data.whatsapp_number || '',
    data.email || '',
    data.alternate_contact || null,
    data.address_line || null,
    data.area || null,
    data.city || null,
    data.district || null,
    data.state || null,
    data.pin_code || null,
    data.country || 'India',
    data.lender_name || null,
    data.connector_id || null,
    data.agreement_reference || null,
    data.agreement_start_date || null,
    data.connector_status || 'Active',
    categoriesJson,
    data.business_notes || null,
    data.website_url || null,
    data.logo_path || null,
  ];
  await pool.execute(insertSql, insertParams);
  return getBusinessProfile();
}

/**
 * Log security and operational audit events
 */
export async function logAuditEvent({ adminUsername, action, details = null, ipAddress = null }) {
  try {
    const pool = getPool();
    const sql = `
      INSERT INTO audit_logs (admin_username, action, details, ip_address, created_at)
      VALUES (?, ?, ?, ?, NOW())
    `;
    const detailsString = typeof details === 'object' && details !== null ? JSON.stringify(details) : details;
    await pool.execute(sql, [adminUsername || 'SYSTEM', action, detailsString, ipAddress]);
  } catch (err) {
    console.error('[AUDIT] Failed to write audit event:', err.message);
  }
}

// =============================================================================
// PHASE 2: CUSTOMERS & LEADS QUERIES
// =============================================================================

/**
 * Auto-generate Customer Code: ZLC-CUS-000001
 */
export async function generateCustomerCode() {
  const pool = getPool();
  const [rows] = await pool.query('SELECT MAX(id) AS max_id FROM customers');
  const nextId = (rows[0]?.max_id || 0) + 1;
  return `ZLC-CUS-${String(nextId).padStart(6, '0')}`;
}

/**
 * Auto-generate Lead Code: ZLC-LEAD-000001
 */
export async function generateLeadCode() {
  const pool = getPool();
  const [rows] = await pool.query('SELECT MAX(id) AS max_id FROM loan_leads');
  const nextId = (rows[0]?.max_id || 0) + 1;
  return `ZLC-LEAD-${String(nextId).padStart(6, '0')}`;
}

/**
 * Check if a customer with the same mobile or email exists
 */
export async function checkCustomerDuplicate({ mobile_number, email = null, excludeId = null }) {
  const pool = getPool();
  let sql = 'SELECT id, customer_code, full_name, mobile_number, email FROM customers WHERE (mobile_number = ?';
  const params = [mobile_number];

  if (email && email.trim()) {
    sql += ' OR email = ?';
    params.push(email.trim());
  }
  sql += ')';

  if (excludeId) {
    sql += ' AND id != ?';
    params.push(excludeId);
  }

  sql += ' AND is_active = 1 LIMIT 1';

  const [rows] = await pool.execute(sql, params);
  return rows[0] || null;
}

/**
 * Fetch paginated list of customers with total leads count
 */
export async function getCustomers({ search = '', city = '', sort = 'newest', page = 1, limit = 10 }) {
  const pool = getPool();
  const offset = (Math.max(1, page) - 1) * limit;

  let whereClauses = ['c.is_active = 1'];
  let params = [];

  if (search && search.trim()) {
    const q = `%${search.trim()}%`;
    whereClauses.push('(c.full_name LIKE ? OR c.mobile_number LIKE ? OR c.customer_code LIKE ? OR c.email LIKE ?)');
    params.push(q, q, q, q);
  }

  if (city && city.trim()) {
    whereClauses.push('c.city = ?');
    params.push(city.trim());
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const orderSql = sort === 'oldest' ? 'ORDER BY c.id ASC' : 'ORDER BY c.id DESC';

  // Count total for pagination
  const countSql = `SELECT COUNT(*) AS total FROM customers c ${whereSql}`;
  const [countRows] = await pool.execute(countSql, params);
  const total = countRows[0]?.total || 0;

  // Fetch paginated rows with linked lead count
  const listSql = `
    SELECT 
      c.id, c.customer_code, c.full_name, c.mobile_number, c.alternate_mobile,
      c.email, DATE_FORMAT(c.date_of_birth, '%Y-%m-%d') AS date_of_birth,
      c.address, c.area, c.city, c.district, c.state, c.pin_code,
      c.employment_type, c.monthly_income, c.employer_name, c.business_name,
      c.occupation, c.customer_source, c.notes, c.is_active,
      c.created_at, c.updated_at,
      COUNT(l.id) AS total_leads
    FROM customers c
    LEFT JOIN loan_leads l ON l.customer_id = c.id
    ${whereSql}
    GROUP BY c.id
    ${orderSql}
    LIMIT ? OFFSET ?
  `;

  const [rows] = await pool.query(listSql, [...params, limit, offset]);

  return {
    customers: rows,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Fetch customer by ID with all their linked loan leads
 */
export async function getCustomerById(id) {
  const pool = getPool();
  const customerSql = `
    SELECT 
      id, customer_code, full_name, mobile_number, alternate_mobile,
      email, DATE_FORMAT(date_of_birth, '%Y-%m-%d') AS date_of_birth,
      address, area, city, district, state, pin_code,
      employment_type, monthly_income, employer_name, business_name,
      occupation, customer_source, notes, is_active,
      created_at, updated_at
    FROM customers
    WHERE id = ?
    LIMIT 1
  `;
  const [custRows] = await pool.execute(customerSql, [id]);
  if (!custRows[0]) return null;

  const customer = custRows[0];

  // Fetch all leads for this customer
  const leadsSql = `
    SELECT 
      id, lead_code, loan_type, required_amount, lead_source,
      DATE_FORMAT(enquiry_date, '%Y-%m-%d') AS enquiry_date,
      priority, lead_status,
      DATE_FORMAT(next_followup_date, '%Y-%m-%d') AS next_followup_date,
      followup_notes, notes, created_at, updated_at
    FROM loan_leads
    WHERE customer_id = ?
    ORDER BY id DESC
  `;
  const [leads] = await pool.execute(leadsSql, [id]);

  customer.leads = leads;
  return customer;
}

/**
 * Create a new customer
 */
export async function createCustomer(data) {
  const pool = getPool();
  const customerCode = data.customer_code || (await generateCustomerCode());

  const sql = `
    INSERT INTO customers (
      customer_code, full_name, mobile_number, alternate_mobile, email,
      date_of_birth, address, area, city, district, state, pin_code,
      employment_type, monthly_income, employer_name, business_name,
      occupation, customer_source, notes, is_active, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, 1, NOW(), NOW()
    )
  `;

  const params = [
    customerCode,
    data.full_name,
    data.mobile_number,
    data.alternate_mobile || null,
    data.email || null,
    data.date_of_birth || null,
    data.address || null,
    data.area || null,
    data.city || null,
    data.district || null,
    data.state || null,
    data.pin_code || null,
    data.employment_type || null,
    data.monthly_income ? Number(data.monthly_income) : null,
    data.employer_name || null,
    data.business_name || null,
    data.occupation || null,
    data.customer_source || 'Direct Enquiry',
    data.notes || null,
  ];

  const [result] = await pool.execute(sql, params);
  return getCustomerById(result.insertId);
}

/**
 * Update an existing customer
 */
export async function updateCustomer(id, data) {
  const pool = getPool();
  const sql = `
    UPDATE customers SET
      full_name = ?,
      mobile_number = ?,
      alternate_mobile = ?,
      email = ?,
      date_of_birth = ?,
      address = ?,
      area = ?,
      city = ?,
      district = ?,
      state = ?,
      pin_code = ?,
      employment_type = ?,
      monthly_income = ?,
      employer_name = ?,
      business_name = ?,
      occupation = ?,
      customer_source = ?,
      notes = ?,
      updated_at = NOW()
    WHERE id = ?
  `;

  const params = [
    data.full_name,
    data.mobile_number,
    data.alternate_mobile || null,
    data.email || null,
    data.date_of_birth || null,
    data.address || null,
    data.area || null,
    data.city || null,
    data.district || null,
    data.state || null,
    data.pin_code || null,
    data.employment_type || null,
    data.monthly_income ? Number(data.monthly_income) : null,
    data.employer_name || null,
    data.business_name || null,
    data.occupation || null,
    data.customer_source || 'Direct Enquiry',
    data.notes || null,
    id,
  ];

  await pool.execute(sql, params);
  return getCustomerById(id);
}

/**
 * Delete / Archive customer (safely protects customers with linked leads)
 */
export async function deleteCustomer(id) {
  const pool = getPool();
  // Check linked leads count
  const [leads] = await pool.execute('SELECT COUNT(*) AS count FROM loan_leads WHERE customer_id = ?', [id]);
  const hasLeads = (leads[0]?.count || 0) > 0;

  // Safe soft-delete / archival
  await pool.execute('UPDATE customers SET is_active = 0, updated_at = NOW() WHERE id = ?', [id]);

  return {
    archived: true,
    hasLinkedLeads: hasLeads,
    message: hasLeads
      ? 'Customer has linked loan leads and was safely archived rather than deleted.'
      : 'Customer removed successfully.',
  };
}

/**
 * Fetch paginated list of loan leads with joined customer details
 */
export async function getLeads({
  search = '',
  loan_type = '',
  lead_status = '',
  lead_source = '',
  startDate = '',
  endDate = '',
  sort = 'newest',
  page = 1,
  limit = 10,
}) {
  const pool = getPool();
  const offset = (Math.max(1, page) - 1) * limit;

  let whereClauses = [];
  let params = [];

  if (search && search.trim()) {
    const q = `%${search.trim()}%`;
    whereClauses.push('(l.lead_code LIKE ? OR c.full_name LIKE ? OR c.mobile_number LIKE ?)');
    params.push(q, q, q);
  }

  if (loan_type && loan_type.trim()) {
    whereClauses.push('l.loan_type = ?');
    params.push(loan_type.trim());
  }

  if (lead_status && lead_status.trim()) {
    whereClauses.push('l.lead_status = ?');
    params.push(lead_status.trim());
  }

  if (lead_source && lead_source.trim()) {
    whereClauses.push('l.lead_source = ?');
    params.push(lead_source.trim());
  }

  if (startDate && startDate.trim()) {
    whereClauses.push('l.enquiry_date >= ?');
    params.push(startDate.trim());
  }

  if (endDate && endDate.trim()) {
    whereClauses.push('l.enquiry_date <= ?');
    params.push(endDate.trim());
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const orderSql = sort === 'oldest' ? 'ORDER BY l.id ASC' : 'ORDER BY l.id DESC';

  // Count total leads matching filters
  const countSql = `
    SELECT COUNT(*) AS total
    FROM loan_leads l
    JOIN customers c ON c.id = l.customer_id
    ${whereSql}
  `;
  const [countRows] = await pool.execute(countSql, params);
  const total = countRows[0]?.total || 0;

  // Fetch paginated leads
  const listSql = `
    SELECT 
      l.id, l.lead_code, l.customer_id, l.loan_type, l.required_amount,
      l.employment_type, l.monthly_income, l.business_name, l.lead_source,
      DATE_FORMAT(l.enquiry_date, '%Y-%m-%d') AS enquiry_date,
      l.priority, l.lead_status,
      DATE_FORMAT(l.next_followup_date, '%Y-%m-%d') AS next_followup_date,
      l.followup_notes, l.admin_id, l.notes,
      l.created_at, l.updated_at,
      c.customer_code, c.full_name AS customer_name, c.mobile_number AS customer_mobile,
      c.email AS customer_email, c.city AS customer_city
    FROM loan_leads l
    JOIN customers c ON c.id = l.customer_id
    ${whereSql}
    ${orderSql}
    LIMIT ? OFFSET ?
  `;

  const [rows] = await pool.query(listSql, [...params, limit, offset]);

  return {
    leads: rows,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Fetch lead by ID with customer details and status history
 */
export async function getLeadById(id) {
  const pool = getPool();
  const leadSql = `
    SELECT 
      l.id, l.lead_code, l.customer_id, l.loan_type, l.required_amount,
      l.employment_type, l.monthly_income, l.business_name, l.lead_source,
      DATE_FORMAT(l.enquiry_date, '%Y-%m-%d') AS enquiry_date,
      l.priority, l.lead_status,
      DATE_FORMAT(l.next_followup_date, '%Y-%m-%d') AS next_followup_date,
      l.followup_notes, l.admin_id, l.notes,
      l.created_at, l.updated_at,
      c.customer_code, c.full_name AS customer_name, c.mobile_number AS customer_mobile,
      c.alternate_mobile AS customer_alternate_mobile,
      c.email AS customer_email, c.city AS customer_city, c.area AS customer_area,
      c.district AS customer_district, c.state AS customer_state, c.pin_code AS customer_pin
    FROM loan_leads l
    JOIN customers c ON c.id = l.customer_id
    WHERE l.id = ?
    LIMIT 1
  `;
  const [rows] = await pool.execute(leadSql, [id]);
  if (!rows[0]) return null;

  const lead = rows[0];

  // Fetch status history
  lead.status_history = await getLeadStatusHistory(id);
  return lead;
}

/**
 * Create a new loan lead and record initial status history
 */
export async function createLead(data, adminUsername = 'M.Lingaswamy@123', adminId = null) {
  const pool = getPool();
  const leadCode = data.lead_code || (await generateLeadCode());
  const status = data.lead_status || 'New';

  const insertSql = `
    INSERT INTO loan_leads (
      lead_code, customer_id, loan_type, required_amount,
      employment_type, monthly_income, business_name, lead_source,
      enquiry_date, priority, lead_status, next_followup_date,
      followup_notes, admin_id, notes, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, NOW(), NOW()
    )
  `;

  const params = [
    leadCode,
    data.customer_id,
    data.loan_type,
    Number(data.required_amount),
    data.employment_type || null,
    data.monthly_income ? Number(data.monthly_income) : null,
    data.business_name || null,
    data.lead_source || 'Direct Enquiry',
    data.enquiry_date || new Date().toISOString().substring(0, 10),
    data.priority || 'Medium',
    status,
    data.next_followup_date || null,
    data.followup_notes || null,
    adminId,
    data.notes || null,
  ];

  const [result] = await pool.execute(insertSql, params);
  const leadId = result.insertId;

  // Record initial status in lead_status_history
  await pool.execute(
    `INSERT INTO lead_status_history (lead_id, previous_status, new_status, changed_by, change_notes, created_at)
     VALUES (?, NULL, ?, ?, ?, NOW())`,
    [leadId, status, adminUsername, data.notes ? `Initial lead created: ${data.notes}` : 'Initial lead created']
  );

  return getLeadById(leadId);
}

/**
 * Update loan lead details
 */
export async function updateLead(id, data) {
  const pool = getPool();
  const sql = `
    UPDATE loan_leads SET
      loan_type = ?,
      required_amount = ?,
      employment_type = ?,
      monthly_income = ?,
      business_name = ?,
      lead_source = ?,
      enquiry_date = ?,
      priority = ?,
      next_followup_date = ?,
      followup_notes = ?,
      notes = ?,
      updated_at = NOW()
    WHERE id = ?
  `;

  const params = [
    data.loan_type,
    Number(data.required_amount),
    data.employment_type || null,
    data.monthly_income ? Number(data.monthly_income) : null,
    data.business_name || null,
    data.lead_source || 'Direct Enquiry',
    data.enquiry_date,
    data.priority || 'Medium',
    data.next_followup_date || null,
    data.followup_notes || null,
    data.notes || null,
    id,
  ];

  await pool.execute(sql, params);
  return getLeadById(id);
}

/**
 * Update lead status and record in history table
 */
export async function updateLeadStatus(id, { new_status, change_notes = '', changed_by = 'Admin' }) {
  const pool = getPool();

  // 1. Get current status
  const [rows] = await pool.execute('SELECT lead_status FROM loan_leads WHERE id = ?', [id]);
  if (!rows[0]) throw new Error('Lead not found');

  const previousStatus = rows[0].lead_status;

  // 2. Update status in loan_leads
  await pool.execute('UPDATE loan_leads SET lead_status = ?, updated_at = NOW() WHERE id = ?', [new_status, id]);

  // 3. Insert record in lead_status_history
  await pool.execute(
    `INSERT INTO lead_status_history (lead_id, previous_status, new_status, changed_by, change_notes, created_at)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [id, previousStatus, new_status, changed_by, change_notes || null]
  );

  return getLeadById(id);
}

/**
 * Fetch lead status history
 */
export async function getLeadStatusHistory(leadId) {
  const pool = getPool();
  const sql = `
    SELECT 
      id, lead_id, previous_status, new_status, changed_by, change_notes,
      created_at
    FROM lead_status_history
    WHERE lead_id = ?
    ORDER BY id DESC
  `;
  const [rows] = await pool.execute(sql, [leadId]);
  return rows;
}

/**
 * Fetch complete dashboard metrics from actual MySQL records
 */
export async function getDashboardSummary() {
  const pool = getPool();

  const [custRows] = await pool.query('SELECT COUNT(*) AS total FROM customers WHERE is_active = 1');
  const [leadRows] = await pool.query('SELECT COUNT(*) AS total FROM loan_leads');

  const [statusCounts] = await pool.query(`
    SELECT lead_status, COUNT(*) AS count
    FROM loan_leads
    GROUP BY lead_status
  `);

  const breakdown = {
    New: 0,
    Contacted: 0,
    Interested: 0,
    'Documents Pending': 0,
    Qualified: 0,
    Converted: 0,
    'Not Interested': 0,
    Duplicate: 0,
    Closed: 0,
  };

  statusCounts.forEach((r) => {
    if (r.lead_status in breakdown) {
      breakdown[r.lead_status] = Number(r.count);
    }
  });

  return {
    total_customers: custRows[0]?.total || 0,
    total_leads: leadRows[0]?.total || 0,
    new_leads: breakdown['New'],
    contacted_leads: breakdown['Contacted'],
    qualified_leads: breakdown['Qualified'],
    converted_leads: breakdown['Converted'],
    status_breakdown: breakdown,
  };
}

/**
 * Fetch recent customers
 */
export async function getRecentCustomers(limit = 5) {
  const pool = getPool();
  const sql = `
    SELECT 
      c.id, c.customer_code, c.full_name, c.mobile_number, c.city,
      c.employment_type, c.created_at,
      COUNT(l.id) AS total_leads
    FROM customers c
    LEFT JOIN loan_leads l ON l.customer_id = c.id
    WHERE c.is_active = 1
    GROUP BY c.id
    ORDER BY c.id DESC
    LIMIT ?
  `;
  const [rows] = await pool.query(sql, [limit]);
  return rows;
}

/**
 * Fetch recent leads
 */
export async function getRecentLeads(limit = 5) {
  const pool = getPool();
  const sql = `
    SELECT 
      l.id, l.lead_code, l.loan_type, l.required_amount, l.lead_status,
      l.priority, DATE_FORMAT(l.enquiry_date, '%Y-%m-%d') AS enquiry_date,
      l.created_at,
      c.full_name AS customer_name, c.mobile_number AS customer_mobile, c.city AS customer_city
    FROM loan_leads l
    JOIN customers c ON c.id = l.customer_id
    ORDER BY l.id DESC
    LIMIT ?
  `;
  const [rows] = await pool.query(sql, [limit]);
  return rows;
}
