/**
 * In-memory test store for automated testing without requiring an active Hostinger MySQL connection.
 * Simulates MySQL InnoDB table behavior for admins, business_profiles, audit_logs, customers, loan_leads, and lead_status_history.
 */

let admins = [];
let businessProfiles = [];
let auditLogs = [];
let customers = [];
let loanLeads = [];
let leadStatusHistory = [];

let nextAdminId = 1;
let nextProfileId = 1;
let nextAuditId = 1;
let nextCustomerId = 1;
let nextLeadId = 1;
let nextHistoryId = 1;

export function resetTestDb() {
  admins = [];
  businessProfiles = [];
  auditLogs = [];
  customers = [];
  loanLeads = [];
  leadStatusHistory = [];
  nextAdminId = 1;
  nextProfileId = 1;
  nextAuditId = 1;
  nextCustomerId = 1;
  nextLeadId = 1;
  nextHistoryId = 1;
}

export const mockPool = {
  async query(sql, params = []) {
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

    // Customer code max_id
    if (s.includes('MAX(ID) AS MAX_ID FROM CUSTOMERS')) {
      const maxId = customers.reduce((max, c) => Math.max(max, c.id), 0);
      return [[{ max_id: maxId }]];
    }

    // Lead code max_id
    if (s.includes('MAX(ID) AS MAX_ID FROM LOAN_LEADS')) {
      const maxId = loanLeads.reduce((max, l) => Math.max(max, l.id), 0);
      return [[{ max_id: maxId }]];
    }

    // Dashboard summary counts
    if (s.includes('SELECT COUNT(*) AS TOTAL FROM CUSTOMERS WHERE IS_ACTIVE = 1')) {
      const active = customers.filter((c) => c.is_active === 1).length;
      return [[{ total: active }]];
    }

    if (s.includes('SELECT COUNT(*) AS TOTAL FROM LOAN_LEADS')) {
      return [[{ total: loanLeads.length }]];
    }

    if (s.includes('SELECT LEAD_STATUS, COUNT(*) AS COUNT FROM LOAN_LEADS')) {
      const counts = {};
      loanLeads.forEach((l) => {
        counts[l.lead_status] = (counts[l.lead_status] || 0) + 1;
      });
      const rows = Object.entries(counts).map(([lead_status, count]) => ({ lead_status, count }));
      return [rows];
    }

    // Recent customers
    if (s.includes('FROM CUSTOMERS C') && s.includes('ORDER BY C.ID DESC LIMIT')) {
      const limit = params[0] || 5;
      const recent = customers
        .filter((c) => c.is_active === 1)
        .slice()
        .reverse()
        .slice(0, limit)
        .map((c) => ({
          ...c,
          total_leads: loanLeads.filter((l) => l.customer_id === c.id).length,
        }));
      return [recent];
    }

    // Recent leads
    if (s.includes('FROM LOAN_LEADS L') && s.includes('ORDER BY L.ID DESC LIMIT')) {
      const limit = params[0] || 5;
      const recent = loanLeads
        .slice()
        .reverse()
        .slice(0, limit)
        .map((l) => {
          const cust = customers.find((c) => c.id === l.customer_id) || {};
          return {
            ...l,
            customer_name: cust.full_name || 'Unknown',
            customer_mobile: cust.mobile_number || '',
            customer_city: cust.city || '',
          };
        });
      return [recent];
    }

    // Paginated customers query
    if (s.includes('FROM CUSTOMERS C') && s.includes('LIMIT ? OFFSET ?')) {
      const limit = params[params.length - 2] || 10;
      const offset = params[params.length - 1] || 0;
      let filtered = customers.filter((c) => c.is_active === 1);

      // Search param
      if (s.includes('LIKE ?')) {
        const q = String(params[0] || '').replace(/%/g, '').toLowerCase();
        filtered = filtered.filter(
          (c) =>
            c.full_name.toLowerCase().includes(q) ||
            c.mobile_number.includes(q) ||
            c.customer_code.toLowerCase().includes(q) ||
            (c.email && c.email.toLowerCase().includes(q))
        );
      }

      const paged = filtered.slice(offset, offset + limit).map((c) => ({
        ...c,
        total_leads: loanLeads.filter((l) => l.customer_id === c.id).length,
      }));
      return [paged];
    }

    // Paginated leads query
    if (s.includes('FROM LOAN_LEADS L') && s.includes('LIMIT ? OFFSET ?')) {
      const limit = params[params.length - 2] || 10;
      const offset = params[params.length - 1] || 0;
      let filtered = loanLeads.slice();

      const paged = filtered.slice(offset, offset + limit).map((l) => {
        const cust = customers.find((c) => c.id === l.customer_id) || {};
        return {
          ...l,
          customer_code: cust.customer_code,
          customer_name: cust.full_name,
          customer_mobile: cust.mobile_number,
          customer_email: cust.email,
          customer_city: cust.city,
        };
      });
      return [paged];
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

    // 2B. UPDATE ADMINS PASSWORD
    if (s.includes('UPDATE ADMINS') && s.includes('PASSWORD_HASH = ?')) {
      const [newHash, username] = params;
      const found = admins.find((a) => a.username === username);
      if (found) {
        found.password_hash = newHash;
        found.updated_at = new Date();
      }
      return [{ affectedRows: found ? 1 : 0 }];
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

    // 6. CHECK CUSTOMER DUPLICATE
    if (s.includes('FROM CUSTOMERS') && s.includes('MOBILE_NUMBER = ?')) {
      const [mob, email, excludeId] = params;
      const found = customers.find(
        (c) =>
          c.is_active === 1 &&
          (!excludeId || c.id !== excludeId) &&
          (c.mobile_number === mob || (email && c.email && c.email.toLowerCase() === email.toLowerCase()))
      );
      return [[found || null]];
    }

    // 7. COUNT CUSTOMERS
    if (s.includes('SELECT COUNT(*) AS TOTAL FROM CUSTOMERS')) {
      const count = customers.filter((c) => c.is_active === 1).length;
      return [[{ total: count }]];
    }

    // 8. SELECT CUSTOMER BY ID
    if (s.includes('FROM CUSTOMERS') && s.includes('WHERE ID = ?')) {
      const [id] = params;
      const found = customers.find((c) => c.id === id);
      return [[found || null]];
    }

    // 9. INSERT INTO CUSTOMERS
    if (s.includes('INSERT INTO CUSTOMERS')) {
      const id = nextCustomerId++;
      const cust = {
        id,
        customer_code: params[0],
        full_name: params[1],
        mobile_number: params[2],
        alternate_mobile: params[3] || null,
        email: params[4] || null,
        date_of_birth: params[5] || null,
        address: params[6] || null,
        area: params[7] || null,
        city: params[8] || null,
        district: params[9] || null,
        state: params[10] || null,
        pin_code: params[11] || null,
        employment_type: params[12] || null,
        monthly_income: params[13] || null,
        employer_name: params[14] || null,
        business_name: params[15] || null,
        occupation: params[16] || null,
        customer_source: params[17] || 'Direct Enquiry',
        notes: params[18] || null,
        is_active: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      customers.push(cust);
      return [{ insertId: id }];
    }

    // 10. UPDATE CUSTOMERS
    if (s.includes('UPDATE CUSTOMERS SET')) {
      const id = params[params.length - 1];
      const idx = customers.findIndex((c) => c.id === id);
      if (idx !== -1) {
        if (s.includes('IS_ACTIVE = 0')) {
          customers[idx].is_active = 0;
        } else {
          customers[idx] = {
            ...customers[idx],
            full_name: params[0],
            mobile_number: params[1],
            alternate_mobile: params[2],
            email: params[3],
            date_of_birth: params[4],
            address: params[5],
            area: params[6],
            city: params[7],
            district: params[8],
            state: params[9],
            pin_code: params[10],
            employment_type: params[11],
            monthly_income: params[12],
            employer_name: params[13],
            business_name: params[14],
            occupation: params[15],
            customer_source: params[16],
            notes: params[17],
            updated_at: new Date().toISOString(),
          };
        }
      }
      return [{ affectedRows: 1 }];
    }

    // 11. CHECK LINKED LEADS COUNT
    if (s.includes('SELECT COUNT(*) AS COUNT FROM LOAN_LEADS WHERE CUSTOMER_ID = ?')) {
      const [cid] = params;
      const count = loanLeads.filter((l) => l.customer_id === cid).length;
      return [[{ count }]];
    }

    // 12. SELECT LEADS FOR CUSTOMER
    if (s.includes('FROM LOAN_LEADS') && s.includes('WHERE CUSTOMER_ID = ?')) {
      const [cid] = params;
      const leads = loanLeads.filter((l) => l.customer_id === cid);
      return [leads];
    }

    // 13. COUNT LOAN_LEADS
    if (s.includes('SELECT COUNT(*) AS TOTAL FROM LOAN_LEADS')) {
      return [[{ total: loanLeads.length }]];
    }

    // 14. SELECT LEAD BY ID
    if (s.includes('FROM LOAN_LEADS') && s.includes('WHERE L.ID = ?')) {
      const [id] = params;
      const found = loanLeads.find((l) => l.id === id);
      if (!found) return [[null]];
      const cust = customers.find((c) => c.id === found.customer_id) || {};
      return [[{
        ...found,
        customer_code: cust.customer_code,
        customer_name: cust.full_name,
        customer_mobile: cust.mobile_number,
        customer_alternate_mobile: cust.alternate_mobile,
        customer_email: cust.email,
        customer_city: cust.city,
        customer_area: cust.area,
        customer_district: cust.district,
        customer_state: cust.state,
        customer_pin: cust.pin_code,
      }]];
    }

    // 15. INSERT INTO LOAN_LEADS
    if (s.includes('INSERT INTO LOAN_LEADS')) {
      const id = nextLeadId++;
      const lead = {
        id,
        lead_code: params[0],
        customer_id: params[1],
        loan_type: params[2],
        required_amount: params[3],
        employment_type: params[4],
        monthly_income: params[5],
        business_name: params[6],
        lead_source: params[7],
        enquiry_date: params[8],
        priority: params[9],
        lead_status: params[10],
        next_followup_date: params[11],
        followup_notes: params[12],
        admin_id: params[13],
        notes: params[14],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      loanLeads.push(lead);
      return [{ insertId: id }];
    }

    // 16. INSERT INTO LEAD_STATUS_HISTORY
    if (s.includes('INSERT INTO LEAD_STATUS_HISTORY')) {
      const id = nextHistoryId++;
      leadStatusHistory.push({
        id,
        lead_id: params[0],
        previous_status: params[1],
        new_status: params[2],
        changed_by: params[3],
        change_notes: params[4],
        created_at: new Date().toISOString(),
      });
      return [{ insertId: id }];
    }

    // 17. GET STATUS OF LEAD
    if (s.includes('SELECT LEAD_STATUS FROM LOAN_LEADS WHERE ID = ?')) {
      const [id] = params;
      const found = loanLeads.find((l) => l.id === id);
      return [[found ? { lead_status: found.lead_status } : null]];
    }

    // 18. UPDATE STATUS OF LEAD
    if (s.includes('UPDATE LOAN_LEADS SET LEAD_STATUS = ?')) {
      const [newStatus, id] = params;
      const found = loanLeads.find((l) => l.id === id);
      if (found) found.lead_status = newStatus;
      return [{ affectedRows: 1 }];
    }

    // 19. UPDATE LEAD DETAILS
    if (s.includes('UPDATE LOAN_LEADS SET')) {
      const id = params[params.length - 1];
      const found = loanLeads.find((l) => l.id === id);
      if (found) {
        found.loan_type = params[0];
        found.required_amount = params[1];
        found.employment_type = params[2];
        found.monthly_income = params[3];
        found.business_name = params[4];
        found.lead_source = params[5];
        found.enquiry_date = params[6];
        found.priority = params[7];
        found.next_followup_date = params[8];
        found.followup_notes = params[9];
        found.notes = params[10];
        found.updated_at = new Date().toISOString();
      }
      return [{ affectedRows: 1 }];
    }

    // 20. GET LEAD STATUS HISTORY
    if (s.includes('FROM LEAD_STATUS_HISTORY WHERE LEAD_ID = ?')) {
      const [lid] = params;
      const history = leadStatusHistory.filter((h) => h.lead_id === lid).slice().reverse();
      return [history];
    }

    return [[]];
  },
};
