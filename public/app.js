/**
 * Shared utilities and fetch wrapper
 */

const API_BASE = '/api';

/**
 * Fetch wrapper with error handling
 */
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
}

/**
 * Show message (success, error, info)
 */
function showMessage(elementId, message, type = 'info') {
  const el = document.getElementById(elementId);
  if (!el) return;

  el.textContent = message;
  el.className = `message ${type}`;
  el.classList.remove('hidden');

  // Auto-hide after 5s (for success/error)
  if (type !== 'info') {
    setTimeout(() => {
      el.classList.add('hidden');
    }, 5000);
  }
}

/**
 * Format date to YYYY-MM-DD
 */
function formatDate(date) {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * Parse date string and return Date object
 */
function parseDate(dateStr) {
  return new Date(dateStr);
}

/**
 * Format currency (₹)
 */
function formatCurrency(amount) {
  return `₹${amount.toLocaleString('en-IN')}`;
}

/**
 * Hide element
 */
function hide(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.classList.add('hidden');
}

/**
 * Show element
 */
function show(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.classList.remove('hidden');
}

/**
 * Toggle visibility
 */
function toggle(elementId, show = null) {
  const el = document.getElementById(elementId);
  if (!el) return;

  if (show === null) {
    el.classList.toggle('hidden');
  } else if (show) {
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}
