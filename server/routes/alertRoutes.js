/**
 * Alerts Routes
 * GET /api/alerts/overdue — list currently overdue bookings
 * GET /api/alerts/due-soon — bookings due within next 24 hours
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
 */
function daysBetween(dateStr1, dateStr2) {
  const date1 = new Date(dateStr1);
  const date2 = new Date(dateStr2);
  const diffTime = date2 - date1;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Helper: Check and flag overdue bookings
 * Runs on every GET request to keep status current without cron
 */
function checkAndFlagOverdues() {
  try {
    const today = getTodayISO();

    // Find all active bookings where expected_return_date < today
    const overdueBookings = getAll(
      `SELECT id FROM bookings
       WHERE status = 'active' AND expected_return_date < ?`,
      [today]
    );

    overdueBookings.forEach((booking) => {
      // Update status to 'overdue'
      run('UPDATE bookings SET status = ? WHERE id = ?', ['overdue', booking.id]);

      // Log the status change
      const details = {
        action: 'Status changed from active to overdue',
        expected_return_date: booking.expected_return_date,
        flagged_date: today,
      };

      run(
        `INSERT INTO audit_log (action, entity_type, entity_id, details, performed_by)
         VALUES (?, ?, ?, ?, 'system')`,
        ['OVERDUE_FLAGGED', 'booking', booking.id, JSON.stringify(details)]
      );
    });
  } catch (error) {
    console.error('[checkAndFlagOverdues]', error);
  }
}

/**
 * GET /api/alerts/overdue
 * List all currently overdue bookings with borrower contact info,
 * days_overdue, and accumulated late fee so far.
 * Sorted by days_overdue descending (worst offenders first).
 *
 * Response: [
 *   {
 *     id: 1,
 *     borrower: { id, name, student_id, email, phone },
 *     equipment: { unit_label, equipment_type, model },
 *     checkout_date, expected_return_date,
 *     days_overdue, late_fee_rate_per_day,
 *     accumulated_late_fee
 *   },
 *   ...
 * ]
 */
router.get('/overdue', (req, res) => {
  try {
    // Flag overdue bookings before returning
    checkAndFlagOverdues();

    const today = getTodayISO();

    const overdueBookings = getAll(
      `SELECT 
        b.id, b.borrower_id, b.equipment_unit_id,
        b.checkout_date, b.expected_return_date, b.status,
        br.name, br.student_id, br.email, br.phone,
        eu.unit_label, eu.model,
        et.name as equipment_type, et.late_fee_per_day
      FROM bookings b
      JOIN borrowers br ON b.borrower_id = br.id
      JOIN equipment_units eu ON b.equipment_unit_id = eu.id
      JOIN equipment_types et ON eu.equipment_type_id = et.id
      WHERE b.status = 'overdue'
      ORDER BY b.expected_return_date ASC`,
      []
    );

    const result = overdueBookings.map((b) => {
      const daysOverdue = daysBetween(b.expected_return_date, today);
      const accumulatedLateFee = daysOverdue * b.late_fee_per_day;

      return {
        id: b.id,
        borrower: {
          id: b.borrower_id,
          name: b.name,
          student_id: b.student_id,
          email: b.email,
          phone: b.phone,
        },
        equipment: {
          unit_label: b.unit_label,
          equipment_type: b.equipment_type,
          model: b.model,
        },
        checkout_date: b.checkout_date,
        expected_return_date: b.expected_return_date,
        days_overdue: daysOverdue,
        late_fee_rate_per_day: b.late_fee_per_day,
        accumulated_late_fee: accumulatedLateFee,
      };
    });

    res.json(result);
  } catch (error) {
    console.error('[GET /api/alerts/overdue]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/alerts/due-soon
 * Bookings due within the next 24 hours (still active, not yet overdue).
 * Include borrower contact info so AV room staff can send manual reminders.
 *
 * Response: [
 *   {
 *     id: 1,
 *     borrower: { id, name, student_id, email, phone },
 *     equipment: { unit_label, equipment_type, model },
 *     checkout_date, expected_return_date,
 *     hours_until_due, status
 *   },
 *   ...
 * ]
 */
router.get('/due-soon', (req, res) => {
  try {
    const today = getTodayISO();
    const tomorrow = addDays(today, 1);

    const dueSoon = getAll(
      `SELECT 
        b.id, b.borrower_id, b.equipment_unit_id,
        b.checkout_date, b.expected_return_date, b.status,
        br.name, br.student_id, br.email, br.phone,
        eu.unit_label, eu.model,
        et.name as equipment_type
      FROM bookings b
      JOIN borrowers br ON b.borrower_id = br.id
      JOIN equipment_units eu ON b.equipment_unit_id = eu.id
      JOIN equipment_types et ON eu.equipment_type_id = et.id
      WHERE b.status = 'active'
        AND b.expected_return_date <= ?
        AND b.expected_return_date > ?
      ORDER BY b.expected_return_date ASC`,
      [tomorrow, today]
    );

    const result = dueSoon.map((b) => {
      const now = new Date();
      const dueDate = new Date(b.expected_return_date);
      const hoursUntilDue = Math.floor((dueDate - now) / (1000 * 60 * 60));

      return {
        id: b.id,
        borrower: {
          id: b.borrower_id,
          name: b.name,
          student_id: b.student_id,
          email: b.email,
          phone: b.phone,
        },
        equipment: {
          unit_label: b.unit_label,
          equipment_type: b.equipment_type,
          model: b.model,
        },
        checkout_date: b.checkout_date,
        expected_return_date: b.expected_return_date,
        hours_until_due: hoursUntilDue,
        status: b.status,
      };
    });

    res.json(result);
  } catch (error) {
    console.error('[GET /api/alerts/due-soon]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
