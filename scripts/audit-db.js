const { db } = require('../src/db/database');

console.log('=======================================================');
console.log('       Zippy Loan Connector Database & API Audit       ');
console.log('=======================================================');

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Total Tables Found:', tables.length);

tables.forEach(t => {
  try {
    const count = db.prepare(`SELECT count(*) as c FROM "${t.name}"`).get().c;
    console.log(`✅ Table [${t.name}]: ${count} records`);
  } catch (err) {
    console.error(`❌ Table [${t.name}] Query Error:`, err.message);
  }
});

console.log('\n--- Sample Records Verification ---');
const users = db.prepare('SELECT id, username, role, full_name FROM users LIMIT 5').all();
console.log('Users:', users);

const partners = db.prepare('SELECT id, name, type, tier, capacity_limit FROM partners LIMIT 5').all();
console.log('Partners:', partners);

const leads = db.prepare('SELECT l.id, l.lead_reference, c.full_name, l.requested_amount, l.status FROM leads l JOIN customers c ON l.customer_id = c.id LIMIT 5').all();
console.log('Leads:', leads);

const comms = db.prepare('SELECT id, lead_id, net_payable, status FROM commission_ledger LIMIT 5').all();
console.log('Commission Ledger:', comms);

const reminders = db.prepare('SELECT * FROM lead_reminders LIMIT 5').all();
console.log('Lead Reminders:', reminders);

console.log('=======================================================');
console.log('       Database Audit Completed Successfully!          ');
console.log('=======================================================');
