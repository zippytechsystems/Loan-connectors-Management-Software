import { getPool } from './connection.js';

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
