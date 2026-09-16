/**
 * Reports Routes
 * GET /api/reports/repeat-offenders — borrowers with 2+ late returns
 */

const express = require('express');
const router = express.Router();
const { getAll } = require('../db');

/**
 * GET /api/reports/repeat-offenders
 * Borrowers with 2+ late returns, sorted by total late count.
 * Include: name, student_id, total_bookings, late_count, total_fees
 *
 * Response: [
 *   {
 *     borrower_id: 1,
 *     name: "Raj Kumar",
 *     student_id: "STU-2024-001",
 *     email: "raj.kumar@college.edu",
 *     total_bookings: 5,
 *     times_late: 3,
 *     total_late_fees: 450,
 *     recent_late_bookings: [
 *       {
 *         id: 1,
 *         equipment_type: "DSLR Camera",
 *         days_late: 2,
 *         late_fee: 100
 *       },
 *       ...
 *     ]
 *   },
 *   ...
 * ]
 */
router.get('/repeat-offenders', (req, res) => {
  try {
    // Get all borrowers with their booking stats
    const borrowerStats = getAll(
      `SELECT 
        br.id as borrower_id,
        br.name,
        br.student_id,
        br.email,
        COUNT(b.id) as total_bookings,
        SUM(CASE WHEN b.late_fee_owed > 0 THEN 1 ELSE 0 END) as times_late,
        SUM(COALESCE(b.late_fee_owed, 0)) as total_late_fees
      FROM borrowers br
      LEFT JOIN bookings b ON br.id = b.borrower_id
      GROUP BY br.id, br.name, br.student_id, br.email
      HAVING times_late >= 2
      ORDER BY times_late DESC, total_late_fees DESC`,
      []
    );

    const result = borrowerStats.map((borrower) => {
      // Get recent late bookings for this borrower
      const lateBookings = getAll(
        `SELECT 
          b.id, b.checkout_date, b.expected_return_date, b.actual_return_date,
          b.late_fee_owed,
          et.name as equipment_type
        FROM bookings b
        JOIN equipment_units eu ON b.equipment_unit_id = eu.id
        JOIN equipment_types et ON eu.equipment_type_id = et.id
        WHERE b.borrower_id = ? AND b.late_fee_owed > 0
        ORDER BY b.actual_return_date DESC
        LIMIT 5`,
        [borrower.borrower_id]
      );

      const recentLateFees = lateBookings.map((b) => {
        const expectedDate = new Date(b.expected_return_date);
        const actualDate = new Date(b.actual_return_date);
        const daysLate = Math.floor((actualDate - expectedDate) / (1000 * 60 * 60 * 24));

        return {
          id: b.id,
          equipment_type: b.equipment_type,
          days_late: daysLate,
          late_fee: b.late_fee_owed,
        };
      });

      return {
        borrower_id: borrower.borrower_id,
        name: borrower.name,
        student_id: borrower.student_id,
        email: borrower.email,
        total_bookings: borrower.total_bookings || 0,
        times_late: borrower.times_late || 0,
        total_late_fees: borrower.total_late_fees || 0,
        recent_late_bookings: recentLateFees,
      };
    });

    res.json(result);
  } catch (error) {
    console.error('[GET /api/reports/repeat-offenders]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
