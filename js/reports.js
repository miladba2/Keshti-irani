/**
 * reports.js
 * گزارشات مختلف سیستم + خروجی Excel/CSV/PDF/Print
 */

const Reports = (() => {
  let reportChart;

  const REPORT_TYPES = [
    { key: 'general', label: 'گزارش کلی' },
    { key: 'units', label: 'گزارش واحدها' },
    { key: 'receipts', label: 'گزارش دریافت‌ها' },
    { key: 'expenses', label: 'گزارش هزینه‌ها' },
    { key: 'balances', label: 'گزارش مانده هر واحد' },
    { key: 'fund', label: 'گزارش صندوق' },
    { key: 'debtors', label: 'گزارش بدهکاران' },
    { key: 'creditors', label: 'گزارش بستانکاران' },
    { key: 'byExpenseCategory', label: 'گزارش بر اساس نوع هزینه' },
    { key: 'byReceiptType', label: 'گزارش بر اساس نوع دریافت' },
    { key: 'byPerson', label: 'گزارش بر اساس شخص (مجموع پرداختی‌ها)' }
  ];

  function render() {
    const units = DB.getUnits();
    const container = document.getElementById('page-reports');
    container.innerHTML = `
      <div class="page-header"><h4><svg class="page-icon" viewBox="0 0 24 24"><line x1="5.5" y1="20.5" x2="5.5" y2="12.5"/><line x1="12" y1="20.5" x2="12" y2="7"/><line x1="18.5" y1="20.5" x2="18.5" y2="15.5"/><line x1="3.5" y1="20.5" x2="20.5" y2="20.5"/></svg> گزارشات</h4></div>
      <div class="card mb-3">
        <div class="card-body d-flex flex-wrap gap-2 align-items-end">
          <div>
            <label class="form-label">نوع گزارش</label>
            <select class="form-select" id="reportType">
              ${REPORT_TYPES.map(r => `<option value="${r.key}">${r.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">از تاریخ</label>
            ${Utils.renderJalaliDateInput('fromDate', null)}
          </div>
          <div>
            <label class="form-label">تا تاریخ</label>
            ${Utils.renderJalaliDateInput('toDate', null)}
          </div>
          <div>
            <label class="form-label">واحد</label>
            <select class="form-select" id="reportUnitFilter">
              <option value="">همه واحدها</option>
              ${units.map(u => `<option value="${u.id}">${Utils.escapeHtml(Utils.unitLabel(u))}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">شخص (برای هزینه‌ها)</label>
            <select class="form-select" id="reportPersonFilter">
              <option value="">همه اشخاص</option>
              ${DB.getPersons().map(p => `<option value="${p.id}">${Utils.escapeHtml(p.name)}</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-primary" id="btnRunReport"><i class="bi bi-play-fill"></i> تولید گزارش</button>
        </div>
      </div>
      <div id="reportOutput"></div>
    `;
    document.getElementById('btnRunReport').addEventListener('click', runReport);
    document.getElementById('reportPersonFilter').addEventListener('change', (e) => {
      const sel = document.getElementById('reportType');
      if (e.target.value && sel.value !== 'expenses' && sel.value !== 'byPerson') {
        sel.value = 'expenses';
      }
      runReport();
    });
    document.getElementById('reportUnitFilter').addEventListener('change', (e) => {
      const sel = document.getElementById('reportType');
      if (e.target.value && !['receipts', 'balances'].includes(sel.value)) {
        sel.value = 'receipts';
      }
      runReport();
    });
    document.getElementById('reportType').addEventListener('change', runReport);
    runReport();
  }

  function getDateRange() {
    const container = document.getElementById('page-reports');
    let from = null, to = null;
    try { from = Utils.readJalaliDateInput(container, 'fromDate'); } catch (e) {}
    try { to = Utils.readJalaliDateInput(container, 'toDate'); } catch (e) {}
    return { from, to };
  }

  function inRange(dateStr, from, to) {
    const d = new Date(dateStr);
    if (from && d < new Date(from)) return false;
    if (to && d > new Date(to)) return false;
    return true;
  }

  function runReport() {
    const type = document.getElementById('reportType').value;
    const unitId = document.getElementById('reportUnitFilter').value;
    const personId = document.getElementById('reportPersonFilter').value;
    const { from, to } = getDateRange();
    const output = document.getElementById('reportOutput');

    const units = DB.getUnits();
    let receipts = DB.getReceipts().filter(r => inRange(r.date, from, to));
    let expenses = DB.getExpenses().filter(e => inRange(e.date, from, to));
    if (unitId) receipts = receipts.filter(r => r.unitId === unitId);
    if (personId) expenses = expenses.filter(e => e.personId === personId);

    let html = '';
    switch (type) {
      case 'units': html = reportUnits(units); break;
      case 'receipts': html = reportList('دریافت‌ها', receipts, ['docNo', 'date', 'description', 'amount'], ['شماره سند', 'تاریخ', 'شرح', 'مبلغ']); break;
      case 'expenses': html = reportExpensesList(expenses); break;
      case 'balances': html = reportBalances(units); break;
      case 'fund': html = reportFund(receipts, expenses); break;
      case 'debtors': html = reportDebtCredit(units, true); break;
      case 'creditors': html = reportDebtCredit(units, false); break;
      case 'byExpenseCategory': html = reportGrouped(expenses, 'category', 'دسته هزینه'); break;
      case 'byReceiptType': html = reportGrouped(receipts, 'type', 'نوع دریافت'); break;
      case 'byPerson': html = reportGroupedByPerson(expenses); break;
      default: html = reportGeneral(units, receipts, expenses);
    }

    output.innerHTML = `
      <div class="card" id="reportCard">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span>${REPORT_TYPES.find(r => r.key === type)?.label}</span>
          <div class="btn-group">
            <button class="btn btn-sm btn-outline-success" onclick="Reports.exportExcel()"><i class="bi bi-file-earmark-excel"></i> Excel</button>
            <button class="btn btn-sm btn-outline-secondary" onclick="Reports.exportCsv()"><i class="bi bi-filetype-csv"></i> CSV</button>
            <button class="btn btn-sm btn-outline-primary" onclick="Reports.printElement('reportBody')"><i class="bi bi-printer"></i> چاپ</button>
            <button class="btn btn-sm btn-outline-danger" onclick="Reports.exportPdf('reportBody','report')"><i class="bi bi-file-earmark-pdf"></i> PDF</button>
          </div>
        </div>
        <div class="card-body" id="reportBody">${html}</div>
      </div>`;
  }

  function summaryBar(count, total) {
    return `<div class="d-flex gap-4 mb-3">
      <div><strong>تعداد رکورد:</strong> ${Utils.formatNumber(count)}</div>
      ${total !== undefined ? `<div><strong>جمع کل:</strong> ${Utils.formatCurrency(total)}</div>` : ''}
    </div>`;
  }

  function reportGeneral(units, receipts, expenses) {
    const totalIncome = receipts.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const totalExpense = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    return `
      ${summaryBar(units.length)}
      <div class="row g-3">
        <div class="col-md-4"><div class="stat-card"><div class="stat-label">تعداد واحدها</div><div class="stat-value">${Utils.formatNumber(units.length)}</div></div></div>
        <div class="col-md-4"><div class="stat-card"><div class="stat-label">جمع دریافت‌ها</div><div class="stat-value">${Utils.formatCurrency(totalIncome)}</div></div></div>
        <div class="col-md-4"><div class="stat-card"><div class="stat-label">جمع هزینه‌ها</div><div class="stat-value">${Utils.formatCurrency(totalExpense)}</div></div></div>
      </div>`;
  }

  function reportUnits(units) {
    return `${summaryBar(units.length)}
      <table class="table table-bordered" id="reportTable">
        <thead><tr><th>کد</th><th>واحد</th><th>طبقه</th><th>بلوک</th><th>مالک</th><th>سهم شارژ</th><th>وضعیت</th></tr></thead>
        <tbody>${units.map(u => `<tr><td>${Utils.escapeHtml(u.code || '-')}</td><td>${Utils.escapeHtml(u.number)}</td><td>${Utils.escapeHtml(u.floor || '-')}</td><td>${Utils.escapeHtml(u.block || '-')}</td><td>${Utils.escapeHtml(u.owner || '-')}</td><td>${Utils.formatNumber(u.chargeShare)}</td><td>${u.status === 'inactive' ? 'غیرفعال' : 'فعال'}</td></tr>`).join('')}</tbody>
      </table>`;
  }

  function reportList(title, list, fields, headers) {
    const total = list.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    return `${summaryBar(list.length, total)}
      <table class="table table-bordered" id="reportTable">
        <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${list.map(item => `<tr>${fields.map(f => `<td>${f === 'date' ? Utils.isoToJalaliDisplay(item[f]) : f === 'amount' ? Utils.formatCurrency(item[f]) : Utils.escapeHtml(item[f] || '-')}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${headers.length}" class="text-center text-muted">داده‌ای موجود نیست</td></tr>`}</tbody>
      </table>`;
  }

  function reportExpensesList(list) {
    const total = list.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    return `${summaryBar(list.length, total)}
      <table class="table table-bordered" id="reportTable">
        <thead><tr><th>شماره سند</th><th>تاریخ</th><th>دسته</th><th>شرح</th><th>شخص/پرداخت به</th><th>مبلغ</th></tr></thead>
        <tbody>${list.map(e => `<tr><td>${Utils.escapeHtml(e.docNo)}</td><td>${Utils.isoToJalaliDisplay(e.date)}</td><td>${Utils.escapeHtml(e.category || '-')}</td><td>${Utils.escapeHtml(e.description || '-')}</td><td>${Utils.escapeHtml(personLabel(e))}</td><td>${Utils.formatCurrency(e.amount)}</td></tr>`).join('') || `<tr><td colspan="6" class="text-center text-muted">داده‌ای موجود نیست</td></tr>`}</tbody>
      </table>`;
  }

  function reportBalances(units) {
    const balances = Ledger.getAllBalances();
    return `${summaryBar(units.length)}
      <table class="table table-bordered" id="reportTable">
        <thead><tr><th>واحد</th><th>مالک</th><th>مانده</th><th>وضعیت</th></tr></thead>
        <tbody>${units.map(u => {
          const b = balances[u.id] || 0;
          return `<tr><td>${Utils.escapeHtml(u.number)}</td><td>${Utils.escapeHtml(u.owner || '-')}</td><td>${Utils.formatCurrency(Math.abs(b))}</td><td>${b > 0 ? 'بدهکار' : b < 0 ? 'بستانکار' : 'تسویه'}</td></tr>`;
        }).join('')}</tbody>
      </table>`;
  }

  function reportDebtCredit(units, debtors) {
    const balances = Ledger.getAllBalances();
    const filtered = units.filter(u => debtors ? (balances[u.id] || 0) > 0 : (balances[u.id] || 0) < 0);
    const total = filtered.reduce((s, u) => s + Math.abs(balances[u.id] || 0), 0);
    return `${summaryBar(filtered.length, total)}
      <table class="table table-bordered" id="reportTable">
        <thead><tr><th>واحد</th><th>مالک</th><th>شماره تماس</th><th>مبلغ</th></tr></thead>
        <tbody>${filtered.map(u => `<tr><td>${Utils.escapeHtml(u.number)}</td><td>${Utils.escapeHtml(u.owner || '-')}</td><td>${Utils.escapeHtml(u.phone || '-')}</td><td>${Utils.formatCurrency(Math.abs(balances[u.id]))}</td></tr>`).join('') || `<tr><td colspan="4" class="text-center text-muted">موردی یافت نشد</td></tr>`}</tbody>
      </table>`;
  }

  function reportFund(receipts, expenses) {
    const totalIncome = receipts.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const totalExpense = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    return `
      <div class="row g-3">
        <div class="col-md-4"><div class="stat-card"><div class="stat-label">جمع درآمد</div><div class="stat-value text-success">${Utils.formatCurrency(totalIncome)}</div></div></div>
        <div class="col-md-4"><div class="stat-card"><div class="stat-label">جمع هزینه</div><div class="stat-value text-danger">${Utils.formatCurrency(totalExpense)}</div></div></div>
        <div class="col-md-4"><div class="stat-card"><div class="stat-label">مانده صندوق</div><div class="stat-value">${Utils.formatCurrency(totalIncome - totalExpense)}</div></div></div>
      </div>`;
  }

  function reportGrouped(list, field, label) {
    const map = {};
    list.forEach(i => { const k = i[field] || 'نامشخص'; map[k] = (map[k] || 0) + (parseFloat(i.amount) || 0); });
    const keys = Object.keys(map);
    const total = Object.values(map).reduce((a, b) => a + b, 0);
    setTimeout(() => drawGroupChart(keys, keys.map(k => map[k])), 0);
    return `${summaryBar(list.length, total)}
      <div class="row">
        <div class="col-md-6">
          <table class="table table-bordered" id="reportTable">
            <thead><tr><th>${label}</th><th>مبلغ</th></tr></thead>
            <tbody>${keys.map(k => `<tr><td>${Utils.escapeHtml(k)}</td><td>${Utils.formatCurrency(map[k])}</td></tr>`).join('') || `<tr><td colspan="2" class="text-center text-muted">داده‌ای موجود نیست</td></tr>`}</tbody>
          </table>
        </div>
        <div class="col-md-6"><canvas id="groupedChart" height="220"></canvas></div>
      </div>`;
  }

  /** برچسب شخص برای یک سند هزینه: نام شخص تعریف‌شده، یا متن آزاد «پرداخت به»، یا نامشخص */
  function personLabel(expense) {
    if (expense.personId) {
      const p = DB.getPersonById(expense.personId);
      if (p) return p.name;
    }
    return expense.payTo || 'نامشخص';
  }

  function reportGroupedByPerson(list) {
    const map = {};
    list.forEach(e => { const k = personLabel(e); map[k] = (map[k] || 0) + (parseFloat(e.amount) || 0); });
    const keys = Object.keys(map);
    const total = Object.values(map).reduce((a, b) => a + b, 0);
    setTimeout(() => drawGroupChart(keys, keys.map(k => map[k])), 0);
    return `${summaryBar(list.length, total)}
      <div class="row">
        <div class="col-md-6">
          <table class="table table-bordered" id="reportTable">
            <thead><tr><th>شخص</th><th>مجموع پرداختی</th></tr></thead>
            <tbody>${keys.map(k => `<tr><td>${Utils.escapeHtml(k)}</td><td>${Utils.formatCurrency(map[k])}</td></tr>`).join('') || `<tr><td colspan="2" class="text-center text-muted">داده‌ای موجود نیست</td></tr>`}</tbody>
          </table>
        </div>
        <div class="col-md-6"><canvas id="groupedChart" height="220"></canvas></div>
      </div>`;
  }

  function drawGroupChart(labels, data) {
    const canvas = document.getElementById('groupedChart');
    if (!canvas) return;
    if (reportChart) reportChart.destroy();
    reportChart = new Chart(canvas, {
      type: 'pie',
      data: { labels, datasets: [{ data, backgroundColor: ['#2563eb', '#22c55e', '#ef4444', '#f59e0b', '#a855f7', '#06b6d4', '#84cc16', '#f97316'] }] },
      options: { plugins: { legend: { position: 'bottom' } } }
    });
  }

  /* ------------------ خروجی‌ها ------------------ */
  function exportExcel() {
    const table = document.getElementById('reportTable');
    if (!table) { Utils.showToast('جدولی برای خروجی وجود ندارد', 'warning'); return; }
    const wb = XLSX.utils.table_to_book(table, { sheet: 'گزارش' });
    XLSX.writeFile(wb, `گزارش-${Date.now()}.xlsx`);
  }

  function exportCsv() {
    const table = document.getElementById('reportTable');
    if (!table) { Utils.showToast('جدولی برای خروجی وجود ندارد', 'warning'); return; }
    const wb = XLSX.utils.table_to_book(table, { sheet: 'گزارش' });
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets['گزارش']);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `گزارش-${Date.now()}.csv`;
    link.click();
  }

  function printElement(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const win = window.open('', '_blank');
    win.document.write(`<html dir="rtl" lang="fa"><head><meta charset="utf-8"><title>چاپ گزارش</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        body{font-family:'IRANSansX','Vazirmatn',Tahoma,sans-serif;padding:20px;color:#1f2430}
        table{width:100%;border-collapse:collapse}
        td,th{border:1px solid #ccc;padding:8px;text-align:right;font-size:13px}
        th{background:#f3f5f9;font-weight:600}
        @page { size: auto; margin: 0; }
        @media print { .no-print{display:none} }
      </style>
      </head><body>
      <div class="no-print" style="text-align:center;margin-bottom:18px">
        <button onclick="window.print()" style="padding:8px 20px;font-size:14px;cursor:pointer;font-family:inherit;border-radius:8px;border:1px solid #2563eb;background:#2563eb;color:#fff">چاپ</button>
        <button onclick="window.close()" style="padding:8px 20px;font-size:14px;cursor:pointer;font-family:inherit;border-radius:8px;border:1px solid #999;background:#fff;color:#333;margin-right:8px">بازگشت</button>
      </div>
      ${el.innerHTML}
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }

  function exportPdf(id, filename) {
    const el = document.getElementById(id);
    if (!el) return;
    const opt = {
      margin: 10,
      filename: `${filename || 'report'}.pdf`,
      html2canvas: { scale: 2, useCORS: true, foreignObjectRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    // صبر برای بارگذاری کامل فونت فارسی قبل از رندر PDF؛ در غیر این صورت
    // ممکن است اعداد و حروف فارسی در خروجی به‌هم‌ریخته یا نامرتب نمایش داده شوند
    const ready = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    ready.then(() => html2pdf().set(opt).from(el).save());
  }

  return { render, exportExcel, exportCsv, printElement, exportPdf };
})();
