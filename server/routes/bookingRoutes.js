/**
 * Booking Routes
 * POST /api/bookings — create a new booking (checkout)
 * PATCH /api/bookings/:id/return — return equipment and calculate fees
 * GET /api/bookings — list bookings with filters
 * GET /api/bookings/:id — get single booking detail
 * GET /api/borrowers/:studentId/history — borrower booking history and stats
 */

const express = require('express');
const router = express.Router();
const { getAll, getOne, run } = require('../db');

/**
 * Helper: Calculate today's date as YYYY-MM-DD
 */
function getTodayISO() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Helper: Add days to a date string (YYYY-MM-DD)
 */
function addDays(dateStr, days) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

/**
 * Helper: Calculate days between two date strings (YYYY-MM-DD)
 * Returns negative if date2 is before date1
 */
function daysBetween(dateStr1, dateStr2) {
  const date1 = new Date(dateStr1);
  const date2 = new Date(dateStr2);
  const diffTime = date2 - date1;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Helper: Log audit entry
 */
function logAudit(action, entityType, entityId, details = {}) {
  const detailsJson = JSON.stringify(details);
  run(
    `INSERT INTO audit_log (action, entity_type, entity_id, details, performed_by)
     VALUES (?, ?, ?, ?, 'system')`,
    [action, entityType, entityId, detailsJson]
  );
}

/**
 * POST /api/bookings
 * Create a new booking (checkout equipment)
 *
 * Body: {
 *   student_id: "STU-2024-001",
 *   equipment_type_id: 1,
 *   checkout_date: "2024-09-20"  (optional, defaults to today)
 * }
 *
 * Validations (all 400 errors):
 *   1. Borrower must exist (by student_id)
 *   2. Borrower has no overdue bookings
 *   3. Borrower's active bookings < 2 (max 2 total across all types)
 *   4. Borrower's active bookings of THIS type < max_units_per_person
 *   5. At least one unit of this type must be available
 *
 * Response (201): Full booking object with equipment and borrower info
 */
router.post('/', (req, res) => {
  try {
    const { student_id, equipment_type_id, checkout_date } = req.body;

    // Validate required fields
    if (!student_id || !equipment_type_id) {
      return res
        .status(400)
        .json({ error: 'student_id and equipment_type_id are required' });
    }

    const typeId = parseInt(equipment_type_id, 10);
    if (isNaN(typeId) || typeId <= 0) {
      return res.status(400).json({ error: 'Invalid equipment_type_id' });
    }

    // Default checkout_date to today
    const checkoutDateStr = checkout_date || getTodayISO();

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(checkoutDateStr)) {
      return res.status(400).json({ error: 'checkout_date must be YYYY-MM-DD format' });
    }

    // ========== VALIDATION 1: Borrower exists ==========
    const borrower = getOne('SELECT * FROM borrowers WHERE student_id = ?', [student_id]);

    if (!borrower) {
      return res.status(400).json({ error: `Borrower with student_id '${student_id}' not found` });
    }

    // ========== VALIDATION 2: No overdue bookings ==========
    const overdueBooking = getOne(
      `SELECT id FROM bookings WHERE borrower_id = ? AND status = 'overdue'`,
      [borrower.id]
    );

    if (overdueBooking) {
      return res
        .status(400)
        .json({ error: 'Borrower has overdue bookings. Please return them before borrowing more.' });
    }

    // ========== VALIDATION 3: Check max 2 active bookings across all types ==========
    const activeCountResult = getOne(
      'SELECT COUNT(*) as count FROM bookings WHERE borrower_id = ? AND status = ?',
      [borrower.id, 'active']
    );

    const activeCount = activeCountResult.count;

    if (activeCount >= 2) {
      return res
        .status(400)
        .json({ error: 'Borrower already has 2 active bookings. Max 2 total allowed.' });
    }

    // ========== VALIDATION 4: Equipment type exists and check per-type limit ==========
    const equipmentType = getOne('SELECT * FROM equipment_types WHERE id = ?', [typeId]);

    if (!equipmentType) {
      return res.status(400).json({ error: 'Equipment type not found' });
    }

    const typeActiveCountResult = getOne(
      'SELECT COUNT(*) as count FROM bookings WHERE borrower_id = ? AND equipment_unit_id IN (SELECT id FROM equipment_units WHERE equipment_type_id = ?) AND status = ?',
      [borrower.id, typeId, 'active']
    );

    const typeActiveCount = typeActiveCountResult.count;

    if (typeActiveCount >= equipmentType.max_units_per_person) {
      return res.status(400).json({
        error: `Borrower already has ${equipmentType.max_units_per_person} active booking(s) of '${equipmentType.name}'. Max ${equipmentType.max_units_per_person} allowed.`,
      });
    }

    // ========== VALIDATION 5: Find available unit ==========
    const availableUnit = getOne(
      'SELECT * FROM equipment_units WHERE equipment_type_id = ? AND is_available = 1',
      [typeId]
    );

    if (!availableUnit) {
      return res.status(400).json({ error: 'No units available for this equipment type' });
    }

    // ========== CREATE BOOKING ==========
    const expectedReturnDate = addDays(checkoutDateStr, equipmentType.max_borrow_days);
    const depositPaid = equipmentType.deposit_amount;
    const conditionAtCheckout = availableUnit.condition;

    const bookingResult = run(
      `INSERT INTO bookings (
        borrower_id, equipment_unit_id, checkout_date, expected_return_date,
        condition_at_checkout, deposit_paid, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'active')`,
      [borrower.id, availableUnit.id, checkoutDateStr, expectedReturnDate, conditionAtCheckout, depositPaid]
    );

    const bookingId = bookingResult.lastInsertRowid;

    // ========== UPDATE UNIT AVAILABILITY ==========
    run('UPDATE equipment_units SET is_available = 0 WHERE id = ?', [availableUnit.id]);

    // ========== LOG AUDIT ==========
    logAudit('CHECKOUT', 'booking', bookingId, {
      borrower_id: borrower.id,
      borrower_name: borrower.name,
      equipment_unit_id: availableUnit.id,
      equipment_label: availableUnit.unit_label,
      equipment_type: equipmentType.name,
      checkout_date: checkoutDateStr,
      expected_return_date: expectedReturnDate,
      deposit_paid: depositPaid,
    });

    // ========== RETURN BOOKING DETAIL ==========
    const booking = getOne('SELECT * FROM bookings WHERE id = ?', [bookingId]);

    res.status(201).json({
      id: booking.id,
      borrower: {
        id: borrower.id,
        name: borrower.name,
        student_id: borrower.student_id,
        email: borrower.email,
      },
      equipment: {
        unit_id: availableUnit.id,
        unit_label: availableUnit.unit_label,
        type_name: equipmentType.name,
        model: availableUnit.model,
      },
      checkout_date: booking.checkout_date,
      expected_return_date: booking.expected_return_date,
      condition_at_checkout: booking.condition_at_checkout,
      deposit_paid: booking.deposit_paid,
      status: booking.status,
      created_at: booking.created_at,
    });
  } catch (error) {
    console.error('[POST /api/bookings]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/bookings/:id/return
 * Return equipment and calculate late fees and refunds
 *
 * Body: {
 *   condition_at_return: "good" | "fair" | "damaged" | "lost",
 *   damage_cost: 0 (optional, in ₹),
 *   notes: "..." (optional)
 * }
 *
 * Logic:
 *   1. actual_return_date = today
 *   2. days_late = max(0, actual_return_date - expected_return_date)
 *   3. late_fee_owed = days_late × equipment_type.late_fee_per_day
 *   4. deposit_refunded = max(0, deposit_paid - late_fee_owed - damage_cost)
 *   5. Update booking, unit availability, log audit
 *
 * Response: Booking with fee breakdown
 */
router.patch('/:id/return', (req, res) => {
  try {
    const bookingId = parseInt(req.params.id, 10);
    const { condition_at_return, damage_cost = 0, notes = '' } = req.body;

    if (isNaN(bookingId) || bookingId <= 0) {
      return res.status(400).json({ error: 'Invalid booking ID' });
    }

    if (!condition_at_return) {
      return res.status(400).json({ error: 'condition_at_return is required' });
    }

    const validConditions = ['good', 'fair', 'damaged', 'lost'];
    if (!validConditions.includes(condition_at_return)) {
      return res.status(400).json({
        error: `condition_at_return must be one of: ${validConditions.join(', ')}`,
      });
    }

    if (isNaN(damage_cost) || damage_cost < 0) {
      return res.status(400).json({ error: 'damage_cost must be a non-negative number' });
    }

    // ========== GET BOOKING ==========
    const booking = getOne('SELECT * FROM bookings WHERE id = ?', [bookingId]);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status === 'returned') {
      return res.status(400).json({ error: 'Booking already returned' });
    }

    // ========== GET EQUIPMENT TYPE FOR LATE FEE RATE ==========
    const unit = getOne('SELECT * FROM equipment_units WHERE id = ?', [booking.equipment_unit_id]);
    const equipmentType = getOne('SELECT * FROM equipment_types WHERE id = ?', [unit.equipment_type_id]);

    // ========== CALCULATE FEES ==========
    const today = getTodayISO();
    const daysLate = Math.max(0, daysBetween(booking.expected_return_date, today));
    const lateFeesOwed = daysLate * equipmentType.late_fee_per_day;
    const damageCostInt = Math.max(0, parseInt(damage_cost, 10));
    const totalDeduction = lateFeesOwed + damageCostInt;
    const depositRefunded = Math.max(0, booking.deposit_paid - totalDeduction);

    // ========== UPDATE BOOKING ==========
    run(
      `UPDATE bookings
       SET actual_return_date = ?, condition_at_return = ?, late_fee_owed = ?, damage_cost = ?,
           deposit_refunded = ?, status = 'returned', notes = ?
       WHERE id = ?`,
      [today, condition_at_return, lateFeesOwed, damageCostInt, depositRefunded, notes, bookingId]
    );

    // ========== UPDATE UNIT AVAILABILITY ==========
    run('UPDATE equipment_units SET is_available = 1, condition = ? WHERE id = ?', [
      condition_at_return,
      booking.equipment_unit_id,
    ]);

    // ========== LOG AUDIT ==========
    logAudit('RETURN', 'booking', bookingId, {
      actual_return_date: today,
      condition_at_return,
      days_late: daysLate,
      late_fee_owed: lateFeesOwed,
      damage_cost: damageCostInt,
      deposit_refunded: depositRefunded,
      notes,
    });

    // ========== RETURN BOOKING WITH FEE BREAKDOWN ==========
    const borrower = getOne('SELECT * FROM borrowers WHERE id = ?', [booking.borrower_id]);

    const updatedBooking = getOne('SELECT * FROM bookings WHERE id = ?', [bookingId]);

    res.json({
      id: updatedBooking.id,
      borrower: {
        id: borrower.id,
        name: borrower.name,
        student_id: borrower.student_id,
      },
      equipment: {
        unit_label: unit.unit_label,
        equipment_type: equipmentType.name,
      },
      checkout_date: updatedBooking.checkout_date,
      expected_return_date: updatedBooking.expected_return_date,
      actual_return_date: updatedBooking.actual_return_date,
      condition_at_checkout: updatedBooking.condition_at_checkout,
      condition_at_return: updatedBooking.condition_at_return,
      status: updatedBooking.status,
      fee_breakdown: {
        deposit_paid: updatedBooking.deposit_paid,
        days_late: daysLate,
        late_fee_rate_per_day: equipmentType.late_fee_per_day,
        late_fees_owed: lateFeesOwed,
        damage_cost: damageCostInt,
        total_deduction: totalDeduction,
        deposit_refunded: depositRefunded,
      },
    });
  } catch (error) {
    console.error('[PATCH /api/bookings/:id/return]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/bookings
 * List bookings with optional filters
 *
 * Query params:
 *   status: "active" | "returned" | "overdue" (optional, can repeat)
 *   borrower_id: integer (optional)
 *
 * Response: [
 *   {
 *     id: 1,
 *     borrower: { id, name, student_id },
 *     equipment: { unit_label, equipment_type },
 *     checkout_date, expected_return_date, actual_return_date,
 *     status, created_at,
 *     late_fee_owed, deposit_refunded
 *   },
 *   ...
 * ]
 */
router.get('/', (req, res) => {
  try {
    const { status, borrower_id } = req.query;

    let sql = `
      SELECT 
        b.id, b.borrower_id, b.equipment_unit_id,
        b.checkout_date, b.expected_return_date, b.actual_return_date,
        b.status, b.created_at, b.late_fee_owed, b.deposit_refunded,
        br.name as borrower_name, br.student_id,
        eu.unit_label, et.name as equipment_type
      FROM bookings b
      JOIN borrowers br ON b.borrower_id = br.id
      JOIN equipment_units eu ON b.equipment_unit_id = eu.id
      JOIN equipment_types et ON eu.equipment_type_id = et.id
      WHERE 1=1
    `;

    const params = [];

    if (status) {
      const statusList = Array.isArray(status) ? status : [status];
      const placeholders = statusList.map(() => '?').join(',');
      sql += ` AND b.status IN (${placeholders})`;
      params.push(...statusList);
    }

    if (borrower_id) {
      const borrowerId = parseInt(borrower_id, 10);
      if (!isNaN(borrowerId)) {
        sql += ' AND b.borrower_id = ?';
        params.push(borrowerId);
      }
    }

    sql += ' ORDER BY b.checkout_date DESC';

    const bookings = getAll(sql, params);

    const result = bookings.map((b) => ({
      id: b.id,
      borrower: {
        id: b.borrower_id,
        name: b.borrower_name,
        student_id: b.student_id,
      },
      equipment: {
        unit_label: b.unit_label,
        equipment_type: b.equipment_type,
      },
      checkout_date: b.checkout_date,
      expected_return_date: b.expected_return_date,
      actual_return_date: b.actual_return_date,
      status: b.status,
      created_at: b.created_at,
      late_fee_owed: b.late_fee_owed,
      deposit_refunded: b.deposit_refunded,
    }));

    res.json(result);
  } catch (error) {
    console.error('[GET /api/bookings]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/bookings/:id
 * Get single booking detail with full info
 */
router.get('/:id', (req, res) => {
  try {
    const bookingId = parseInt(req.params.id, 10);

    if (isNaN(bookingId) || bookingId <= 0) {
      return res.status(400).json({ error: 'Invalid booking ID' });
    }

    const booking = getOne(
      `SELECT 
        b.*, br.name as borrower_name, br.student_id, br.email,
        eu.unit_label, eu.serial_number, eu.model, et.name as equipment_type,
        et.late_fee_per_day
      FROM bookings b
      JOIN borrowers br ON b.borrower_id = br.id
      JOIN equipment_units eu ON b.equipment_unit_id = eu.id
      JOIN equipment_types et ON eu.equipment_type_id = et.id
      WHERE b.id = ?`,
      [bookingId]
    );

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({
      id: booking.id,
      borrower: {
        id: booking.borrower_id,
        name: booking.borrower_name,
        student_id: booking.student_id,
        email: booking.email,
      },
      equipment: {
        unit_id: booking.equipment_unit_id,
        unit_label: booking.unit_label,
        serial_number: booking.serial_number,
        model: booking.model,
        equipment_type: booking.equipment_type,
      },
      checkout_date: booking.checkout_date,
      expected_return_date: booking.expected_return_date,
      actual_return_date: booking.actual_return_date,
      condition_at_checkout: booking.condition_at_checkout,
      condition_at_return: booking.condition_at_return,
      status: booking.status,
      deposit_paid: booking.deposit_paid,
      late_fee_owed: booking.late_fee_owed,
      damage_cost: booking.damage_cost,
      deposit_refunded: booking.deposit_refunded,
      notes: booking.notes,
      created_at: booking.created_at,
    });
  } catch (error) {
    console.error('[GET /api/bookings/:id]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/borrowers/:studentId/history
 * Get borrower history and stats
 *
 * Response: {
 *   borrower: { id, name, student_id, email },
 *   stats: { total_bookings, times_late, total_late_fees_paid },
 *   active_bookings: [...],
 *   returned_bookings: [...]
 * }
 */
router.get('/borrowers/:studentId/history', (req, res) => {
  try {
    const { studentId } = req.params;

    const borrower = getOne('SELECT * FROM borrowers WHERE student_id = ?', [studentId]);

    if (!borrower) {
      return res.status(404).json({ error: 'Borrower not found' });
    }

    // Get all bookings for this borrower
    const allBookings = getAll(
      `SELECT 
        b.*, eu.unit_label, et.name as equipment_type
      FROM bookings b
      JOIN equipment_units eu ON b.equipment_unit_id = eu.id
      JOIN equipment_types et ON eu.equipment_type_id = et.id
      WHERE b.borrower_id = ?
      ORDER BY b.checkout_date DESC`,
      [borrower.id]
    );

    // Calculate stats
    const totalBookings = allBookings.length;
    const timesLate = allBookings.filter((b) => b.late_fee_owed > 0).length;
    const totalLateFeePaid = allBookings.reduce((sum, b) => sum + (b.late_fee_owed || 0), 0);

    // Separate active and returned
    const activeBookings = allBookings
      .filter((b) => b.status !== 'returned')
      .map((b) => ({
        id: b.id,
        equipment: { unit_label: b.unit_label, equipment_type: b.equipment_type },
        checkout_date: b.checkout_date,
        expected_return_date: b.expected_return_date,
        status: b.status,
      }));

    const returnedBookings = allBookings
      .filter((b) => b.status === 'returned')
      .map((b) => ({
        id: b.id,
        equipment: { unit_label: b.unit_label, equipment_type: b.equipment_type },
        checkout_date: b.checkout_date,
        actual_return_date: b.actual_return_date,
        late_fee_owed: b.late_fee_owed,
        deposit_refunded: b.deposit_refunded,
      }));

    res.json({
      borrower: {
        id: borrower.id,
        name: borrower.name,
        student_id: borrower.student_id,
        email: borrower.email,
      },
      stats: {
        total_bookings: totalBookings,
        times_late: timesLate,
        total_late_fees_paid: totalLateFeePaid,
      },
      active_bookings: activeBookings,
      returned_bookings: returnedBookings,
    });
  } catch (error) {
    console.error('[GET /api/borrowers/:studentId/history]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
