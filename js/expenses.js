/**
 * expenses.js
 * مدیریت هزینه‌ها: ثبت، ویرایش، حذف، جستجو، فیلتر
 */

const Expenses = (() => {
  let currentPage = 1;
  const pageSize = 8;
  let searchTerm = '';
  let categoryFilter = '';
  let personFilter = '';
  let sortBy = 'date_desc';

  const CATEGORIES = ['نگهبانی', 'نظافت', 'تعمیرات', 'آب', 'برق', 'گاز', 'آسانسور', 'فضای سبز', 'حقوق', 'اداری', 'سایر'];
  const SORT_OPTIONS = [
    { value: 'date_desc', label: 'تاریخ (جدیدترین)' },
    { value: 'date_asc', label: 'تاریخ (قدیمی‌ترین)' },
    { value: 'amount_desc', label: 'مبلغ (بیشترین)' },
    { value: 'amount_asc', label: 'مبلغ (کمترین)' },
    { value: 'docNo_desc', label: 'شماره سند (جدیدترین)' },
    { value: 'docNo_asc', label: 'شماره سند (قدیمی‌ترین)' }
  ];

  function render() {
    const container = document.getElementById('page-expenses');
    container.innerHTML = `
      <div class="page-header">
        <h4><svg class="page-icon" viewBox="0 0 24 24"><path d="M12 20V9"/><path d="M7.5 13.5 12 9l4.5 4.5"/><path d="M4.5 4.5h15"/></svg> هزینه‌ها</h4>
        <button class="btn btn-primary" id="btnAddExpense"><i class="bi bi-plus-lg"></i> هزینه جدید</button>
      </div>
      <div class="card mb-3">
        <div class="card-body d-flex flex-wrap gap-2">
          <input type="text" class="form-control" style="max-width:260px" id="expenseSearch" placeholder="جستجو در شرح، شماره سند...">
          <select class="form-select" style="max-width:200px" id="expenseCategoryFilter">
            <option value="">همه دسته‌ها</option>
            ${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
          <select class="form-select" style="max-width:220px" id="expensePersonFilter">
            <option value="">همه اشخاص</option>
            ${DB.getPersons().map(p => `<option value="${p.id}">${Utils.escapeHtml(p.name)}</option>`).join('')}
          </select>
          <select class="form-select" style="max-width:200px" id="expenseSortBy">
            ${SORT_OPTIONS.map(o => `<option value="${o.value}" ${sortBy === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="card">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead><tr>
              <th>سند</th><th>تاریخ</th><th>دسته</th><th>شرح</th><th>مبلغ</th><th>پرداخت به</th><th>شماره فاکتور</th><th>ثبت‌کننده</th><th>عملیات</th>
            </tr></thead>
            <tbody id="expensesTableBody"></tbody>
          </table>
        </div>
        <div class="card-footer" id="expensesPagination"></div>
      </div>
    `;
    document.getElementById('btnAddExpense').addEventListener('click', () => openModal());
    document.getElementById('expenseSearch').addEventListener('input', Utils.debounce(e => {
      searchTerm = e.target.value.trim(); currentPage = 1; renderTable();
    }, 250));
    document.getElementById('expenseCategoryFilter').addEventListener('change', e => {
      categoryFilter = e.target.value; currentPage = 1; renderTable();
    });
    document.getElementById('expensePersonFilter').addEventListener('change', e => {
      personFilter = e.target.value; currentPage = 1; renderTable();
    });
    document.getElementById('expenseSortBy').addEventListener('change', e => {
      sortBy = e.target.value; currentPage = 1; renderTable();
    });
    renderTable();
  }

  function applySort(list) {
    const [field, dir] = sortBy.split('_');
    const mul = dir === 'asc' ? 1 : -1;
    return list.sort((a, b) => {
      if (field === 'date') return mul * (new Date(a.date) - new Date(b.date));
      if (field === 'amount') return mul * ((parseFloat(a.amount) || 0) - (parseFloat(b.amount) || 0));
      if (field === 'docNo') return mul * String(a.docNo || '').localeCompare(String(b.docNo || ''), 'fa');
      return 0;
    });
  }

  function getFiltered() {
    let list = DB.getExpenses();
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(e => (e.description || '').toLowerCase().includes(q) || (e.docNo || '').toLowerCase().includes(q));
    }
    if (categoryFilter) list = list.filter(e => e.category === categoryFilter);
    if (personFilter) list = list.filter(e => e.personId === personFilter);
    return applySort(list);
  }

  function renderTable() {
    const list = getFiltered();
    const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * pageSize;
    const pageItems = list.slice(start, start + pageSize);
    const tbody = document.getElementById('expensesTableBody');
    tbody.innerHTML = pageItems.map(e => {
      const person = e.personId ? DB.getPersonById(e.personId) : null;
      return `
      <tr>
        <td>${Utils.escapeHtml(e.docNo)}</td>
        <td>${Utils.isoToJalaliDisplay(e.date)}</td>
        <td>${Utils.escapeHtml(e.category || '-')}</td>
        <td>${Utils.escapeHtml(e.description || '-')}</td>
        <td class="text-danger fw-bold">${Utils.formatCurrency(e.amount)}</td>
        <td>${person ? `<span class="badge bg-info-subtle text-dark">${Utils.escapeHtml(person.name)}</span>` : Utils.escapeHtml(e.payTo || '-')}</td>
        <td>${Utils.escapeHtml(e.invoiceNo || '-')}</td>
        <td>${Utils.escapeHtml(e.registrar || '-')}</td>
        <td class="text-nowrap">
          <button class="btn btn-sm btn-outline-info" title="چاپ رسید" onclick="Expenses.printVoucher('${e.id}')"><i class="bi bi-receipt"></i></button>
          ${e.attachment ? `<button class="btn btn-sm btn-outline-secondary" onclick="Expenses.viewAttachment('${e.id}')"><i class="bi bi-paperclip"></i></button>` : ''}
          <button class="btn btn-sm btn-outline-primary" onclick="Expenses.edit('${e.id}')"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger" onclick="Expenses.remove('${e.id}')"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`;
    }).join('') || `<tr><td colspan="9" class="text-center text-muted py-4">هزینه‌ای یافت نشد</td></tr>`;

    const pag = document.getElementById('expensesPagination');
    let pagHtml = `<div class="d-flex justify-content-between align-items-center"><span class="text-muted small">${list.length} سند</span><div class="btn-group">`;
    for (let i = 1; i <= totalPages; i++) {
      pagHtml += `<button class="btn btn-sm ${i === currentPage ? 'btn-primary' : 'btn-outline-primary'}" onclick="Expenses.goToPage(${i})">${Utils.formatNumber(i)}</button>`;
    }
    pagHtml += `</div></div>`;
    pag.innerHTML = pagHtml;
  }

  function goToPage(p) { currentPage = p; renderTable(); }

  function openModal(expense = null, onSaved = null) {
    const isEdit = !!expense;
    const modalHtml = `
      <div class="modal fade" id="expenseModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">${isEdit ? 'ویرایش هزینه' : 'ثبت هزینه جدید'}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="expenseForm">
                <div class="row g-3">
                  <div class="col-md-4"><label class="form-label">تاریخ *</label>
                    ${Utils.renderJalaliDateInput('date', expense?.date)}</div>
                  <div class="col-md-4"><label class="form-label">دسته هزینه *</label>
                    <select class="form-select" name="category" required>
                      <option value="">انتخاب کنید</option>
                      ${CATEGORIES.map(c => `<option ${expense?.category === c ? 'selected' : ''}>${c}</option>`).join('')}
                    </select></div>
                  <div class="col-md-4"><label class="form-label">مبلغ (تومان) *</label>
                    <input class="form-control money-input" name="amount" required value="${expense?.amount ?? ''}"></div>
                  <div class="col-12"><label class="form-label">شرح</label>
                    <input class="form-control" name="description" value="${Utils.escapeHtml(expense?.description || '')}"></div>
                  <div class="col-md-6"><label class="form-label">شخص (اختیاری - از لیست اشخاص تعریف‌شده)</label>
                    <select class="form-select" name="personId" id="expensePersonSelect">
                      <option value="">-- بدون شخص خاص --</option>
                      ${DB.getPersons().map(p => `<option value="${p.id}" ${expense?.personId === p.id ? 'selected' : ''}>${Utils.escapeHtml(p.name)}${p.type ? ' (' + Utils.escapeHtml(p.type) + ')' : ''}</option>`).join('')}
                    </select></div>
                  <div class="col-md-6"><label class="form-label">پرداخت به</label>
                    <input class="form-control" name="payTo" id="expensePayToInput" value="${Utils.escapeHtml(expense?.payTo || '')}"></div>
                  <div class="col-md-6"><label class="form-label">شماره فاکتور</label>
                    <input class="form-control" name="invoiceNo" value="${Utils.escapeHtml(expense?.invoiceNo || '')}"></div>
                  <div class="col-md-6"><label class="form-label">ثبت‌کننده</label>
                    <input class="form-control" name="registrar" value="${Utils.escapeHtml(expense?.registrar || '')}"></div>
                  <div class="col-md-6"><label class="form-label">پیوست فایل</label>
                    <div id="expenseAttachmentBox"></div></div>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              ${expense ? `<button type="button" class="btn btn-outline-info me-auto" onclick="Expenses.printVoucher('${expense.id}')"><i class="bi bi-receipt"></i> چاپ رسید</button>` : ''}
              <button class="btn btn-secondary" data-bs-dismiss="modal">انصراف</button>
              <button class="btn btn-primary" id="saveExpenseBtn">ذخیره</button>
            </div>
          </div>
        </div>
      </div>`;
    App.mountModal(modalHtml, 'expenseModal');
    Utils.bindAllMoneyInputs(document.getElementById('expenseModal'));
    const attachmentUploader = Utils.createAttachmentUploader(
      document.getElementById('expenseAttachmentBox'), expense?.attachment || null
    );
    document.getElementById('expensePersonSelect').addEventListener('change', (e) => {
      const person = DB.getPersonById(e.target.value);
      if (person) document.getElementById('expensePayToInput').value = person.name;
    });
    document.getElementById('saveExpenseBtn').addEventListener('click', () => save(expense, onSaved, attachmentUploader));
  }

  async function save(existing, onSaved, attachmentUploader) {
    const form = document.getElementById('expenseForm');
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());
    data.date = Utils.readJalaliDateInput(form, 'date');

    if (!Utils.validateRequired(data.category)) { Utils.showToast('انتخاب دسته هزینه الزامی است', 'error'); return; }
    data.amount = Utils.parseMoneyValue(data.amount);
    if (!data.amount || data.amount <= 0) { Utils.showToast('مبلغ نامعتبر است', 'error'); return; }

    if (attachmentUploader.isUploading()) { Utils.showToast('لطفاً صبر کنید تا آپلود فایل تمام شود', 'warning'); return; }
    data.attachment = attachmentUploader.getValue();

    ['description', 'payTo', 'invoiceNo', 'registrar'].forEach(k => data[k] = Utils.sanitizeInput(data[k]));

    let success;
    if (existing) success = await DB.updateExpense(existing.id, data);
    else success = await DB.addExpense(data);

    if (success) {
      Utils.showToast(existing ? 'هزینه ویرایش شد' : 'هزینه جدید ثبت شد', 'success');
      App.closeModal('expenseModal');
      render();
      Dashboard.refreshStatsIfActive();
      if (typeof onSaved === 'function') onSaved();
    }
  }

  function edit(id) {
    const e = DB.getExpenses().find(x => x.id === id);
    if (e) openModal(e);
  }

  function remove(id) {
    Swal.fire({
      title: 'حذف هزینه', text: 'این سند حذف خواهد شد.', icon: 'warning',
      showCancelButton: true, confirmButtonText: 'حذف', cancelButtonText: 'انصراف', confirmButtonColor: '#dc3545'
    }).then(async res => {
      if (res.isConfirmed) {
        await DB.deleteExpense(id);
        Utils.showToast('هزینه حذف شد', 'success');
        renderTable();
        Dashboard.refreshStatsIfActive();
      }
    });
  }

  function viewAttachment(id) {
    const e = DB.getExpenses().find(x => x.id === id);
    if (!e?.attachment) return;
    Swal.fire({
      title: 'پیوست سند',
      html: Utils.isImageAttachment(e.attachment) ? `<img src="${e.attachment}" style="max-width:100%">` : `<a href="${e.attachment}" target="_blank" rel="noopener">دانلود فایل پیوست</a>`,
      width: 600,
      showCloseButton: true,
      showConfirmButton: false
    });
  }

  /** چاپ رسید پرداخت هزینه جهت آرشیو یا تحویل به شخص/دریافت‌کننده وجه */
  function printVoucher(id) {
    const e = DB.getExpenses().find(x => x.id === id);
    if (!e) { Utils.showToast('سند یافت نشد', 'error'); return; }
    const person = e.personId ? DB.getPersonById(e.personId) : null;
    const s = DB.getSettings();
    const amount = parseFloat(e.amount) || 0;
    const amountWords = `${Utils.numberToPersianWords(amount)} ${s.currency || 'تومان'}`;
    const win = window.open('', '_blank');
    if (!win) { Utils.showToast('مرورگر امکان باز کردن پنجره چاپ را نداد', 'warning'); return; }

    win.document.write(`
      <html dir="rtl" lang="fa"><head><meta charset="utf-8"><title>رسید پرداخت هزینه</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        :root{ --primary: ${s.primaryColor || '#2563eb'}; }
        * { box-sizing: border-box; }
        body{font-family:'IRANSansX','Vazirmatn',Tahoma,Arial,sans-serif;padding:24px;color:#1f2430;background:#fff}
        .voucher{max-width:640px;margin:auto;border:2px solid var(--primary);border-radius:16px;padding:26px}
        .voucher-header{text-align:center;border-bottom:2px dashed #ddd;padding-bottom:14px;margin-bottom:16px}
        .voucher-header h2{margin:0 0 6px;font-size:20px;font-weight:700}
        .voucher-header div{font-size:13px;color:#6b7280}
        .voucher-header h3{margin-top:14px;font-size:16px;font-weight:600;color:#fff;background:var(--primary);display:inline-block;padding:6px 20px;border-radius:20px}
        .row{display:flex;justify-content:space-between;padding:9px 2px;border-bottom:1px dotted #e5e7eb;font-size:14px}
        .label{color:#6b7280;font-weight:600}
        .amount-box{background:rgba(37,99,235,.06);border:1px solid var(--primary);border-radius:12px;padding:14px;margin:16px 0;text-align:center}
        .amount-box .amt{font-size:20px;font-weight:700;color:#1f2430}
        .amount-box .words{font-size:13px;color:#444;margin-top:6px}
        .sign{display:flex;justify-content:space-between;margin-top:60px}
        .sign div{width:44%;text-align:center;border-top:1px solid #333;padding-top:8px;font-size:13px;color:#444}
        @media print { .no-print{display:none} }
        @page { size: auto; margin: 0; }
      </style></head>
      <body>
      <div class="voucher">
        <div class="voucher-header">
          ${s.logo ? `<img src="${s.logo}" style="height:50px;border-radius:8px;margin-bottom:8px">` : ''}
          <h2>${Utils.escapeHtml(s.buildingName || 'ساختمان')}</h2>
          <div>${Utils.escapeHtml(s.address || '')}</div>
          <div>${s.phone ? 'تلفن تماس: ' + Utils.escapeHtml(s.phone) : ''}</div>
          <h3>رسید پرداخت هزینه</h3>
        </div>
        <div class="row"><span class="label">شماره سند:</span><span>${Utils.escapeHtml(e.docNo)}</span></div>
        <div class="row"><span class="label">تاریخ:</span><span>${Utils.isoToJalaliDisplay(e.date)}</span></div>
        <div class="row"><span class="label">دسته هزینه:</span><span>${Utils.escapeHtml(e.category || '-')}</span></div>
        <div class="row"><span class="label">پرداخت شده به:</span><span>${Utils.escapeHtml(person?.name || e.payTo || '-')}</span></div>
        <div class="row"><span class="label">بابت:</span><span>${Utils.escapeHtml(e.description || '-')}</span></div>
        ${e.invoiceNo ? `<div class="row"><span class="label">شماره فاکتور:</span><span>${Utils.escapeHtml(e.invoiceNo)}</span></div>` : ''}
        <div class="amount-box">
          <div class="amt">مبلغ: ${Utils.formatCurrency(amount, s.currency)}</div>
          <div class="words">(${amountWords})</div>
        </div>
        <div class="row"><span class="label">ثبت‌کننده:</span><span>${Utils.escapeHtml(e.registrar || '-')}</span></div>
        <div class="sign">
          <div>امضای پرداخت‌کننده (مدیر ساختمان)</div>
          <div>امضای دریافت‌کننده وجه</div>
        </div>
      </div>
      <div class="no-print" style="text-align:center;margin-top:20px">
        <button onclick="window.print()" style="padding:8px 20px;font-size:14px;cursor:pointer;font-family:inherit;border-radius:8px;border:1px solid var(--primary);background:var(--primary);color:#fff">چاپ رسید</button>
        <button onclick="window.close()" style="padding:8px 20px;font-size:14px;cursor:pointer;font-family:inherit;border-radius:8px;border:1px solid #999;background:#fff;color:#333;margin-right:8px">بازگشت</button>
      </div>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 350);
  }

  return { render, renderTable, goToPage, edit, remove, viewAttachment, printVoucher };
})();
