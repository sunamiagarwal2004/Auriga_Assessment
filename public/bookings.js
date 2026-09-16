/**
 * Active Bookings Page
 */

let currentFilter = 'active';

async function loadBookings(status) {
  const tbody = document.getElementById('bookings-tbody');
  tbody.innerHTML = '<tr class="loading"><td colspan="7">Loading...</td></tr>';

  try {
    const query = status ? `?status=${status}` : '';
    const bookings = await apiFetch(`/bookings${query}`);

    if (bookings.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7">No bookings found</td></tr>`;
      return;
    }

    tbody.innerHTML = bookings
      .map((booking) => {
        const statusBadge = `<span class="status-badge status-${booking.status}">${booking.status.toUpperCase()}</span>`;
        const actionBtn =
          booking.status !== 'returned'
            ? `<button class="btn btn-danger" onclick="openReturnModal(${booking.id})">Return</button>`
            : '–';

        return `
          <tr>
            <td>${booking.id}</td>
            <td>${booking.borrower.name}</td>
            <td>${booking.equipment.unit_label}<br/><small>${booking.equipment.equipment_type}</small></td>
            <td>${booking.checkout_date}</td>
            <td>${booking.expected_return_date}</td>
            <td>${statusBadge}</td>
            <td>${actionBtn}</td>
          </tr>
        `;
      })
      .join('');
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="7" style="color: red;">Error loading bookings: ${error.message}</td></tr>`;
  }
}

// Filter tabs
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    e.target.classList.add('active');
    currentFilter = e.target.dataset.filter;
    loadBookings(currentFilter);
  });
});

// Return modal
function openReturnModal(bookingId) {
  document.getElementById('return-booking-id').value = bookingId;
  document.getElementById('return-form').reset();
  hide('fee-breakdown');
  show('return-modal');
}

document.getElementById('close-modal').addEventListener('click', () => {
  hide('return-modal');
});

document.getElementById('cancel-return').addEventListener('click', () => {
  hide('return-modal');
});

// Return form submit
document.getElementById('return-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const bookingId = parseInt(document.getElementById('return-booking-id').value, 10);
  const condition = document.getElementById('condition-return').value;
  const damageCost = parseInt(document.getElementById('damage-cost').value, 10) || 0;
  const notes = document.getElementById('return-notes').value;

  if (!condition) {
    alert('Please select condition');
    return;
  }

  try {
    const result = await apiFetch(`/bookings/${bookingId}/return`, {
      method: 'PATCH',
      body: JSON.stringify({
        condition_at_return: condition,
        damage_cost: damageCost,
        notes,
      }),
    });

    // Show fee breakdown
    const breakdown = result.fee_breakdown;
    const breakdown_html = `
      <p>Deposit Paid: ${formatCurrency(breakdown.deposit_paid)}</p>
      <p>Days Late: ${breakdown.days_late}</p>
      <p>Late Fees: ${formatCurrency(breakdown.late_fees_owed)}</p>
      <p>Damage Cost: ${formatCurrency(breakdown.damage_cost)}</p>
      <p class="total">Refund: ${formatCurrency(breakdown.deposit_refunded)}</p>
    `;
    document.getElementById('fee-breakdown').innerHTML = breakdown_html;
    show('fee-breakdown');

    setTimeout(() => {
      hide('return-modal');
      loadBookings(currentFilter);
    }, 2000);
  } catch (error) {
    alert(`Return failed: ${error.message}`);
  }
});

// Load on page load
document.addEventListener('DOMContentLoaded', () => {
  loadBookings(currentFilter);
});
