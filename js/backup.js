/**
 * backup.js
 * پشتیبان‌گیری کامل و بازیابی اطلاعات از/به Supabase
 */

const Backup = (() => {

  function render() {
    const container = document.getElementById('page-backup');
    container.innerHTML = `
      <div class="page-header"><h4><svg class="page-icon" viewBox="0 0 24 24"><path d="M7.2 17.8a4 4 0 0 1-.9-7.9 5 5 0 0 1 9.6-2.1A4.4 4.4 0 0 1 16.8 16"/><path d="M12 11.5v7"/><path d="M9 15.5l3 3 3-3"/></svg> پشتیبان‌گیری</h4></div>
      <div class="row g-3">
        <div class="col-md-6">
          <div class="card h-100">
            <div class="card-body text-center">
              <i class="bi bi-download display-4 text-primary"></i>
              <h5 class="mt-3">تهیه فایل پشتیبان</h5>
              <p class="text-muted">خروجی کامل اطلاعات (از Supabase) به صورت فایل JSON دانلود می‌شود.</p>
              <button class="btn btn-primary" id="btnExportBackup"><i class="bi bi-download"></i> دانلود پشتیبان</button>
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="card h-100">
            <div class="card-body text-center">
              <i class="bi bi-upload display-4 text-success"></i>
              <h5 class="mt-3">بازیابی اطلاعات</h5>
              <p class="text-muted">فایل پشتیبان قبلی را انتخاب کنید. تمام داده‌های فعلی روی Supabase جایگزین خواهد شد.</p>
              <input type="file" class="form-control mb-2" id="importBackupFile" accept="application/json">
              <button class="btn btn-success" id="btnImportBackup"><i class="bi bi-upload"></i> بازیابی</button>
            </div>
          </div>
        </div>
        <div class="col-12">
          <div class="card border-danger">
            <div class="card-body text-center">
              <h5 class="text-danger">پاک کردن کامل اطلاعات</h5>
              <p class="text-muted">تمام داده‌های ذخیره‌شده روی Supabase حذف می‌شوند (تنظیمات باقی می‌ماند).</p>
              <button class="btn btn-outline-danger" id="btnClearAll"><i class="bi bi-trash"></i> پاک‌سازی کامل</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btnExportBackup').addEventListener('click', exportBackup);
    document.getElementById('btnImportBackup').addEventListener('click', importBackup);
    document.getElementById('btnClearAll').addEventListener('click', clearAll);
  }

  function exportBackup() {
    const json = DB.exportBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const today = Utils.isoToJalaliDisplay(new Date().toISOString()).replace(/\//g, '-');
    link.download = `backup-charge-${today}.json`;
    link.click();
    Utils.showToast('فایل پشتیبان با موفقیت دانلود شد', 'success');
  }

  function importBackup() {
    const fileInput = document.getElementById('importBackupFile');
    const file = fileInput.files[0];
    if (!file) { Utils.showToast('لطفاً یک فایل انتخاب کنید', 'warning'); return; }

    Swal.fire({
      title: 'بازیابی اطلاعات',
      text: 'با ادامه، تمام اطلاعات فعلی روی Supabase جایگزین خواهد شد. آیا مطمئن هستید؟',
      icon: 'warning', showCancelButton: true, confirmButtonText: 'بله، بازیابی شود', cancelButtonText: 'انصراف'
    }).then(res => {
      if (!res.isConfirmed) return;
      const reader = new FileReader();
      reader.onload = async () => {
        Utils.showToast('در حال بازیابی... کمی صبر کنید', 'info');
        const success = await DB.importBackup(reader.result);
        if (success) {
          Utils.showToast('اطلاعات با موفقیت بازیابی شد', 'success');
          App.applySettings();
          App.navigate('dashboard');
        } else {
          Utils.showToast('فایل پشتیبان نامعتبر است یا خطایی رخ داد', 'error');
        }
      };
      reader.readAsText(file);
    });
  }

  function clearAll() {
    Swal.fire({
      title: 'پاک‌سازی کامل', text: 'این عملیات تمام اطلاعات روی Supabase را برای همیشه حذف می‌کند.', icon: 'error',
      showCancelButton: true, confirmButtonText: 'بله، پاک شود', cancelButtonText: 'انصراف', confirmButtonColor: '#dc3545'
    }).then(async res => {
      if (res.isConfirmed) {
        await DB.clearAll();
        Utils.showToast('تمام اطلاعات پاک شد', 'success');
        App.applySettings();
        App.navigate('dashboard');
      }
    });
  }

  return { render };
})();
