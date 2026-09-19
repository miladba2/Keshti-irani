/**
 * charges.js
 * صدور و مدیریت اسناد شارژ ماهانه برای واحدها
 * هر سند شارژ، بر اساس فیلد «سهم شارژ» ثبت‌شده در مشخصات واحد، به‌عنوان یک سند بدهکار
 * در دفتر معین همان واحد درج می‌شود (به‌صورت جدا از هزینه‌ها).
 */

const Charges = (() => {
  let currentPage = 1;
  const pageSize = 8;
  let searchTerm = '';
  let unitFilter = '';

  function render() {
    const units = DB.getUnits();
    const t = Utils.todayJalali();
    const container = document.getElementById('page-charges');

    const yearOptions = [];
    for (let y = t.jy - 2; y <= t.jy + 1; y++) {
      yearOptions.push(`<option value="${y}" ${y === t.jy ? 'selected' : ''}>${Utils.toPersianDigits(y)}</option>`);
    }
    const monthOptions = Utils.PERSIAN_MONTHS.map((mn, i) =>
      `<option value="${i + 1}" ${(i + 1) === t.jm ? 'selected' : ''}>${mn}</option>`).join('');

    container.innerHTML = `
      <div class="page-header"><h4><svg class="page-icon" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="1.6"/><line x1="3.5" y1="9.5" x2="20.5" y2="9.5"/><line x1="8" y1="3" x2="8" y2="6.5"/><line x1="16" y1="3" x2="16" y2="6.5"/><path d="M8.5 14.5l2 2 4.5-4.5"/></svg> شارژ ماهانه</h4></div>

      <div class="card mb-3">
        <div class="card-body">
          <div class="row g-3 align-items-end">
            <div class="col-md-3">
              <label class="form-label">سال</label>
              <select class="form-select" id="chargeYear">${yearOptions.join('')}</select>
            </div>
            <div class="col-md-3">
              <label class="form-label">ماه</label>
              <select class="form-select" id="chargeMonth">${monthOptions}</select>
            </div>
            <div class="col-md-6">
              <label class="form-label">واحد (فقط برای صدور تکی - اختیاری)</label>
              <select class="form-select" id="chargeSingleUnit">
                <option value="">-- انتخاب واحد --</option>
                ${units.map(u => `<option value="${u.id}">${Utils.escapeHtml(Utils.unitLabel(u))}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="row g-3 mt-1">
            <div class="col-md-6">
              <button class="btn btn-primary w-100" id="btnGenerateCharge">
                <i class="bi bi-lightning-charge"></i> صدور شارژ برای همه واحدهای فعال
              </button>
            </div>
            <div class="col-md-6">
              <button class="btn btn-outline-primary w-100" id="btnGenerateSingleCharge">
                <i class="bi bi-lightning"></i> صدور شارژ فقط برای واحد انتخاب‌شده
              </button>
            </div>
          </div>
          <div class="form-text mt-2">
            مبلغ هر واحد بر اساس فیلد «سهم شارژ (ماهانه)» ثبت‌شده در مشخصات همان واحد محاسبه می‌شود.
            اگر شارژ این ماه قبلاً برای واحدی صادر شده باشد، دوباره صادر نخواهد شد.
          </div>
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-body d-flex flex-wrap gap-2">
          <input type="text" class="form-control" style="max-width:260px" id="chargeSearch" placeholder="جستجو در شماره سند یا شماره واحد...">
          <select class="form-select" style="max-width:200px" id="chargeUnitFilter">
            <option value="">همه واحدها</option>
            ${units.map(u => `<option value="${u.id}">${Utils.escapeHtml(Utils.unitLabel(u))}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
          <span>اسناد شارژ صادرشده</span>
          <div class="btn-group">
            <button class="btn btn-sm btn-outline-success" onclick="Charges.exportExcel()"><i class="bi bi-file-earmark-excel"></i> Excel</button>
            <button class="btn btn-sm btn-outline-secondary" onclick="Charges.exportCsv()"><i class="bi bi-filetype-csv"></i> CSV</button>
          </div>
        </div>
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0" id="chargesTable">
            <thead><tr><th>شماره سند</th><th>تاریخ</th><th>واحد</th><th>دوره</th><th>مبلغ</th><th>عملیات</th></tr></thead>
            <tbody id="chargesTableBody"></tbody>
          </table>
        </div>
        <div class="card-footer" id="chargesPagination"></div>
      </div>
    `;

    document.getElementById('btnGenerateCharge').addEventListener('click', handleGenerateClick);
    document.getElementById('btnGenerateSingleCharge').addEventListener('click', handleGenerateSingleClick);
    document.getElementById('chargeSearch').addEventListener('input', Utils.debounce(e => {
      searchTerm = e.target.value.trim(); currentPage = 1; renderTable();
    }, 250));
    document.getElementById('chargeUnitFilter').addEventListener('change', e => {
      unitFilter = e.target.value; currentPage = 1; renderTable();
    });

    renderTable();
  }

  function handleGenerateClick() {
    const jy = parseInt(document.getElementById('chargeYear').value);
    const jm = parseInt(document.getElementById('chargeMonth').value);
    const units = DB.getUnits().filter(u => u.status !== 'inactive');
    const monthLabel = `${Utils.jalaliMonthName(jm)} ${Utils.toPersianDigits(jy)}`;

    if (!units.length) { Utils.showToast('هیچ واحد فعالی برای صدور شارژ وجود ندارد', 'warning'); return; }

    Swal.fire({
      title: 'صدور شارژ ماهانه',
      text: `آیا شارژ دوره «${monthLabel}» برای ${units.length} واحد فعال صادر شود؟`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'بله، صادر شود',
      cancelButtonText: 'انصراف'
    }).then(async res => {
      if (res.isConfirmed) await generate(jy, jm, monthLabel);
    });
  }

  function handleGenerateSingleClick() {
    const jy = parseInt(document.getElementById('chargeYear').value);
    const jm = parseInt(document.getElementById('chargeMonth').value);
    const unitId = document.getElementById('chargeSingleUnit').value;
    const monthLabel = `${Utils.jalaliMonthName(jm)} ${Utils.toPersianDigits(jy)}`;

    if (!unitId) { Utils.showToast('لطفاً ابتدا یک واحد را انتخاب کنید', 'warning'); return; }
    const unit = DB.getUnitById(unitId);
    if (!unit) return;

    if (DB.hasChargeForUnitMonth(unitId, jy, jm)) {
      Utils.showToast(`شارژ دوره «${monthLabel}» قبلاً برای واحد ${unit.number} صادر شده است`, 'warning');
      return;
    }
    if ((parseFloat(unit.chargeShare) || 0) <= 0) {
      Utils.showToast('این واحد سهم شارژ ثبت‌شده‌ای ندارد', 'warning');
      return;
    }

    Swal.fire({
      title: 'صدور شارژ برای یک واحد',
      text: `آیا شارژ دوره «${monthLabel}» فقط برای واحد ${unit.number} صادر شود؟`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'بله، صادر شود',
      cancelButtonText: 'انصراف'
    }).then(res => {
      if (res.isConfirmed) generateSingle(jy, jm, monthLabel, unit);
    });
  }

  async function generateSingle(jy, jm, monthLabel, unit) {
    const dateIso = Utils.jalaliToIso(jy, jm, 1);
    const amount = parseFloat(unit.chargeShare) || 0;
    const success = await DB.addCharge({
      unitId: unit.id,
      jy, jm,
      date: dateIso,
      amount,
      description: `شارژ ماهانه ${monthLabel} - واحد ${unit.number}`
    });
    if (success) {
      Utils.showToast(`سند شارژ برای واحد ${unit.number} صادر شد`, 'success');
      renderTable();
      Dashboard.refreshStatsIfActive();
    }
  }

  async function generate(jy, jm, monthLabel) {
    const units = DB.getUnits().filter(u => u.status !== 'inactive');
    const dateIso = Utils.jalaliToIso(jy, jm, 1);
    let created = 0, skippedExisting = 0, skippedZero = 0;

    for (const u of units) {
      if (DB.hasChargeForUnitMonth(u.id, jy, jm)) { skippedExisting++; continue; }
      const amount = parseFloat(u.chargeShare) || 0;
      if (amount <= 0) { skippedZero++; continue; }
      await DB.addCharge({
        unitId: u.id,
        jy, jm,
        date: dateIso,
        amount,
        description: `شارژ ماهانه ${monthLabel} - واحد ${u.number}`
      });
      created++;
    }

    let msg = `${Utils.formatNumber(created)} سند شارژ صادر شد.`;
    if (skippedExisting) msg += ` (${Utils.formatNumber(skippedExisting)} واحد قبلاً برای این ماه شارژ داشتند)`;
    if (skippedZero) msg += ` (${Utils.formatNumber(skippedZero)} واحد فاقد سهم شارژ بودند)`;
    Utils.showToast(msg, created ? 'success' : 'warning');

    renderTable();
    Dashboard.refreshStatsIfActive();
  }

  function getFiltered() {
    let list = DB.getCharges();
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(c => {
        const unit = DB.getUnitById(c.unitId);
        return (c.docNo || '').toLowerCase().includes(q) || (unit?.number || '').toLowerCase().includes(q);
      });
    }
    if (unitFilter) list = list.filter(c => c.unitId === unitFilter);
    return list.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  function renderTable() {
    const list = getFiltered();
    const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * pageSize;
    const pageItems = list.slice(start, start + pageSize);
    const tbody = document.getElementById('chargesTableBody');

    tbody.innerHTML = pageItems.map(c => {
      const unit = DB.getUnitById(c.unitId);
      const period = `${Utils.jalaliMonthName(c.jm)} ${Utils.toPersianDigits(c.jy)}`;
      return `
      <tr>
        <td>${Utils.escapeHtml(c.docNo)}</td>
        <td>${Utils.isoToJalaliDisplay(c.date)}</td>
        <td>${Utils.escapeHtml(unit?.number || '-')}</td>
        <td>${period}</td>
        <td class="text-danger fw-bold">${Utils.formatCurrency(c.amount)}</td>
        <td><button class="btn btn-sm btn-outline-danger" onclick="Charges.remove('${c.id}')"><i class="bi bi-trash"></i></button></td>
      </tr>`;
    }).join('') || `<tr><td colspan="6" class="text-center text-muted py-4">سند شارژی ثبت نشده است</td></tr>`;

    const pag = document.getElementById('chargesPagination');
    let pagHtml = `<div class="d-flex justify-content-between align-items-center"><span class="text-muted small">${list.length} سند</span><div class="btn-group">`;
    for (let i = 1; i <= totalPages; i++) {
      pagHtml += `<button class="btn btn-sm ${i === currentPage ? 'btn-primary' : 'btn-outline-primary'}" onclick="Charges.goToPage(${i})">${Utils.formatNumber(i)}</button>`;
    }
    pagHtml += `</div></div>`;
    pag.innerHTML = pagHtml;
  }

  function goToPage(p) { currentPage = p; renderTable(); }

  function remove(id) {
    Swal.fire({
      title: 'حذف سند شارژ',
      text: 'این سند از دفتر معین واحد مربوطه حذف خواهد شد.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'حذف',
      cancelButtonText: 'انصراف',
      confirmButtonColor: '#dc3545'
    }).then(async res => {
      if (res.isConfirmed) {
        await DB.deleteCharge(id);
        Utils.showToast('سند شارژ حذف شد', 'success');
        renderTable();
        Dashboard.refreshStatsIfActive();
      }
    });
  }

  function exportExcel() {
    const table = document.getElementById('chargesTable');
    if (!table) return;
    const wb = XLSX.utils.table_to_book(table, { sheet: 'شارژ ماهانه' });
    XLSX.writeFile(wb, `اسناد-شارژ-${Date.now()}.xlsx`);
  }

  function exportCsv() {
    const table = document.getElementById('chargesTable');
    if (!table) return;
    const wb = XLSX.utils.table_to_book(table, { sheet: 'شارژ ماهانه' });
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets['شارژ ماهانه']);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `اسناد-شارژ-${Date.now()}.csv`;
    link.click();
  }

  return { render, renderTable, goToPage, remove, exportExcel, exportCsv };
})();
