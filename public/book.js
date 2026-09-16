/**
 * Book Equipment Page
 */

let equipmentTypes = [];
let selectedTypeId = null;

async function loadEquipmentTypes() {
  try {
    const data = await apiFetch('/equipment');
    equipmentTypes = data;

    const select = document.getElementById('equipment-type');
    select.innerHTML =
      '<option value="">-- Select equipment --</option>' +
      data
        .map((item) => `<option value="${item.id}">${item.name} (${item.available_units}/${item.total_units} free)</option>`)
        .join('');
  } catch (error) {
    showMessage('message', `Error loading equipment: ${error.message}`, 'error');
  }
}

// Student ID lookup
document.getElementById('student-id').addEventListener('blur', async (e) => {
  const studentId = e.target.value.trim();
  if (!studentId) {
    hide('student-info');
    return;
  }

  try {
    const data = await apiFetch(`/bookings/borrowers/${studentId}/history`);
    document.getElementById('borrower-name').textContent = data.borrower.name;
    document.getElementById('borrower-email').textContent = `Email: ${data.borrower.email}`;
    show('student-info');
  } catch (error) {
    showMessage('message', `Student not found: ${error.message}`, 'error');
    hide('student-info');
  }
});

// Equipment type change
document.getElementById('equipment-type').addEventListener('change', (e) => {
  selectedTypeId = parseInt(e.target.value, 10);

  if (!selectedTypeId) {
    hide('type-info');
    hide('booking-summary');
    return;
  }

  const type = equipmentTypes.find((t) => t.id === selectedTypeId);
  if (type) {
    document.getElementById('deposit-amount').textContent = formatCurrency(type.deposit_amount);
    document.getElementById('late-fee').textContent = formatCurrency(type.late_fee_per_day);
    document.getElementById('max-days').textContent = type.max_borrow_days;
    show('type-info');
  }

  updateBookingSummary();
});

// Checkout date change
document.getElementById('checkout-date').addEventListener('change', updateBookingSummary);

function updateBookingSummary() {
  const checkoutDate = document.getElementById('checkout-date').value;
  const typeId = parseInt(document.getElementById('equipment-type').value, 10);

  if (!checkoutDate || !typeId) {
    hide('booking-summary');
    return;
  }

  const type = equipmentTypes.find((t) => t.id === typeId);
  if (!type) return;

  const checkout = new Date(checkoutDate);
  const returnDate = new Date(checkout);
  returnDate.setDate(returnDate.getDate() + type.max_borrow_days);

  document.getElementById('expected-return').textContent = formatDate(returnDate);
  document.getElementById('summary-deposit').textContent = formatCurrency(type.deposit_amount);
  show('booking-summary');
}

// Form submit
document.getElementById('booking-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const studentId = document.getElementById('student-id').value.trim();
  const equipmentTypeId = parseInt(document.getElementById('equipment-type').value, 10);
  const checkoutDate = document.getElementById('checkout-date').value || formatDate(new Date());

  if (!studentId || !equipmentTypeId) {
    showMessage('message', 'Please fill in all required fields', 'error');
    return;
  }

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = 'Booking...';

  try {
    const booking = await apiFetch('/bookings', {
      method: 'POST',
      body: JSON.stringify({
        student_id: studentId,
        equipment_type_id: equipmentTypeId,
        checkout_date: checkoutDate,
      }),
    });

    showMessage(
      'message',
      `✓ Equipment booked! Booking ID: ${booking.id}. Return by ${booking.expected_return_date}.`,
      'success'
    );
    document.getElementById('booking-form').reset();
    hide('student-info');
    hide('type-info');
    hide('booking-summary');
  } catch (error) {
    showMessage('message', `Booking failed: ${error.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Reserve Equipment';
  }
});

// Set default checkout date to today
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('checkout-date').value = formatDate(new Date());
  loadEquipmentTypes();
});
