/**
 * persons.js
 * مدیریت اشخاص (پیمانکاران، تامین‌کنندگان، پرسنل و ...) که هزینه‌ها ممکن است به آن‌ها پرداخت شود.
 * تعریف اشخاص در اینجا امکان می‌دهد در گزارشات، مجموع پرداخت‌های انجام‌شده به هر شخص استخراج شود.
 */

const Persons = (() => {
  let currentPage = 1;
  const pageSize = 8;
  let searchTerm = '';
  let typeFilter = '';

  const TYPES = ['پیمانکار', 'تامین‌کننده', 'پرسنل', 'سایر'];

  function render() {
    const container = document.getElementById('page-persons');
    container.innerHTML = `
      <div class="page-header">
        <h4><svg class="page-icon" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.3"/><path d="M5 20c1.4-4.2 4.8-6 7-6s5.6 1.8 7 6"/></svg> اشخاص</h4>
        <button class="btn btn-primary" id="btnAddPerson"><i class="bi bi-plus-lg"></i> شخص جدید</button>
      </div>
      <div class="card mb-3">
        <div class="card-body d-flex flex-wrap gap-2">
          <input type="text" class="form-control" style="max-width:260px" id="personSearch" placeholder="جستجو (نام، تلفن...)">
          <select class="form-select" style="max-width:200px" id="personTypeFilter">
            <option value="">همه انواع</option>
            ${TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="card">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead><tr>
              <th>نام</th><th>نوع</th><th>شماره تماس</th><th>کد ملی/اقتصادی</th><th>مجموع پرداختی</th><th>وضعیت</th><th>عملیات</th>
            </tr></thead>
            <tbody id="personsTableBody"></tbody>
          </table>
        </div>
        <div class="card-footer" id="personsPagination"></div>
      </div>
    `;

    document.getElementById('btnAddPerson').addEventListener('click', () => openModal());
    document.getElementById('personSearch').addEventListener('input', Utils.debounce(e => {
      searchTerm = e.target.value.trim(); currentPage = 1; renderTable();
    }, 250));
    document.getElementById('personTypeFilter').addEventListener('change', e => {
      typeFilter = e.target.value; currentPage = 1; renderTable();
    });

    renderTable();
  }

  /** مجموع مبالغ هزینه‌های پرداخت‌شده به یک شخص خاص (بر اساس personId) */
  function getTotalPaidToPerson(personId) {
    return DB.getExpenses()
      .filter(e => e.personId === personId)
      .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  }

  function getFiltered() {
    let list = DB.getPersons();
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.phone || '').toLowerCase().includes(q) ||
        (p.nationalId || '').toLowerCase().includes(q)
      );
    }
    if (typeFilter) list = list.filter(p => p.type === typeFilter);
    return list;
  }

  function renderTable() {
    const list = getFiltered();
    const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * pageSize;
    const pageItems = list.slice(start, start + pageSize);
    const tbody = document.getElementById('personsTableBody');

    tbody.innerHTML = pageItems.map(p => {
      const total = getTotalPaidToPerson(p.id);
      return `
      <tr>
        <td>${Utils.escapeHtml(p.name)}</td>
        <td>${Utils.escapeHtml(p.type || '-')}</td>
        <td>${Utils.escapeHtml(p.phone || '-')}</td>
        <td>${Utils.escapeHtml(p.nationalId || '-')}</td>
        <td class="fw-bold">${Utils.formatCurrency(total)}</td>
        <td>${p.status === 'inactive' ? '<span class="badge bg-secondary">غیرفعال</span>' : '<span class="badge bg-success">فعال</span>'}</td>
        <td class="text-nowrap">
          <button class="btn btn-sm btn-outline-primary" onclick="Persons.edit('${p.id}')"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger" onclick="Persons.remove('${p.id}')"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`;
    }).join('') || `<tr><td colspan="7" class="text-center text-muted py-4">شخصی ثبت نشده است</td></tr>`;

    const pag = document.getElementById('personsPagination');
    let pagHtml = `<div class="d-flex justify-content-between align-items-center"><span class="text-muted small">${list.length} شخص</span><div class="btn-group">`;
    for (let i = 1; i <= totalPages; i++) {
      pagHtml += `<button class="btn btn-sm ${i === currentPage ? 'btn-primary' : 'btn-outline-primary'}" onclick="Persons.goToPage(${i})">${Utils.formatNumber(i)}</button>`;
    }
    pagHtml += `</div></div>`;
    pag.innerHTML = pagHtml;
  }

  function goToPage(p) { currentPage = p; renderTable(); }

  function openModal(person = null) {
    const isEdit = !!person;
    const modalHtml = `
      <div class="modal fade" id="personModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">${isEdit ? 'ویرایش شخص' : 'ثبت شخص جدید'}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="personForm">
                <div class="row g-3">
                  <div class="col-md-6"><label class="form-label">نام *</label>
                    <input class="form-control" name="name" required value="${Utils.escapeHtml(person?.name || '')}"></div>
                  <div class="col-md-6"><label class="form-label">نوع</label>
                    <select class="form-select" name="type">
                      ${TYPES.map(t => `<option ${person?.type === t ? 'selected' : ''}>${t}</option>`).join('')}
                    </select></div>
                  <div class="col-md-6"><label class="form-label">شماره تماس</label>
                    <input class="form-control" name="phone" value="${Utils.escapeHtml(person?.phone || '')}"></div>
                  <div class="col-md-6"><label class="form-label">کد ملی / کد اقتصادی</label>
                    <input class="form-control" name="nationalId" value="${Utils.escapeHtml(person?.nationalId || '')}"></div>
                  <div class="col-md-6"><label class="form-label">وضعیت</label>
                    <select class="form-select" name="status">
                      <option value="active" ${person?.status !== 'inactive' ? 'selected' : ''}>فعال</option>
                      <option value="inactive" ${person?.status === 'inactive' ? 'selected' : ''}>غیرفعال</option>
                    </select></div>
                  <div class="col-12"><label class="form-label">توضیحات</label>
                    <textarea class="form-control" name="description" rows="2">${Utils.escapeHtml(person?.description || '')}</textarea></div>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" data-bs-dismiss="modal">انصراف</button>
              <button class="btn btn-primary" id="savePersonBtn">ذخیره</button>
            </div>
          </div>
        </div>
      </div>`;
    App.mountModal(modalHtml, 'personModal');
    document.getElementById('savePersonBtn').addEventListener('click', () => save(person?.id));
  }

  async function save(id) {
    const form = document.getElementById('personForm');
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());

    if (!Utils.validateRequired(data.name)) { Utils.showToast('نام شخص الزامی است', 'error'); return; }
    if (data.phone && !Utils.validatePhone(data.phone)) { Utils.showToast('شماره تماس معتبر نیست', 'error'); return; }

    Object.keys(data).forEach(k => data[k] = Utils.sanitizeInput(data[k]));

    const success = id ? await DB.updatePerson(id, data) : await DB.addPerson(data);
    if (success) {
      Utils.showToast(id ? 'شخص ویرایش شد' : 'شخص جدید ثبت شد', 'success');
      App.closeModal('personModal');
      render();
    }
  }

  function edit(id) {
    const person = DB.getPersonById(id);
    if (person) openModal(person);
  }

  function remove(id) {
    const paid = getTotalPaidToPerson(id);
    Swal.fire({
      title: 'حذف شخص',
      text: paid > 0
        ? `این شخص دارای سوابق پرداختی است (${Utils.formatCurrency(paid)}). با حذف شخص، اسناد هزینه ثبت‌شده حذف نمی‌شوند اما ارتباط آن‌ها با این شخص از بین می‌رود. ادامه می‌دهید؟`
        : 'آیا از حذف این شخص اطمینان دارید؟',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'بله، حذف شود',
      cancelButtonText: 'انصراف',
      confirmButtonColor: '#dc3545'
    }).then(async res => {
      if (res.isConfirmed) {
        await DB.deletePerson(id);
        Utils.showToast('شخص حذف شد', 'success');
        renderTable();
      }
    });
  }

  return { render, renderTable, goToPage, edit, remove, openModal, getTotalPaidToPerson, TYPES };
})();
