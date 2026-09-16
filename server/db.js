const Database = require('better-sqlite3');
const path = require('path');

// SQLite database file in server directory
const dbPath = path.join(__dirname, 'av_room.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

/**
 * Initialize database schema.
 * Safe to call multiple times — tables created only if they don't exist.
 */
function initializeSchema() {
  // TABLE: equipment_types
  db.exec(`
    CREATE TABLE IF NOT EXISTS equipment_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      late_fee_per_day INTEGER NOT NULL,
      deposit_amount INTEGER NOT NULL,
      max_borrow_days INTEGER NOT NULL,
      max_units_per_person INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // TABLE: equipment_units
  db.exec(`
    CREATE TABLE IF NOT EXISTS equipment_units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_type_id INTEGER NOT NULL REFERENCES equipment_types(id),
      unit_label TEXT NOT NULL UNIQUE,
      serial_number TEXT,
      model TEXT,
      condition TEXT DEFAULT 'good' CHECK(condition IN ('good', 'fair', 'damaged', 'lost')),
      purchase_date TEXT,
      is_available INTEGER DEFAULT 1,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // TABLE: borrowers
  db.exec(`
    CREATE TABLE IF NOT EXISTS borrowers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      student_id TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      phone TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // TABLE: bookings
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      borrower_id INTEGER NOT NULL REFERENCES borrowers(id),
      equipment_unit_id INTEGER NOT NULL REFERENCES equipment_units(id),
      checkout_date TEXT NOT NULL,
      expected_return_date TEXT NOT NULL,
      actual_return_date TEXT,
      condition_at_checkout TEXT NOT NULL,
      condition_at_return TEXT,
      deposit_paid INTEGER NOT NULL,
      late_fee_owed INTEGER DEFAULT 0,
      damage_cost INTEGER DEFAULT 0,
      deposit_refunded INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'returned', 'overdue')),
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // TABLE: audit_log
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      details TEXT,
      performed_by TEXT DEFAULT 'system',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  console.log('✓ Database schema initialized');
}

/**
 * Get a prepared statement (cached by better-sqlite3)
 */
function prepare(sql) {
  return db.prepare(sql);
}

/**
 * Execute a query and return one row or null
 */
function getOne(sql, params = []) {
  return db.prepare(sql).get(...params);
}

/**
 * Execute a query and return all rows
 */
function getAll(sql, params = []) {
  return db.prepare(sql).all(...params);
}

/**
 * Execute an insert/update/delete and return affected row count
 */
function run(sql, params = []) {
  const stmt = db.prepare(sql);
  const info = stmt.run(...params);
  return info;
}

/**
 * Start a transaction
 */
function beginTransaction() {
  db.exec('BEGIN TRANSACTION');
}

/**
 * Commit a transaction
 */
function commit() {
  db.exec('COMMIT');
}

/**
 * Rollback a transaction
 */
function rollback() {
  db.exec('ROLLBACK');
}

/**
 * Close database connection
 */
function close() {
  db.close();
}

module.exports = {
  db,
  initializeSchema,
  prepare,
  getOne,
  getAll,
  run,
  beginTransaction,
  commit,
  rollback,
  close,
};
