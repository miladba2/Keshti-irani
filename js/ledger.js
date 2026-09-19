/**
 * ledger.js
 * موتور دفتر معین: محاسبه خودکار بدهکار/بستانکار/مانده برای هر واحد
 *
 * منطق محاسباتی:
 *  - «هزینه‌ها» به‌صورت خودکار بین واحدها تقسیم نمی‌شوند و در دفتر معین ظاهر نمی‌شوند.
 *    گزارش هزینه‌ها کاملاً مستقل و جداگانه در بخش «گزارشات» موجود است.
 *  - دفتر معین هر واحد شامل سه نوع سند بدهکار/بستانکار است:
 *      ۱) بدهی اولیه واحد (بدهکار - یک‌بار، ابتدای دوره)
 *      ۲) اسناد شارژ ماهانه صادرشده برای آن واحد (بدهکار - طبق ماژول «شارژ ماهانه»)
 *      ۳) دریافت‌های ثبت‌شده برای همان واحد (بستانکار)
 *  - مانده = مجموع بدهکار - مجموع بستانکار (مانده مثبت یعنی واحد بدهکار است)
 */

const Ledger = (() => {

  /** ساخت کامل دفتر معین برای یک واحد مشخص، مرتب‌شده بر اساس تاریخ */
  function getUnitLedger(unitId) {
    const unit = DB.getUnitById(unitId);
    const receipts = DB.getReceipts();
    const charges = DB.getCharges();
    const entries = [];

    charges.filter(c => c.unitId === unitId).forEach(c => {
      entries.push({
        date: c.date,
        docNo: c.docNo,
        description: c.description || 'سند شارژ ماهانه',
        debit: parseFloat(c.amount) || 0,
        credit: 0
      });
    });

    receipts.filter(r => r.unitId === unitId).forEach(r => {
      entries.push({
        date: r.date,
        docNo: r.docNo,
        description: `دریافت: ${r.description || r.type}`,
        debit: 0,
        credit: parseFloat(r.amount) || 0
      });
    });

    entries.sort((a, b) => new Date(a.date) - new Date(b.date));

    // بدهی اولیه واحد همیشه به عنوان اولین سند دفتر معین درج می‌شود (مستقل از تاریخ)
    const openingDebt = parseFloat(unit?.initialDebt) || 0;
    if (openingDebt !== 0) {
      entries.unshift({
        date: null,
        docNo: '-',
        description: 'بدهی اولیه واحد (مانده ابتدای دوره)',
        debit: openingDebt,
        credit: 0,
        isOpening: true
      });
    }

    let balance = 0;
    entries.forEach(e => {
      balance += e.debit - e.credit;
      e.balance = balance;
    });

    return entries;
  }

  /** محاسبه مانده نهایی همه واحدها { unitId: balance } */
  function getAllBalances() {
    const units = DB.getUnits();
    const balances = {};
    units.forEach(u => {
      const ledger = getUnitLedger(u.id);
      balances[u.id] = ledger.length ? ledger[ledger.length - 1].balance : 0;
    });
    return balances;
  }

  function getUnitBalance(unitId) {
    const ledger = getUnitLedger(unitId);
    return ledger.length ? ledger[ledger.length - 1].balance : 0;
  }

  /* ------------------ رندر صفحه دفتر معین ------------------ */
  function render() {
    const container = document.getElementById('page-ledger');
    container.innerHTML = `
      <div class="page-header">
        <h4><svg class="page-icon" viewBox="0 0 24 24"><path d="M4.5 5.2c0-1 .9-1.7 1.9-1.7H12v17.2H6.4c-1 0-1.9-.8-1.9-1.7z"/><path d="M19.5 5.2c0-1-.9-1.7-1.9-1.7H12v17.2h5.6c1 0 1.9-.8 1.9-1.7z"/></svg> دفتر معین</h4>
      </div>

      <ul class="nav nav-tabs mb-3">
        <li class="nav-item"><button type="button" class="nav-link active" id="ledgerTabBtnUnit">دفتر معین واحد</button></li>
        <li class="nav-item"><button type="button" class="nav-link" id="ledgerTabBtnSummary">خلاصه کلی صندوق</button></li>
      </ul>

      <div id="ledgerTabUnit">
        <div class="card mb-3">
          <div class="card-body">
            <label class="form-label">جستجو و انتخاب واحد (بر اساس شماره واحد یا نام مستاجر/مالک)</label>
            <div class="ledger-combobox">
              <input type="text" class="form-control" id="ledgerUnitSearch" placeholder="مثال: واحد ۳ یا نام مستاجر..." autocomplete="off">
              <div class="ledger-combobox-results" id="ledgerUnitResults"></div>
            </div>
          </div>
        </div>
        <div id="ledgerResult"></div>
      </div>

      <div id="ledgerTabSummary" style="display:none"></div>
    `;

    const searchInput = document.getElementById('ledgerUnitSearch');
    const resultsBox = document.getElementById('ledgerUnitResults');

    function showResults(list) {
      if (!list.length) {
        resultsBox.innerHTML = `<div class="ledger-combobox-item text-muted">موردی یافت نشد</div>`;
      } else {
        resultsBox.innerHTML = list.map(u => `
          <div class="ledger-combobox-item" data-id="${u.id}">
            <strong>واحد ${Utils.escapeHtml(u.number)}</strong>
            <span class="text-muted small">مستاجر: ${Utils.escapeHtml(u.tenant || '-')} | مالک: ${Utils.escapeHtml(u.owner || '-')}</span>
          </div>`).join('');
      }
      resultsBox.classList.add('show');
    }

    searchInput.addEventListener('focus', () => showResults(DB.getUnits()));
    searchInput.addEventListener('input', Utils.debounce(() => {
      const q = searchInput.value.trim().toLowerCase();
      const list = DB.getUnits().filter(u =>
        !q ||
        (u.number || '').toLowerCase().includes(q) ||
        (u.owner || '').toLowerCase().includes(q) ||
        (u.tenant || '').toLowerCase().includes(q) ||
        (u.code || '').toLowerCase().includes(q)
      );
      showResults(list);
    }, 200));

    resultsBox.addEventListener('click', (e) => {
      const item = e.target.closest('.ledger-combobox-item[data-id]');
      if (!item) return;
      const unit = DB.getUnitById(item.dataset.id);
      searchInput.value = unit ? Utils.unitLabel(unit) : '';
      resultsBox.classList.remove('show');
      renderUnitLedger(item.dataset.id);
    });

    if (!Ledger._docClickBound) {
      Ledger._docClickBound = true;
      document.addEventListener('click', (e) => {
        const box = document.getElementById('ledgerUnitResults');
        if (box && !e.target.closest('.ledger-combobox')) box.classList.remove('show');
      });
    }

    // سوییچ بین تب «دفتر معین واحد» و «خلاصه کلی صندوق»
    document.getElementById('ledgerTabBtnUnit').addEventListener('click', () => switchTab('unit'));
    document.getElementById('ledgerTabBtnSummary').addEventListener('click', () => switchTab('summary'));
  }

  function switchTab(tab) {
    document.getElementById('ledgerTabBtnUnit').classList.toggle('active', tab === 'unit');
    document.getElementById('ledgerTabBtnSummary').classList.toggle('active', tab === 'summary');
    document.getElementById('ledgerTabUnit').style.display = tab === 'unit' ? '' : 'none';
    document.getElementById('ledgerTabSummary').style.display = tab === 'summary' ? '' : 'none';
    if (tab === 'summary') renderFundSummary();
  }

  function renderUnitLedger(unitId) {
    const result = document.getElementById('ledgerResult');
    if (!unitId) { result.innerHTML = ''; return; }
    const unit = DB.getUnitById(unitId);
    const entries = getUnitLedger(unitId);
    const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
    const finalBalance = entries.length ? entries[entries.length - 1].balance : 0;

    result.innerHTML = `
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
          <span>دفتر معین ${Utils.escapeHtml(Utils.unitLabel(unit))}</span>
          <div class="btn-group flex-wrap">
            <button class="btn btn-sm btn-outline-success" onclick="Ledger.exportExcel()"><i class="bi bi-file-earmark-excel"></i> Excel کامل</button>
            <button class="btn btn-sm btn-outline-secondary" onclick="Ledger.exportCsv()"><i class="bi bi-filetype-csv"></i> CSV کامل</button>
            <button class="btn btn-sm btn-outline-success" onclick="Ledger.exportReceiptsOnly('${unitId}')"><i class="bi bi-cash-coin"></i> خروجی دریافت‌های این واحد</button>
            <button class="btn btn-sm btn-outline-primary" onclick="Reports.printElement('ledgerPrintArea')"><i class="bi bi-printer"></i> چاپ</button>
            <button class="btn btn-sm btn-outline-dark" onclick="Reports.exportPdf('ledgerPrintArea','ledger')"><i class="bi bi-file-earmark-pdf"></i> PDF</button>
          </div>
        </div>
        <div id="ledgerPrintArea">
          <div class="stat-cards m-3">
            <div class="stat-card"><div class="stat-label">جمع بدهکار</div><div class="stat-value text-danger">${Utils.formatCurrency(totalDebit)}</div></div>
            <div class="stat-card"><div class="stat-label">جمع بستانکار</div><div class="stat-value text-success">${Utils.formatCurrency(totalCredit)}</div></div>
            <div class="stat-card"><div class="stat-label">مانده نهایی</div><div class="stat-value ${finalBalance > 0 ? 'text-danger' : 'text-success'}">${Utils.formatCurrency(Math.abs(finalBalance))} ${finalBalance > 0 ? '(بدهکار)' : '(بستانکار)'}</div></div>
          </div>
          <div class="table-responsive">
            <table class="table table-hover align-middle mb-0" id="ledgerTable">
              <thead><tr>
                <th>تاریخ</th><th>شماره سند</th><th>شرح</th><th>بدهکار</th><th>بستانکار</th><th>مانده</th>
              </tr></thead>
              <tbody>
                ${entries.map(e => `
                  <tr>
                    <td>${e.isOpening ? 'ابتدای دوره' : Utils.isoToJalaliDisplay(e.date)}</td>
                    <td>${Utils.escapeHtml(e.docNo)}</td>
                    <td>${Utils.escapeHtml(e.description)}</td>
                    <td class="text-danger">${e.debit ? Utils.formatCurrency(e.debit) : '-'}</td>
                    <td class="text-success">${e.credit ? Utils.formatCurrency(e.credit) : '-'}</td>
                    <td>${Utils.formatCurrency(e.balance)}</td>
                  </tr>`).join('') || '<tr><td colspan="6" class="text-center text-muted py-4">سندی یافت نشد</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  /* ------------------ خروجی‌های دفتر معین ------------------ */
  function exportExcel() {
    const table = document.getElementById('ledgerTable');
    if (!table) { Utils.showToast('ابتدا یک واحد را انتخاب کنید', 'warning'); return; }
    const wb = XLSX.utils.table_to_book(table, { sheet: 'دفتر معین' });
    XLSX.writeFile(wb, `دفتر-معین-${Date.now()}.xlsx`);
  }

  function exportCsv() {
    const table = document.getElementById('ledgerTable');
    if (!table) { Utils.showToast('ابتدا یک واحد را انتخاب کنید', 'warning'); return; }
    const wb = XLSX.utils.table_to_book(table, { sheet: 'دفتر معین' });
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets['دفتر معین']);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `دفتر-معین-${Date.now()}.csv`;
    link.click();
  }

  function exportReceiptsOnly(unitId) {
    const entries = getUnitLedger(unitId).filter(e => e.credit > 0);
    if (!entries.length) { Utils.showToast('دریافتی برای این واحد ثبت نشده است', 'warning'); return; }
    const rows = entries.map(e => ({
      'تاریخ': Utils.isoToJalaliDisplay(e.date),
      'شماره سند': e.docNo,
      'شرح': e.description,
      'مبلغ دریافت': e.credit,
      'مانده پس از سند': e.balance
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'دریافت‌ها');
    XLSX.writeFile(wb, `دریافت‌های-واحد-${Date.now()}.xlsx`);
  }

  /* ------------------ خلاصه کلی صندوق (دفتر کل - همه دریافت‌ها و هزینه‌ها) ------------------ */
  function renderFundSummary() {
    const box = document.getElementById('ledgerTabSummary');
    if (!box) return;

    const receipts = DB.getReceipts();
    const expenses = DB.getExpenses();
    const totalIncome = receipts.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const totalExpense = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    const fundBalance = totalIncome - totalExpense;

    const rows = [];
    receipts.forEach(r => {
      const unit = DB.getUnitById(r.unitId);
      rows.push({
        date: r.date, type: 'receipt', docNo: r.docNo,
        desc: r.description || r.type, unit: unit?.number || '-',
        amountIn: parseFloat(r.amount) || 0, amountOut: 0
      });
    });
    expenses.forEach(e => {
      rows.push({
        date: e.date, type: 'expense', docNo: e.docNo,
        desc: e.description || e.category, unit: '-',
        amountIn: 0, amountOut: parseFloat(e.amount) || 0
      });
    });
    rows.sort((a, b) => new Date(a.date) - new Date(b.date));
    let running = 0;
    rows.forEach(r => { running += r.amountIn - r.amountOut; r.balance = running; });

    box.innerHTML = `
      <div class="stat-cards mb-3">
        <div class="stat-card"><div class="stat-label">جمع کل دریافت‌ها</div><div class="stat-value text-success">${Utils.formatCurrency(totalIncome)}</div></div>
        <div class="stat-card"><div class="stat-label">جمع کل هزینه‌ها</div><div class="stat-value text-danger">${Utils.formatCurrency(totalExpense)}</div></div>
        <div class="stat-card"><div class="stat-label">مانده صندوق</div><div class="stat-value ${fundBalance < 0 ? 'text-danger' : 'text-success'}">${Utils.formatCurrency(fundBalance)}</div></div>
      </div>
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
          <span>دفتر کل صندوق (کلیه دریافت‌ها و هزینه‌ها به ترتیب تاریخ)</span>
          <div class="btn-group flex-wrap">
            <button class="btn btn-sm btn-danger" onclick="Ledger.quickAddExpense()"><i class="bi bi-plus-lg"></i> ثبت هزینه جدید</button>
            <button class="btn btn-sm btn-outline-success" onclick="Ledger.exportSummaryExcel()"><i class="bi bi-file-earmark-excel"></i> Excel</button>
            <button class="btn btn-sm btn-outline-secondary" onclick="Ledger.exportSummaryCsv()"><i class="bi bi-filetype-csv"></i> CSV</button>
            <button class="btn btn-sm btn-outline-primary" onclick="Reports.printElement('ledgerSummaryPrintArea')"><i class="bi bi-printer"></i> چاپ</button>
            <button class="btn btn-sm btn-outline-dark" onclick="Reports.exportPdf('ledgerSummaryPrintArea','fund-summary')"><i class="bi bi-file-earmark-pdf"></i> PDF</button>
          </div>
        </div>
        <div id="ledgerSummaryPrintArea">
          <div class="table-responsive">
            <table class="table table-hover align-middle mb-0" id="ledgerSummaryTable">
              <thead><tr>
                <th>تاریخ</th><th>نوع</th><th>شماره سند</th><th>شرح</th><th>واحد</th><th>واریز (دریافت)</th><th>برداشت (هزینه)</th><th>مانده صندوق</th>
              </tr></thead>
              <tbody>
                ${rows.map(r => `
                  <tr>
                    <td>${Utils.isoToJalaliDisplay(r.date)}</td>
                    <td>${r.type === 'receipt' ? '<span class="badge bg-success">دریافت</span>' : '<span class="badge bg-danger">هزینه</span>'}</td>
                    <td>${Utils.escapeHtml(r.docNo)}</td>
                    <td>${Utils.escapeHtml(r.desc || '-')}</td>
                    <td>${Utils.escapeHtml(r.unit)}</td>
                    <td class="text-success">${r.amountIn ? Utils.formatCurrency(r.amountIn) : '-'}</td>
                    <td class="text-danger">${r.amountOut ? Utils.formatCurrency(r.amountOut) : '-'}</td>
                    <td>${Utils.formatCurrency(r.balance)}</td>
                  </tr>`).join('') || '<tr><td colspan="8" class="text-center text-muted py-4">سندی ثبت نشده است</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  /** ثبت سریع هزینه جدید از داخل صفحه دفتر معین، با به‌روزرسانی خودکار خلاصه صندوق پس از ذخیره */
  function quickAddExpense() {
    Expenses.openModal(null, () => renderFundSummary());
  }

  function exportSummaryExcel() {
    const table = document.getElementById('ledgerSummaryTable');
    if (!table) return;
    const wb = XLSX.utils.table_to_book(table, { sheet: 'خلاصه صندوق' });
    XLSX.writeFile(wb, `خلاصه-صندوق-${Date.now()}.xlsx`);
  }

  function exportSummaryCsv() {
    const table = document.getElementById('ledgerSummaryTable');
    if (!table) return;
    const wb = XLSX.utils.table_to_book(table, { sheet: 'خلاصه صندوق' });
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets['خلاصه صندوق']);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `خلاصه-صندوق-${Date.now()}.csv`;
    link.click();
  }

  return {
    getUnitLedger, getAllBalances, getUnitBalance, render, renderUnitLedger,
    exportExcel, exportCsv, exportReceiptsOnly,
    renderFundSummary, quickAddExpense, exportSummaryExcel, exportSummaryCsv
  };
})();
