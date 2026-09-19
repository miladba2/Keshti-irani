/**
 * dashboard.js
 * داشبورد اصلی: کارت‌های آماری، آخرین تراکنش‌ها، نمودارها
 */

const Dashboard = (() => {
  let incomeChart;

  function render() {
    const units = DB.getUnits();
    const receipts = DB.getReceipts();
    const expenses = DB.getExpenses();

    const totalIncome = receipts.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const totalExpense = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    const fundBalance = totalIncome - totalExpense;

    const balances = Ledger.getAllBalances();
    const debtorCount = Object.values(balances).filter(b => b > 0).length;
    const creditorCount = Object.values(balances).filter(b => b < 0).length;

    const container = document.getElementById('page-dashboard');
    container.innerHTML = `
      <div class="page-header"><h4><svg class="page-icon" viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7" height="7" rx="1.4"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.4"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.4"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.4"/></svg> داشبورد</h4></div>
      <div class="stat-cards">
        <div class="stat-card"><svg class="stat-icon" viewBox="0 0 24 24"><rect x="4.5" y="3.5" width="15" height="17" rx="1.2"/><line x1="8" y1="7.5" x2="8" y2="7.5"/><line x1="12" y1="7.5" x2="12" y2="7.5"/><line x1="16" y1="7.5" x2="16" y2="7.5"/><line x1="8" y1="11.5" x2="8" y2="11.5"/><line x1="12" y1="11.5" x2="12" y2="11.5"/><line x1="16" y1="11.5" x2="16" y2="11.5"/></svg><div class="stat-label">تعداد واحدها</div><div class="stat-value">${Utils.formatNumber(units.length)}</div></div>
        <div class="stat-card"><svg class="stat-icon icon-success" viewBox="0 0 24 24"><path d="M12 4v11"/><path d="M7.5 10.5 12 15l4.5-4.5"/><path d="M4.5 19.5h15"/></svg><div class="stat-label">کل دریافت</div><div class="stat-value">${Utils.formatCurrency(totalIncome)}</div></div>
        <div class="stat-card"><svg class="stat-icon icon-danger" viewBox="0 0 24 24"><path d="M12 20V9"/><path d="M7.5 13.5 12 9l4.5 4.5"/><path d="M4.5 4.5h15"/></svg><div class="stat-label">کل هزینه</div><div class="stat-value">${Utils.formatCurrency(totalExpense)}</div></div>
        <div class="stat-card"><svg class="stat-icon icon-info" viewBox="0 0 24 24"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h11A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z"/><path d="M14.5 12.7h3"/></svg><div class="stat-label">مانده صندوق</div><div class="stat-value ${fundBalance < 0 ? 'text-danger' : ''}">${Utils.formatCurrency(fundBalance)}</div></div>
        <div class="stat-card"><svg class="stat-icon icon-warning" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.3"/><line x1="12" y1="8" x2="12" y2="12.5"/><line x1="12" y1="15.5" x2="12" y2="15.5"/></svg><div class="stat-label">تعداد بدهکاران</div><div class="stat-value">${Utils.formatNumber(debtorCount)}</div></div>
        <div class="stat-card"><svg class="stat-icon icon-success" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.3"/><path d="M8.3 12.3l2.5 2.5 5-5.2"/></svg><div class="stat-label">تعداد بستانکاران</div><div class="stat-value">${Utils.formatNumber(creditorCount)}</div></div>
      </div>

      <div class="row g-3 mt-1">
        <div class="col-12">
          <div class="card">
            <div class="card-header">درآمد و هزینه ماهانه</div>
            <div class="card-body"><canvas id="incomeExpenseChart" height="120"></canvas></div>
          </div>
        </div>
      </div>

      <div class="row g-3 mt-1">
        <div class="col-lg-6">
          <div class="card">
            <div class="card-header">آخرین دریافت‌ها</div>
            <div class="table-responsive"><table class="table mb-0"><tbody id="recentReceipts"></tbody></table></div>
          </div>
        </div>
        <div class="col-lg-6">
          <div class="card">
            <div class="card-header">آخرین هزینه‌ها</div>
            <div class="table-responsive"><table class="table mb-0"><tbody id="recentExpenses"></tbody></table></div>
          </div>
        </div>
      </div>
    `;

    renderRecent(receipts, expenses);
    renderCharts(receipts, expenses, units, balances);
  }

  function renderRecent(receipts, expenses) {
    const recentR = [...receipts].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
    const recentE = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

    document.getElementById('recentReceipts').innerHTML = recentR.map(r => `
      <tr><td>${Utils.isoToJalaliDisplay(r.date)}</td><td>${Utils.escapeHtml(r.description || r.type || '-')}</td>
      <td class="text-success">${Utils.formatCurrency(r.amount)}</td></tr>`).join('') ||
      '<tr><td class="text-center text-muted py-3">داده‌ای موجود نیست</td></tr>';

    document.getElementById('recentExpenses').innerHTML = recentE.map(e => `
      <tr><td>${Utils.isoToJalaliDisplay(e.date)}</td><td>${Utils.escapeHtml(e.description || e.category || '-')}</td>
      <td class="text-danger">${Utils.formatCurrency(e.amount)}</td></tr>`).join('') ||
      '<tr><td class="text-center text-muted py-3">داده‌ای موجود نیست</td></tr>';
  }

  function monthlySeries(list) {
    // گروه‌بندی بر اساس ماه جلالی
    const map = {};
    list.forEach(item => {
      const jd = Utils.isoToJalaliDisplay(item.date);
      if (jd === '-') return;
      const key = jd.split('/').slice(0, 2).join('/');
      map[key] = (map[key] || 0) + (parseFloat(item.amount) || 0);
    });
    const keys = Object.keys(map).sort();
    return { labels: keys, data: keys.map(k => map[k]) };
  }

  function renderCharts(receipts, expenses, units, balances) {
    const incomeSeries = monthlySeries(receipts);
    const expenseSeries = monthlySeries(expenses);
    const allMonths = Array.from(new Set([...incomeSeries.labels, ...expenseSeries.labels])).sort();

    const ctx1 = document.getElementById('incomeExpenseChart');
    if (incomeChart) incomeChart.destroy();
    incomeChart = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: allMonths,
        datasets: [
          { label: 'درآمد', data: allMonths.map(m => { const i = incomeSeries.labels.indexOf(m); return i > -1 ? incomeSeries.data[i] : 0; }), backgroundColor: '#22c55e' },
          { label: 'هزینه', data: allMonths.map(m => { const i = expenseSeries.labels.indexOf(m); return i > -1 ? expenseSeries.data[i] : 0; }), backgroundColor: '#ef4444' }
        ]
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
  }

  function refreshStatsIfActive() {
    if (document.getElementById('page-dashboard')?.classList.contains('active')) {
      render();
    }
  }

  return { render, refreshStatsIfActive };
})();
