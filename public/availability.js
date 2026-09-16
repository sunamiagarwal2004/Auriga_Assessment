/**
 * Check Availability Page
 */

async function loadAvailabilityEquipment() {
  try {
    const equipment = await apiFetch('/equipment');
    const select = document.getElementById('equip-type');
    select.innerHTML =
      '<option value="">-- Select equipment --</option>' +
      equipment.map((item) => `<option value="${item.id}">${item.name}</option>`).join('');
  } catch (error) {
    console.error('Error loading equipment:', error);
  }
}

// Set date defaults
function setDateDefaults() {
  const today = formatDate(new Date());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDate(tomorrow);

  document.getElementById('from-date').value = today;
  document.getElementById('to-date').value = tomorrowStr;
}

// Form submit
document.getElementById('availability-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const typeId = parseInt(document.getElementById('equip-type').value, 10);
  const fromDate = document.getElementById('from-date').value;
  const toDate = document.getElementById('to-date').value;

  if (!typeId || !fromDate || !toDate) {
    alert('Please fill in all fields');
    return;
  }

  try {
    const result = await apiFetch(`/equipment/${typeId}/availability?from=${fromDate}&to=${toDate}`);

    // Show results
    document.getElementById('results-title').textContent = `${result.type_name} (${fromDate} to ${toDate})`;
    document.getElementById('available-count').textContent = result.available_in_range;
    document.getElementById('total-count').textContent = result.total_units;

    const tbody = document.getElementById('availability-tbody');
    tbody.innerHTML = result.units
      .map((unit) => {
        const status = unit.available ? '✓ Available' : `✗ Booked by ${unit.booked_by} until ${unit.until}`;
        const statusClass = unit.available ? 'success' : 'danger';

        return `
          <tr>
            <td>${unit.unit_label}</td>
            <td><span style="color: ${unit.available ? 'green' : 'red'};">${status}</span></td>
            <td>${unit.available ? '–' : `Return date: ${unit.until}`}</td>
          </tr>
        `;
      })
      .join('');

    show('availability-results');
  } catch (error) {
    alert(`Error: ${error.message}`);
  }
});

// Load on page load
document.addEventListener('DOMContentLoaded', () => {
  setDateDefaults();
  loadAvailabilityEquipment();
});
