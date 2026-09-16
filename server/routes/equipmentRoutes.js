/**
 * Equipment Routes
 * GET /api/equipment — list all equipment types with availability summary
 * GET /api/equipment/:typeId/units — list individual units of a type
 * GET /api/equipment/:typeId/availability — check availability in date range
 */

const express = require('express');
const router = express.Router();
const { getAll, getOne } = require('../db');

/**
 * GET /api/equipment
 * List all equipment types with availability summary.
 *
 * Response: [
 *   {
 *     id: 1,
 *     name: "DSLR Camera",
 *     deposit_amount: 500,
 *     late_fee_per_day: 50,
 *     max_borrow_days: 3,
 *     max_units_per_person: 1,
 *     total_units: 3,
 *     available_units: 2
 *   },
 *   ...
 * ]
 */
router.get('/', (req, res) => {
  try {
    const types = getAll('SELECT * FROM equipment_types ORDER BY name');

    const result = types.map((type) => {
      // Count total units
      const totalResult = getOne(
        'SELECT COUNT(*) as count FROM equipment_units WHERE equipment_type_id = ?',
        [type.id]
      );
      const total_units = totalResult.count;

      // Count available units (is_available = 1)
      const availableResult = getOne(
        'SELECT COUNT(*) as count FROM equipment_units WHERE equipment_type_id = ? AND is_available = 1',
        [type.id]
      );
      const available_units = availableResult.count;

      return {
        id: type.id,
        name: type.name,
        deposit_amount: type.deposit_amount,
        late_fee_per_day: type.late_fee_per_day,
        max_borrow_days: type.max_borrow_days,
        max_units_per_person: type.max_units_per_person,
        total_units,
        available_units,
      };
    });

    res.json(result);
  } catch (error) {
    console.error('[GET /api/equipment]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/equipment/:typeId/units
 * List individual units of a specific equipment type with their condition and availability.
 *
 * Response: {
 *   equipment_type_id: 1,
 *   type_name: "DSLR Camera",
 *   units: [
 *     {
 *       id: 1,
 *       unit_label: "DSLR-001",
 *       serial_number: "CANON-5D-2024-001",
 *       model: "Canon EOS 5D Mark IV",
 *       condition: "good",
 *       is_available: 1,
 *       purchase_date: "2023-01-15"
 *     },
 *     ...
 *   ]
 * }
 */
router.get('/:typeId/units', (req, res) => {
  try {
    const typeId = parseInt(req.params.typeId, 10);

    if (isNaN(typeId) || typeId <= 0) {
      return res.status(400).json({ error: 'Invalid equipment type ID' });
    }

    // Verify equipment type exists
    const equipmentType = getOne('SELECT * FROM equipment_types WHERE id = ?', [typeId]);

    if (!equipmentType) {
      return res.status(404).json({ error: 'Equipment type not found' });
    }

    // Get all units of this type
    const units = getAll(
      `SELECT id, unit_label, serial_number, model, condition, is_available, purchase_date
       FROM equipment_units
       WHERE equipment_type_id = ?
       ORDER BY unit_label`,
      [typeId]
    );

    res.json({
      equipment_type_id: typeId,
      type_name: equipmentType.name,
      units,
    });
  } catch (error) {
    console.error('[GET /api/equipment/:typeId/units]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/equipment/:typeId/availability?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Check how many units of this type are free in the given date range.
 * A unit is "free" if it has no active/overdue bookings that overlap the date range.
 *
 * Query params:
 *   from (required): start date YYYY-MM-DD
 *   to (required): end date YYYY-MM-DD
 *
 * Response: {
 *   equipment_type_id: 1,
 *   type_name: "DSLR Camera",
 *   total_units: 3,
 *   available_in_range: 2,
 *   from: "2024-09-20",
 *   to: "2024-09-23",
 *   units: [
 *     { id: 1, unit_label: "DSLR-001", available: true },
 *     { id: 2, unit_label: "DSLR-002", available: false, booked_by: "Raj Kumar", until: "2024-09-22" },
 *     ...
 *   ]
 * }
 */
router.get('/:typeId/availability', (req, res) => {
  try {
    const typeId = parseInt(req.params.typeId, 10);
    const { from, to } = req.query;

    // Validate typeId
    if (isNaN(typeId) || typeId <= 0) {
      return res.status(400).json({ error: 'Invalid equipment type ID' });
    }

    // Validate date range
    if (!from || !to) {
      return res.status(400).json({ error: 'Query params "from" and "to" (YYYY-MM-DD) are required' });
    }

    const fromRegex = /^\d{4}-\d{2}-\d{2}$/;
    const toRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!fromRegex.test(from) || !toRegex.test(to)) {
      return res.status(400).json({ error: 'Dates must be in YYYY-MM-DD format' });
    }

    // Verify equipment type exists
    const equipmentType = getOne('SELECT * FROM equipment_types WHERE id = ?', [typeId]);

    if (!equipmentType) {
      return res.status(404).json({ error: 'Equipment type not found' });
    }

    // Get all units of this type
    const allUnits = getAll(
      `SELECT id, unit_label FROM equipment_units WHERE equipment_type_id = ? ORDER BY unit_label`,
      [typeId]
    );

    const total_units = allUnits.length;

    // For each unit, check if it's booked during the range
    // A unit is booked if there's an active/overdue booking where:
    //   checkout_date <= to AND expected_return_date >= from
    const units = allUnits.map((unit) => {
      const conflict = getOne(
        `SELECT b.id, b.expected_return_date, br.name
         FROM bookings b
         JOIN borrowers br ON b.borrower_id = br.id
         WHERE b.equipment_unit_id = ?
           AND b.status IN ('active', 'overdue')
           AND b.checkout_date <= ?
           AND b.expected_return_date >= ?
         LIMIT 1`,
        [unit.id, to, from]
      );

      if (conflict) {
        return {
          id: unit.id,
          unit_label: unit.unit_label,
          available: false,
          booked_by: conflict.name,
          until: conflict.expected_return_date,
        };
      }

      return {
        id: unit.id,
        unit_label: unit.unit_label,
        available: true,
      };
    });

    // Count available units in range
    const available_in_range = units.filter((u) => u.available).length;

    res.json({
      equipment_type_id: typeId,
      type_name: equipmentType.name,
      total_units,
      available_in_range,
      from,
      to,
      units,
    });
  } catch (error) {
    console.error('[GET /api/equipment/:typeId/availability]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
