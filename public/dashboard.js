/**
 * Dashboard - Main page script
 */

async function loadDashboard() {
  const cardsContainer = document.getElementById('equipment-cards');

  try {
    // Fetch all equipment types
    const equipment = await apiFetch('/equipment');

    // Check for overdue items and show alert
    try {
      const overdueRes = await apiFetch('/alerts/overdue');
      if (overdueRes.length > 0) {
        const banner = document.getElementById('alert-banner');
        banner.innerHTML = `⚠️ <strong>${overdueRes.length} item(s) overdue!</strong> Check active bookings for details.`;
        banner.classList.remove('hidden');
      }
    } catch (err) {
      console.log('No overdue items');
    }

    // Render equipment cards
    if (equipment.length === 0) {
      cardsContainer.innerHTML = '<p>No equipment found</p>';
      return;
    }

    cardsContainer.innerHTML = equipment
      .map((item) => {
        const availabilityClass = item.available_units > 0 ? 'available' : 'unavailable';
        const status = item.available_units > 0 ? '✓ Available' : '✗ Not Available';

        return `
          <div class="equipment-card">
            <h3>${item.name}</h3>
            <div class="availability ${availabilityClass}">${item.available_units}/${item.total_units}</div>
            <p>${status}</p>
            <div class="details">
              <p>Deposit: ${formatCurrency(item.deposit_amount)}</p>
              <p>Late Fee: ${formatCurrency(item.late_fee_per_day)}/day</p>
              <p>Max Duration: ${item.max_borrow_days} days</p>
            </div>
            <button class="btn btn-primary" onclick="window.location.href='book.html'" ${item.available_units === 0 ? 'disabled' : ''}>Book Now</button>
          </div>
        `;
      })
      .join('');
  } catch (error) {
    cardsContainer.innerHTML = `<p style="color: red;">Error loading equipment: ${error.message}</p>`;
  }
}

// Load dashboard on page load
document.addEventListener('DOMContentLoaded', loadDashboard);
