// Initialize admin account and seed reference data on startup
// LSPD / DOJ Case Filing System

const bcrypt = require('bcryptjs');
const { getDatabase } = require('./db');

async function initializeAdmin() {
  try {
    const db = getDatabase();

    // ───── Seed super_admin account ─────
    const adminUsername = process.env.ADMIN_USERNAME?.trim().toUpperCase();
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminName = process.env.ADMIN_NAME?.trim();

    if (!adminUsername || !adminPassword || !adminName) {
      console.warn('  Admin seed skipped: ADMIN_USERNAME, ADMIN_PASSWORD, and ADMIN_NAME must be configured');
    } else {
      const existingAdmin = await db.collection('users').findOne({ username: adminUsername });
      if (!existingAdmin) {
        const password_hash = await bcrypt.hash(adminPassword, 12);

      const adminAccount = {
        username: adminUsername,
        name: adminName,
        password_hash,
        department: 'DA',
        position: 'District Attorney',
        account_status: 'active',
        admin_role: 'super_admin',
        verified_by: null,
        rejection_reason: null,
        email: process.env.ADMIN_EMAIL || null,
        last_login: null,
        login_attempts: 0,
        created_at: new Date(),
        updated_at: new Date()
      };

        await db.collection('users').insertOne(adminAccount);
        console.log(`  Admin account initialized (${adminUsername})`);
      }
    }

    // ───── Seed default departments ─────
    const Department = require('../models/Department');
    Department.setDB(db);
    await Department.seedDefaults();
    console.log('  Default departments seeded');

    // ───── Seed default charges ─────
    const Charge = require('../models/Charge');
    Charge.setDB(db);
    await Charge.seedDefaults();
    console.log('  Default charges seeded');

    // ───── Seed default document templates ─────
    await seedDocumentTemplates(db);
    console.log('  Default document templates seeded');

  } catch (error) {
    console.error('Failed to initialize admin/seed data:', error);
  }
}

/**
 * Seed document templates for the existing fillable PDFs
 */
async function seedDocumentTemplates(db) {
  const templates = [
    {
      name: 'DOJ Official Letter',
      applies_to_positions: ['Assistant District Attorney', 'Deputy District Attorney', 'District Attorney', 'Associate Justice', 'Chief of Justice'],
      applies_to_charge_types: ['felony', 'misdemeanor', 'infraction'],
      pdf_template_path: '/Assets/doj_letter_fillable.pdf',
      field_map: {
        // PDF field name -> dot path in Case object
        'to_name': 'defendant_name',
        'case_number': 'case_number',
        'charges': 'charges',
        'narrative': 'affidavit.narrative'
      }
    },
    {
      name: 'Search Warrant',
      applies_to_positions: ['Judge', 'Associate Justice', 'Chief of Justice'],
      applies_to_charge_types: ['felony'],
      pdf_template_path: '/Assets/search_warrant_fillable.pdf',
      field_map: {
        'warrant_no': 'case_number',
        'defendant_name': 'defendant_name',
        'charges': 'charges',
        'narrative': 'affidavit.narrative'
      }
    },
    {
      name: 'Subpoena',
      applies_to_positions: ['Assistant District Attorney', 'Deputy District Attorney', 'District Attorney', 'Judge', 'Associate Justice', 'Chief of Justice'],
      applies_to_charge_types: ['felony', 'misdemeanor'],
      pdf_template_path: '/Assets/subpoena_fillable.pdf',
      field_map: {
        'case_no': 'case_number',
        'defendant_name': 'defendant_name',
        'charges': 'charges'
      }
    },
    {
      name: 'Warrant of Arrest',
      applies_to_positions: ['Judge', 'Associate Justice', 'Chief of Justice'],
      applies_to_charge_types: ['felony'],
      pdf_template_path: '/Assets/warrant_of_arrest_fillable.pdf',
      field_map: {
        'criminal_case_no': 'case_number',
        'defendant_name': 'defendant_name',
        'charges': 'charges',
        'officer_statement': 'affidavit.officer_statement'
      }
    }
  ];

  for (const template of templates) {
    const existing = await db.collection('document_templates').findOne({ name: template.name });
    if (!existing) {
      await db.collection('document_templates').insertOne({
        ...template,
        created_at: new Date(),
        updated_at: new Date()
      });
    }
  }
}

module.exports = { initializeAdmin };
