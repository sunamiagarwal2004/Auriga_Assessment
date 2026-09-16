/**
 * Borrower History Page
 */

document.getElementById('history-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const studentId = document.getElementById('search-student-id').value.trim();

  if (!studentId) {
    alert('Please enter a student ID');
    return;
  }

  try {
    const data = await apiFetch(`/bookings/borrowers/${studentId}/history`);

    // Show results
    document.getElementById('result-name').textContent = data.borrower.name;
    document.getElementById('result-student-id').textContent = data.borrower.student_id;
    document.getElementById('result-email').textContent = data.borrower.email;

    document.getElementById('total-bookings').textContent = data.stats.total_bookings;
    document.getElementById('times-late').textContent = data.stats.times_late;
    document.getElementById('total-fees').textContent = formatCurrency(data.stats.total_late_fees_paid);

    // Active bookings
    const activeHtml =
      data.active_bookings.length === 0
        ? '<p>No active bookings</p>'
        : data.active_bookings
            .map(
              (b) =>
                `<div class="booking-item"><div><p><strong>${b.equipment.unit_label}</strong> (${b.equipment.equipment_type})</p><p>Due: ${b.expected_return_date}</p></div></div>`
            )
            .join('');
    document.getElementById('active-list').innerHTML = activeHtml;

    // Returned bookings
    const returnedHtml =
      data.returned_bookings.length === 0
        ? '<p>No returned bookings</p>'
        : data.returned_bookings
            .map(
              (b) =>
                `<div class="booking-item"><div><p><strong>${b.equipment.unit_label}</strong> (${b.equipment.equipment_type})</p><p>Late Fee: ${formatCurrency(b.late_fee_owed)} | Refund: ${formatCurrency(b.deposit_refunded)}</p></div></div>`
            )
            .join('');
    document.getElementById('returned-list').innerHTML = returnedHtml;

    show('history-results');
  } catch (error) {
    alert(`Borrower not found: ${error.message}`);
    hide('history-results');
  }
});

document.addEventListener('DOMContentLoaded', () => {
  hide('history-results');
});
