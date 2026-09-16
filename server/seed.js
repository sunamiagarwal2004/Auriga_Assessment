/**
 * Seed script for AV Room Gear Tracker
 * Idempotent — safe to re-run multiple times
 * Clears existing data and repopulates with test fixtures
 */

const { db, initializeSchema, run, getAll } = require('./db');

function seed() {
  try {
    console.log('🌱 Starting seed...');

    // Initialize schema
    initializeSchema();

    // Clear existing data (preserve schema)
    console.log('  Clearing existing data...');
    run('DELETE FROM audit_log');
    run('DELETE FROM bookings');
    run('DELETE FROM equipment_units');
    run('DELETE FROM borrowers');
    run('DELETE FROM equipment_types');

    // ==========================================
    // SEED: Equipment Types
    // ==========================================
    console.log('  Seeding equipment types...');

    const equipmentTypes = [
      {
        name: 'DSLR Camera',
        late_fee_per_day: 50,
        deposit_amount: 500,
        max_borrow_days: 3,
        max_units_per_person: 1,
      },
      {
        name: 'Projector',
        late_fee_per_day: 75,
        deposit_amount: 300,
        max_borrow_days: 2,
        max_units_per_person: 1,
      },
      {
        name: 'Condenser Mic',
        late_fee_per_day: 30,
        deposit_amount: 200,
        max_borrow_days: 3,
        max_units_per_person: 2,
      },
      {
        name: 'Tripod',
        late_fee_per_day: 20,
        deposit_amount: 150,
        max_borrow_days: 5,
        max_units_per_person: 2,
      },
    ];

    const typeIds = {};
    equipmentTypes.forEach((type) => {
      const result = run(
        `INSERT INTO equipment_types (name, late_fee_per_day, deposit_amount, max_borrow_days, max_units_per_person)
         VALUES (?, ?, ?, ?, ?)`,
        [
          type.name,
          type.late_fee_per_day,
          type.deposit_amount,
          type.max_borrow_days,
          type.max_units_per_person,
        ]
      );
      typeIds[type.name] = result.lastInsertRowid;
    });

    console.log(`    ✓ ${equipmentTypes.length} equipment types inserted`);

    // ==========================================
    // SEED: Equipment Units
    // ==========================================
    console.log('  Seeding equipment units...');

    const equipmentUnits = [
      // DSLRs (3 units)
      {
        equipment_type_id: typeIds['DSLR Camera'],
        unit_label: 'DSLR-001',
        serial_number: 'CANON-5D-2024-001',
        model: 'Canon EOS 5D Mark IV',
        condition: 'good',
        purchase_date: '2023-01-15',
      },
      {
        equipment_type_id: typeIds['DSLR Camera'],
        unit_label: 'DSLR-002',
        serial_number: 'NIKON-D850-2024-001',
        model: 'Nikon D850',
        condition: 'good',
        purchase_date: '2023-03-20',
      },
      {
        equipment_type_id: typeIds['DSLR Camera'],
        unit_label: 'DSLR-003',
        serial_number: 'SONY-A7R-2024-001',
        model: 'Sony Alpha A7R V',
        condition: 'good',
        purchase_date: '2023-06-10',
      },

      // Projectors (2 units)
      {
        equipment_type_id: typeIds['Projector'],
        unit_label: 'PROJ-001',
        serial_number: 'EPSON-EB2250-001',
        model: 'Epson EB-2250U',
        condition: 'good',
        purchase_date: '2022-11-05',
      },
      {
        equipment_type_id: typeIds['Projector'],
        unit_label: 'PROJ-002',
        serial_number: 'PANASONIC-PT-RZ970-001',
        model: 'Panasonic PT-RZ970',
        condition: 'fair',
        purchase_date: '2022-08-12',
      },

      // Condenser Mics (4 units)
      {
        equipment_type_id: typeIds['Condenser Mic'],
        unit_label: 'MIC-001',
        serial_number: 'RODE-NT1-2024-001',
        model: 'Rode NT1',
        condition: 'good',
        purchase_date: '2023-02-28',
      },
      {
        equipment_type_id: typeIds['Condenser Mic'],
        unit_label: 'MIC-002',
        serial_number: 'RODE-NT1-2024-002',
        model: 'Rode NT1',
        condition: 'good',
        purchase_date: '2023-02-28',
      },
      {
        equipment_type_id: typeIds['Condenser Mic'],
        unit_label: 'MIC-003',
        serial_number: 'AUDIO-TECHNICA-AT2020-001',
        model: 'Audio-Technica AT2020',
        condition: 'good',
        purchase_date: '2023-04-10',
      },
      {
        equipment_type_id: typeIds['Condenser Mic'],
        unit_label: 'MIC-004',
        serial_number: 'SHURE-SM137-001',
        model: 'Shure SM137',
        condition: 'good',
        purchase_date: '2023-05-22',
      },

      // Tripods (5 units)
      {
        equipment_type_id: typeIds['Tripod'],
        unit_label: 'TRIPOD-001',
        serial_number: 'MANFROTTO-MT055-001',
        model: 'Manfrotto MT055XPRO3',
        condition: 'good',
        purchase_date: '2022-12-01',
      },
      {
        equipment_type_id: typeIds['Tripod'],
        unit_label: 'TRIPOD-002',
        serial_number: 'MANFROTTO-MT055-002',
        model: 'Manfrotto MT055XPRO3',
        condition: 'good',
        purchase_date: '2022-12-01',
      },
      {
        equipment_type_id: typeIds['Tripod'],
        unit_label: 'TRIPOD-003',
        serial_number: 'GITZO-GT2545E-001',
        model: 'Gitzo Systematic GT2545E',
        condition: 'good',
        purchase_date: '2023-01-30',
      },
      {
        equipment_type_id: typeIds['Tripod'],
        unit_label: 'TRIPOD-004',
        serial_number: 'SACHTLER-FSB4-001',
        model: 'Sachtler FSB-4 Fluid',
        condition: 'fair',
        purchase_date: '2022-09-15',
      },
      {
        equipment_type_id: typeIds['Tripod'],
        unit_label: 'TRIPOD-005',
        serial_number: 'VINTEN-POZI-001',
        model: 'Vinten POZI-X Fluid',
        condition: 'good',
        purchase_date: '2023-03-08',
      },
    ];

    equipmentUnits.forEach((unit) => {
      run(
        `INSERT INTO equipment_units (equipment_type_id, unit_label, serial_number, model, condition, purchase_date, is_available)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [
          unit.equipment_type_id,
          unit.unit_label,
          unit.serial_number,
          unit.model,
          unit.condition,
          unit.purchase_date,
        ]
      );
    });

    console.log(`    ✓ ${equipmentUnits.length} equipment units inserted`);

    // ==========================================
    // SEED: Borrowers
    // ==========================================
    console.log('  Seeding borrowers...');

    const borrowers = [
      {
        name: 'Raj Kumar',
        student_id: 'STU-2024-001',
        email: 'raj.kumar@college.edu',
        phone: '9876543210',
      },
      {
        name: 'Priya Singh',
        student_id: 'STU-2024-002',
        email: 'priya.singh@college.edu',
        phone: '9876543211',
      },
    ];

    borrowers.forEach((borrower) => {
      run(
        `INSERT INTO borrowers (name, student_id, email, phone)
         VALUES (?, ?, ?, ?)`,
        [borrower.name, borrower.student_id, borrower.email, borrower.phone]
      );
    });

    console.log(`    ✓ ${borrowers.length} borrowers inserted`);

    // ==========================================
    // SUMMARY
    // ==========================================
    console.log('\n✅ Seed completed successfully!\n');

    // Display summary
    const equipmentTypesCount = getAll('SELECT COUNT(*) as count FROM equipment_types')[0]
      .count;
    const equipmentUnitsCount = getAll('SELECT COUNT(*) as count FROM equipment_units')[0]
      .count;
    const borrowersCount = getAll('SELECT COUNT(*) as count FROM borrowers')[0].count;

    console.log('📊 Summary:');
    console.log(`  • Equipment Types: ${equipmentTypesCount}`);
    console.log(`  • Equipment Units: ${equipmentUnitsCount}`);
    console.log(`  • Borrowers: ${borrowersCount}`);
    console.log(`  • Bookings: 0`);
    console.log(`  • Audit Logs: 0`);

    console.log('\n📋 Database file: ./server/av_room.db');
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  }
}

// Run seed if this script is executed directly
if (require.main === module) {
  seed();
}

module.exports = { seed };
