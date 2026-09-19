/**
 * units.js
 * مدیریت واحدها: ثبت، ویرایش، حذف، جستجو، فیلتر، صفحه‌بندی
 */

const Units = (() => {
  let currentPage = 1;
  const pageSize = 8;
  let searchTerm = '';
  let statusFilter = '';

  function render() {
    const container = document.getElementById('page-units');
    container.innerHTML = `
      <div class="page-header">
        <h4><svg class="page-icon" viewBox="0 0 24 24"><rect x="4.5" y="3.5" width="15" height="17" rx="1.2"/><line x1="8" y1="7.5" x2="8" y2="7.5"/><line x1="12" y1="7.5" x2="12" y2="7.5"/><line x1="16" y1="7.5" x2="16" y2="7.5"/><line x1="8" y1="11.5" x2="8" y2="11.5"/><line x1="12" y1="11.5" x2="12" y2="11.5"/><line x1="16" y1="11.5" x2="16" y2="11.5"/><path d="M10 20.5v-4.5h4v4.5"/></svg> مدیریت واحدها</h4>
        <button class="btn btn-primary" id="btnAddUnit"><i class="bi bi-plus-lg"></i> واحد جدید</button>
      </div>
      <div class="card mb-3">
        <div class="card-body d-flex flex-wrap gap-2">
          <input type="text" class="form-control" style="max-width:260px" id="unitSearch" placeholder="جستجو (شماره، مستاجر، مالک، بلوک...)">
          <select class="form-select" style="max-width:180px" id="unitStatusFilter">
            <option value="">همه وضعیت‌ها</option>
            <option value="active">فعال</option>
            <option value="inactive">غیرفعال</option>
          </select>
        </div>
      </div>
      <div class="card">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead><tr>
              <th>کد</th><th>واحد</th><th>طبقه</th><th>بلوک</th><th>مستاجر</th><th>مالک</th>
              <th>تماس</th><th>متراژ</th><th>سهم شارژ</th><th>وضعیت</th><th>عملیات</th>
            </tr></thead>
            <tbody id="unitsTableBody"></tbody>
          </table>
        </div>
        <div class="card-footer" id="unitsPagination"></div>
      </div>
    `;

    document.getElementById('btnAddUnit').addEventListener('click', () => openUnitModal());
    document.getElementById('unitSearch').addEventListener('input', Utils.debounce((e) => {
      searchTerm = e.target.value.trim();
      currentPage = 1;
      renderTable();
    }, 250));
    document.getElementById('unitStatusFilter').addEventListener('change', (e) => {
      statusFilter = e.target.value;
      currentPage = 1;
      renderTable();
    });

    renderTable();
  }

  function getFiltered() {
    let list = DB.getUnits();
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(u =>
        (u.code || '').toLowerCase().includes(q) ||
        (u.number || '').toLowerCase().includes(q) ||
        (u.owner || '').toLowerCase().includes(q) ||
        (u.tenant || '').toLowerCase().includes(q) ||
        (u.block || '').toLowerCase().includes(q) ||
        (u.phone || '').toLowerCase().includes(q)
      );
    }
    if (statusFilter) list = list.filter(u => (u.status || 'active') === statusFilter);
    return list;
  }

  function renderTable() {
    const list = getFiltered();
    const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * pageSize;
    const pageItems = list.slice(start, start + pageSize);
    const tbody = document.getElementById('unitsTableBody');

    tbody.innerHTML = pageItems.map(u => {
      const balance = Ledger.getUnitBalance(u.id);
      const balanceBadge = balance > 0
        ? `<span class="badge bg-danger-subtle text-danger">بدهکار ${Utils.formatCurrency(Math.abs(balance))}</span>`
        : balance < 0
          ? `<span class="badge bg-success-subtle text-success">بستانکار ${Utils.formatCurrency(Math.abs(balance))}</span>`
          : `<span class="badge bg-secondary-subtle text-secondary">تسویه</span>`;
      return `
      <tr>
        <td>${Utils.escapeHtml(u.code || '-')}</td>
        <td>${Utils.escapeHtml(u.number)}</td>
        <td>${Utils.escapeHtml(u.floor || '-')}</td>
        <td>${Utils.escapeHtml(u.block || '-')}</td>
        <td>${Utils.escapeHtml(u.tenant || '-')}</td>
        <td>${Utils.escapeHtml(u.owner || '-')}</td>
        <td>${Utils.escapeHtml(u.phone || '-')}</td>
        <td>${u.area ? Utils.toPersianDigits(u.area) : '-'}</td>
        <td>${Utils.formatNumber(u.chargeShare)}</td>
        <td>${(u.status === 'inactive') ? '<span class="badge bg-secondary">غیرفعال</span>' : '<span class="badge bg-success">فعال</span>'}<br>${balanceBadge}</td>
        <td class="text-nowrap">
          <button class="btn btn-sm btn-outline-primary" onclick="Units.edit('${u.id}')"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger" onclick="Units.remove('${u.id}')"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`;
    }).join('') || `<tr><td colspan="11" class="text-center text-muted py-4">واحدی یافت نشد</td></tr>`;

    const pag = document.getElementById('unitsPagination');
    let pagHtml = `<div class="d-flex justify-content-between align-items-center"><span class="text-muted small">${list.length} واحد</span><div class="btn-group">`;
    for (let i = 1; i <= totalPages; i++) {
      pagHtml += `<button class="btn btn-sm ${i === currentPage ? 'btn-primary' : 'btn-outline-primary'}" onclick="Units.goToPage(${i})">${Utils.formatNumber(i)}</button>`;
    }
    pagHtml += `</div></div>`;
    pag.innerHTML = pagHtml;
  }

  function goToPage(p) { currentPage = p; renderTable(); }

  function openUnitModal(unit = null) {
    const isEdit = !!unit;
    const modalHtml = `
      <div class="modal fade" id="unitModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">${isEdit ? 'ویرایش واحد' : 'ثبت واحد جدید'}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="unitForm" novalidate>
                <div class="row g-3">
                  <div class="col-md-4"><label class="form-label">کد واحد</label>
                    <input class="form-control persian-digit-input" name="code" value="${Utils.escapeHtml(unit?.code || '')}"></div>
                  <div class="col-md-4"><label class="form-label">شماره واحد *</label>
                    <input class="form-control persian-digit-input" name="number" required value="${Utils.escapeHtml(unit?.number || '')}"></div>
                  <div class="col-md-4"><label class="form-label">طبقه</label>
                    <input class="form-control persian-digit-input" name="floor" value="${Utils.escapeHtml(unit?.floor || '')}"></div>
                  <div class="col-md-4"><label class="form-label">بلوک</label>
                    <input class="form-control persian-digit-input" name="block" value="${Utils.escapeHtml(unit?.block || '')}"></div>
                  <div class="col-md-4"><label class="form-label">مستاجر</label>
                    <input class="form-control" name="tenant" value="${Utils.escapeHtml(unit?.tenant || '')}"></div>
                  <div class="col-md-4"><label class="form-label">مالک</label>
                    <input class="form-control" name="owner" value="${Utils.escapeHtml(unit?.owner || '')}"></div>
                  <div class="col-md-4"><label class="form-label">شماره تماس</label>
                    <input class="form-control persian-digit-input" name="phone" value="${Utils.escapeHtml(unit?.phone || '')}"></div>
                  <div class="col-md-4"><label class="form-label">متراژ (متر مربع)</label>
                    <input class="form-control persian-digit-input" inputmode="decimal" name="area" value="${Utils.escapeHtml(unit?.area || '')}"></div>
                  <div class="col-md-4"><label class="form-label">سهم شارژ (ماهانه) *</label>
                    <input class="form-control money-input" name="chargeShare" required value="${unit?.chargeShare ?? ''}"></div>
                  <div class="col-md-4"><label class="form-label">بدهی اولیه (مانده ابتدای دوره)</label>
                    <input class="form-control money-input" name="initialDebt" value="${unit?.initialDebt ?? ''}">
                    <div class="form-text">در صورت داشتن بدهی قبلی، مبلغ را وارد کنید؛ با ثبت هر دریافت از این مبلغ کسر می‌شود.</div></div>
                  <div class="col-md-6"><label class="form-label">وضعیت</label>
                    <select class="form-select" name="status">
                      <option value="active" ${unit?.status !== 'inactive' ? 'selected' : ''}>فعال</option>
                      <option value="inactive" ${unit?.status === 'inactive' ? 'selected' : ''}>غیرفعال</option>
                    </select></div>
                  <div class="col-12"><label class="form-label">توضیحات</label>
                    <textarea class="form-control" name="description" rows="2">${Utils.escapeHtml(unit?.description || '')}</textarea></div>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" data-bs-dismiss="modal">انصراف</button>
              <button class="btn btn-primary" id="saveUnitBtn">ذخیره</button>
            </div>
          </div>
        </div>
      </div>`;
    App.mountModal(modalHtml, 'unitModal');
    Utils.bindAllMoneyInputs(document.getElementById('unitModal'));
    Utils.bindAllPersianDigitInputs(document.getElementById('unitModal'));
    document.getElementById('saveUnitBtn').addEventListener('click', () => saveUnit(unit?.id));
  }

  async function saveUnit(id) {
    const form = document.getElementById('unitForm');
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());

    if (!Utils.validateRequired(data.number)) { Utils.showToast('شماره واحد الزامی است', 'error'); return; }
    if (!Utils.validateRequired(data.chargeShare)) { Utils.showToast('سهم شارژ الزامی است', 'error'); return; }
    if (data.phone && !Utils.validatePhone(data.phone)) { Utils.showToast('شماره تماس معتبر نیست', 'error'); return; }

    data.chargeShare = Utils.parseMoneyValue(data.chargeShare);
    data.initialDebt = Utils.parseMoneyValue(data.initialDebt);
    data.area = data.area ? parseFloat(Utils.toEnglishDigits(data.area)) || null : null;

    Object.keys(data).forEach(k => { if (typeof data[k] === 'string') data[k] = Utils.sanitizeInput(data[k]); });

    const success = id ? await DB.updateUnit(id, data) : await DB.addUnit(data);

    if (success) {
      Utils.showToast(id ? 'واحد با موفقیت ویرایش شد' : 'واحد جدید ثبت شد', 'success');
      App.closeModal('unitModal');
      render();
      Dashboard.refreshStatsIfActive();
    }
  }

  function edit(id) {
    const unit = DB.getUnitById(id);
    if (unit) openUnitModal(unit);
  }

  function remove(id) {
    Swal.fire({
      title: 'حذف واحد',
      text: 'آیا از حذف این واحد اطمینان دارید؟ این عملیات قابل بازگشت نیست.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'بله، حذف شود',
      cancelButtonText: 'انصراف',
      confirmButtonColor: '#dc3545'
    }).then(async res => {
      if (res.isConfirmed) {
        await DB.deleteUnit(id);
        Utils.showToast('واحد حذف شد', 'success');
        renderTable();
        Dashboard.refreshStatsIfActive();
      }
    });
  }

  return { render, renderTable, goToPage, edit, remove, openUnitModal };
})();
