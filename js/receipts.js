/**
 * receipts.js
 * مدیریت دریافت‌ها: ثبت، ویرایش، حذف، جستجو، فیلتر
 */

const Receipts = (() => {
  let currentPage = 1;
  const pageSize = 8;
  let searchTerm = '';
  let unitFilter = '';
  let sortBy = 'date_desc';

  const TYPES = ['شارژ ماهانه', 'بدهی معوق', 'جریمه', 'سایر'];
  const METHODS = { cash: 'نقد', card: 'کارت', transfer: 'انتقال بانکی' };
  const SORT_OPTIONS = [
    { value: 'date_desc', label: 'تاریخ (جدیدترین)' },
    { value: 'date_asc', label: 'تاریخ (قدیمی‌ترین)' },
    { value: 'amount_desc', label: 'مبلغ (بیشترین)' },
    { value: 'amount_asc', label: 'مبلغ (کمترین)' },
    { value: 'docNo_desc', label: 'شماره سند (جدیدترین)' },
    { value: 'docNo_asc', label: 'شماره سند (قدیمی‌ترین)' }
  ];

  function render() {
    const units = DB.getUnits();
    const container = document.getElementById('page-receipts');
    container.innerHTML = `
      <div class="page-header">
        <h4><svg class="page-icon" viewBox="0 0 24 24"><path d="M12 4v11"/><path d="M7.5 10.5 12 15l4.5-4.5"/><path d="M4.5 19.5h15"/></svg> دریافت‌ها</h4>
        <button class="btn btn-primary" id="btnAddReceipt"><i class="bi bi-plus-lg"></i> دریافت جدید</button>
      </div>
      <div class="card mb-3">
        <div class="card-body d-flex flex-wrap gap-2">
          <input type="text" class="form-control" style="max-width:260px" id="receiptSearch" placeholder="جستجو در شرح، شماره سند...">
          <select class="form-select" style="max-width:200px" id="receiptUnitFilter">
            <option value="">همه واحدها</option>
            ${units.map(u => `<option value="${u.id}">${Utils.escapeHtml(Utils.unitLabel(u))}</option>`).join('')}
          </select>
          <select class="form-select" style="max-width:200px" id="receiptSortBy">
            ${SORT_OPTIONS.map(o => `<option value="${o.value}" ${sortBy === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="card">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead><tr>
              <th>سند</th><th>تاریخ</th><th>واحد</th><th>نوع</th><th>شرح</th><th>مبلغ</th><th>روش</th><th>ثبت‌کننده</th><th>عملیات</th>
            </tr></thead>
            <tbody id="receiptsTableBody"></tbody>
          </table>
        </div>
        <div class="card-footer" id="receiptsPagination"></div>
      </div>
    `;
    document.getElementById('btnAddReceipt').addEventListener('click', () => openModal());
    document.getElementById('receiptSearch').addEventListener('input', Utils.debounce(e => {
      searchTerm = e.target.value.trim(); currentPage = 1; renderTable();
    }, 250));
    document.getElementById('receiptUnitFilter').addEventListener('change', e => {
      unitFilter = e.target.value; currentPage = 1; renderTable();
    });
    document.getElementById('receiptSortBy').addEventListener('change', e => {
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
    let list = DB.getReceipts();
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(r => (r.description || '').toLowerCase().includes(q) || (r.docNo || '').toLowerCase().includes(q));
    }
    if (unitFilter) list = list.filter(r => r.unitId === unitFilter);
    return applySort(list);
  }

  function renderTable() {
    const list = getFiltered();
    const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * pageSize;
    const pageItems = list.slice(start, start + pageSize);
    const tbody = document.getElementById('receiptsTableBody');
    tbody.innerHTML = pageItems.map(r => {
      const unit = DB.getUnitById(r.unitId);
      return `
      <tr>
        <td>${Utils.escapeHtml(r.docNo)}</td>
        <td>${Utils.isoToJalaliDisplay(r.date)}</td>
        <td>${Utils.escapeHtml(unit?.number || '-')}</td>
        <td>${Utils.escapeHtml(r.type || '-')}</td>
        <td>${Utils.escapeHtml(r.description || '-')}</td>
        <td class="text-success fw-bold">${Utils.formatCurrency(r.amount)}</td>
        <td>${METHODS[r.method] || '-'}</td>
        <td>${Utils.escapeHtml(r.registrar || '-')}</td>
        <td class="text-nowrap">
          <button class="btn btn-sm btn-outline-info" title="چاپ رسید" onclick="Receipts.printVoucher('${r.id}')"><i class="bi bi-receipt"></i></button>
          ${r.attachment ? `<button class="btn btn-sm btn-outline-secondary" onclick="Receipts.viewAttachment('${r.id}')"><i class="bi bi-paperclip"></i></button>` : ''}
          <button class="btn btn-sm btn-outline-primary" onclick="Receipts.edit('${r.id}')"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger" onclick="Receipts.remove('${r.id}')"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`;
    }).join('') || `<tr><td colspan="9" class="text-center text-muted py-4">دریافتی یافت نشد</td></tr>`;

    const pag = document.getElementById('receiptsPagination');
    let pagHtml = `<div class="d-flex justify-content-between align-items-center"><span class="text-muted small">${list.length} سند</span><div class="btn-group">`;
    for (let i = 1; i <= totalPages; i++) {
      pagHtml += `<button class="btn btn-sm ${i === currentPage ? 'btn-primary' : 'btn-outline-primary'}" onclick="Receipts.goToPage(${i})">${Utils.formatNumber(i)}</button>`;
    }
    pagHtml += `</div></div>`;
    pag.innerHTML = pagHtml;
  }

  function goToPage(p) { currentPage = p; renderTable(); }

  function openModal(receipt = null) {
    const isEdit = !!receipt;
    const units = DB.getUnits();
    const modalHtml = `
      <div class="modal fade" id="receiptModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">${isEdit ? 'ویرایش دریافت' : 'ثبت دریافت جدید'}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="receiptForm">
                <div class="row g-3">
                  <div class="col-md-4"><label class="form-label">تاریخ *</label>
                    ${Utils.renderJalaliDateInput('date', receipt?.date)}</div>
                  <div class="col-md-4"><label class="form-label">واحد *</label>
                    <select class="form-select" name="unitId" required>
                      <option value="">انتخاب کنید</option>
                      ${units.map(u => `<option value="${u.id}" ${receipt?.unitId === u.id ? 'selected' : ''}>${Utils.escapeHtml(Utils.unitLabel(u))}</option>`).join('')}
                    </select></div>
                  <div class="col-md-4"><label class="form-label">نوع دریافت</label>
                    <select class="form-select" name="type">
                      ${TYPES.map(t => `<option ${receipt?.type === t ? 'selected' : ''}>${t}</option>`).join('')}
                    </select></div>
                  <div class="col-12"><label class="form-label">شرح</label>
                    <input class="form-control" name="description" value="${Utils.escapeHtml(receipt?.description || '')}"></div>
                  <div class="col-md-4"><label class="form-label">مبلغ (تومان) *</label>
                    <input class="form-control money-input" name="amount" required value="${receipt?.amount ?? ''}"></div>
                  <div class="col-md-4"><label class="form-label">روش پرداخت</label>
                    <select class="form-select" name="method">
                      <option value="transfer" ${(!receipt || receipt.method === 'transfer') ? 'selected' : ''}>انتقال بانکی</option>
                      <option value="cash" ${receipt?.method === 'cash' ? 'selected' : ''}>نقد</option>
                      <option value="card" ${receipt?.method === 'card' ? 'selected' : ''}>کارت</option>
                    </select></div>
                  <div class="col-md-4"><label class="form-label">شماره پیگیری</label>
                    <input class="form-control" name="trackingNo" value="${Utils.escapeHtml(receipt?.trackingNo || '')}"></div>
                  <div class="col-md-6"><label class="form-label">ثبت‌کننده</label>
                    <input class="form-control" name="registrar" value="${Utils.escapeHtml(receipt?.registrar || '')}"></div>
                  <div class="col-md-6"><label class="form-label">پیوست فایل</label>
                    <div id="receiptAttachmentBox"></div></div>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              ${isEdit ? `<button type="button" class="btn btn-outline-info me-auto" onclick="Receipts.printVoucher('${receipt.id}')"><i class="bi bi-receipt"></i> چاپ رسید</button>` : ''}
              <button class="btn btn-secondary" data-bs-dismiss="modal">انصراف</button>
              <button class="btn btn-primary" id="saveReceiptBtn">ذخیره</button>
            </div>
          </div>
        </div>
      </div>`;
    App.mountModal(modalHtml, 'receiptModal');
    Utils.bindAllMoneyInputs(document.getElementById('receiptModal'));
    const attachmentUploader = Utils.createAttachmentUploader(
      document.getElementById('receiptAttachmentBox'), receipt?.attachment || null
    );
    document.getElementById('saveReceiptBtn').addEventListener('click', () => save(receipt, attachmentUploader));
  }

  async function save(existing, attachmentUploader) {
    const form = document.getElementById('receiptForm');
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());
    data.date = Utils.readJalaliDateInput(form, 'date');

    if (!Utils.validateRequired(data.unitId)) { Utils.showToast('انتخاب واحد الزامی است', 'error'); return; }
    data.amount = Utils.parseMoneyValue(data.amount);
    if (!data.amount || data.amount <= 0) { Utils.showToast('مبلغ نامعتبر است', 'error'); return; }

    if (attachmentUploader.isUploading()) { Utils.showToast('لطفاً صبر کنید تا آپلود فایل تمام شود', 'warning'); return; }
    data.attachment = attachmentUploader.getValue();

    ['description', 'trackingNo', 'registrar', 'type'].forEach(k => data[k] = Utils.sanitizeInput(data[k]));

    let success;
    if (existing) success = await DB.updateReceipt(existing.id, data);
    else success = await DB.addReceipt(data);

    if (success) {
      Utils.showToast(existing ? 'دریافت ویرایش شد' : 'دریافت جدید ثبت شد', 'success');
      App.closeModal('receiptModal');
      render();
      Dashboard.refreshStatsIfActive();
    }
  }

  function edit(id) {
    const r = DB.getReceipts().find(x => x.id === id);
    if (r) openModal(r);
  }

  function remove(id) {
    Swal.fire({
      title: 'حذف دریافت', text: 'این سند حذف خواهد شد.', icon: 'warning',
      showCancelButton: true, confirmButtonText: 'حذف', cancelButtonText: 'انصراف', confirmButtonColor: '#dc3545'
    }).then(async res => {
      if (res.isConfirmed) {
        await DB.deleteReceipt(id);
        Utils.showToast('دریافت حذف شد', 'success');
        renderTable();
        Dashboard.refreshStatsIfActive();
      }
    });
  }

  function viewAttachment(id) {
    const r = DB.getReceipts().find(x => x.id === id);
    if (!r?.attachment) return;
    Swal.fire({
      title: 'پیوست سند',
      html: Utils.isImageAttachment(r.attachment) ? `<img src="${r.attachment}" style="max-width:100%">` : `<a href="${r.attachment}" target="_blank" rel="noopener">دانلود فایل پیوست</a>`,
      width: 600,
      showCloseButton: true,
      showConfirmButton: false
    });
  }

  /** چاپ رسید دریافت وجه جهت تحویل به پرداخت‌کننده */
  function printVoucher(id) {
    const r = DB.getReceipts().find(x => x.id === id);
    if (!r) { Utils.showToast('رسید یافت نشد', 'error'); return; }
    const unit = DB.getUnitById(r.unitId);
    const s = DB.getSettings();
    const amount = parseFloat(r.amount) || 0;
    const amountWords = `${Utils.numberToPersianWords(amount)} ${s.currency || 'تومان'}`;
    const win = window.open('', '_blank');
    if (!win) { Utils.showToast('مرورگر امکان باز کردن پنجره چاپ را نداد', 'warning'); return; }

    win.document.write(`
      <html dir="rtl" lang="fa"><head><meta charset="utf-8"><title>رسید دریافت وجه</title>
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
          <h3>رسید دریافت وجه</h3>
        </div>
        <div class="row"><span class="label">شماره رسید:</span><span>${Utils.escapeHtml(r.docNo)}</span></div>
        <div class="row"><span class="label">تاریخ:</span><span>${Utils.isoToJalaliDisplay(r.date)}</span></div>
        <div class="row"><span class="label">دریافت شده از:</span><span>${Utils.escapeHtml(unit?.tenant || unit?.owner || '-')} (واحد ${Utils.escapeHtml(unit?.number || '-')})</span></div>
        <div class="row"><span class="label">بابت:</span><span>${Utils.escapeHtml(r.description || r.type || '-')}</span></div>
        <div class="row"><span class="label">روش پرداخت:</span><span>${METHODS[r.method] || '-'}</span></div>
        ${r.trackingNo ? `<div class="row"><span class="label">شماره پیگیری:</span><span>${Utils.escapeHtml(r.trackingNo)}</span></div>` : ''}
        <div class="amount-box">
          <div class="amt">مبلغ: ${Utils.formatCurrency(amount, s.currency)}</div>
          <div class="words">(${amountWords})</div>
        </div>
        <div class="row"><span class="label">ثبت‌کننده:</span><span>${Utils.escapeHtml(r.registrar || '-')}</span></div>
        <div class="sign">
          <div>امضای دریافت‌کننده (مدیر ساختمان)</div>
          <div>امضای پرداخت‌کننده</div>
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
