/**
 * In-memory test store for automated testing without requiring an active Hostinger MySQL connection.
 * Simulates MySQL InnoDB table behavior for admins, business_profiles, and audit_logs.
 */

let admins = [];
let businessProfiles = [];
let auditLogs = [];
let nextAdminId = 1;
let nextProfileId = 1;
let nextAuditId = 1;

export function resetTestDb() {
  admins = [];
  businessProfiles = [];
  auditLogs = [];
  nextAdminId = 1;
  nextProfileId = 1;
  nextAuditId = 1;
}

export const mockPool = {
  async query(sql) {
    const s = sql.trim().toUpperCase().replace(/\s+/g, ' ');
    if (s.includes('SELECT 1 + 1')) {
      return [[{ result: 2, server_time: new Date() }]];
    }
    if (s.includes('COUNT(*) AS TOTAL FROM ADMINS')) {
      return [[{ total: admins.length }]];
    }
    if (s.includes('FROM BUSINESS_PROFILES')) {
      const p = businessProfiles[0] || null;
      return [[p]];
    }
    return [[]];
  },

  async execute(sql, params = []) {
    const s = sql.trim().toUpperCase().replace(/\s+/g, ' ');

    // 1. SELECT ADMIN BY USERNAME
    if (s.includes('SELECT') && s.includes('FROM ADMINS') && s.includes('WHERE USERNAME = ?')) {
      const [username] = params;
      const found = admins.find((a) => a.username === username);
      return [[found || null]];
    }

    // 2. INSERT INTO ADMINS
    if (s.includes('INSERT INTO ADMINS')) {
      const [username, password_hash, role] = params;
      const id = nextAdminId++;
      const admin = {
        id,
        username,
        password_hash,
        role: role || 'admin',
        is_active: 1,
        created_at: new Date(),
        updated_at: new Date(),
      };
      admins.push(admin);
      return [{ insertId: id }];
    }

    // 3. INSERT INTO BUSINESS_PROFILES
    if (s.includes('INSERT INTO BUSINESS_PROFILES')) {
      const id = nextProfileId++;
      const profile = {
        id,
        business_name: params[0],
        owner_name: params[1],
        business_type: params[2],
        business_description: params[3],
        business_start_date: params[4],
        mobile_number: params[5],
        whatsapp_number: params[6],
        email: params[7],
        alternate_contact: params[8],
        address_line: params[9],
        area: params[10],
        city: params[11],
        district: params[12],
        state: params[13],
        pin_code: params[14],
        country: params[15],
        lender_name: params[16],
        connector_id: params[17],
        agreement_reference: params[18],
        agreement_start_date: params[19],
        connector_status: params[20],
        loan_categories: params[21],
        business_notes: params[22],
        website_url: params[23],
        logo_path: params[24],
        created_at: new Date(),
        updated_at: new Date(),
      };
      businessProfiles[0] = profile;
      return [{ insertId: id }];
    }

    // 4. UPDATE BUSINESS_PROFILES
    if (s.includes('UPDATE BUSINESS_PROFILES')) {
      const existing = businessProfiles[0] || {};
      const updated = {
        ...existing,
        business_name: params[0],
        owner_name: params[1],
        business_type: params[2],
        business_description: params[3],
        business_start_date: params[4],
        mobile_number: params[5],
        whatsapp_number: params[6],
        email: params[7],
        alternate_contact: params[8],
        address_line: params[9],
        area: params[10],
        city: params[11],
        district: params[12],
        state: params[13],
        pin_code: params[14],
        country: params[15],
        lender_name: params[16],
        connector_id: params[17],
        agreement_reference: params[18],
        agreement_start_date: params[19],
        connector_status: params[20],
        loan_categories: params[21],
        business_notes: params[22],
        website_url: params[23],
        logo_path: params[24],
        updated_at: new Date(),
      };
      businessProfiles[0] = updated;
      return [{ affectedRows: 1 }];
    }

    // 5. INSERT INTO AUDIT_LOGS
    if (s.includes('INSERT INTO AUDIT_LOGS')) {
      const id = nextAuditId++;
      auditLogs.push({
        id,
        admin_username: params[0],
        action: params[1],
        details: params[2],
        ip_address: params[3],
        created_at: new Date(),
      });
      return [{ insertId: id }];
    }

    return [[]];
  },
};
