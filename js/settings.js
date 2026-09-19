/**
 * settings.js
 * تنظیمات نرم‌افزار: اطلاعات ساختمان، واحد پول، رنگ، تم و فونت
 */

const Settings = (() => {

  function render() {
    const s = DB.getSettings();
    const cfg = SupabaseConfig.get();
    const container = document.getElementById('page-settings');
    container.innerHTML = `
      <div class="page-header"><h4><svg class="page-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="2.8"/><path d="M12 3v3M12 18v3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M3 12h3M18 12h3M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/></svg> تنظیمات</h4></div>
      <div class="card mb-3">
        <div class="card-body">
          <form id="settingsForm">
            <div class="row g-3">
              <div class="col-md-6"><label class="form-label">نام ساختمان</label>
                <input class="form-control" name="buildingName" value="${Utils.escapeHtml(s.buildingName || '')}"></div>
              <div class="col-md-6"><label class="form-label">مدیر ساختمان</label>
                <input class="form-control" name="manager" value="${Utils.escapeHtml(s.manager || '')}"></div>
              <div class="col-md-6"><label class="form-label">آدرس</label>
                <input class="form-control" name="address" value="${Utils.escapeHtml(s.address || '')}"></div>
              <div class="col-md-6"><label class="form-label">شماره تماس</label>
                <input class="form-control" name="phone" value="${Utils.escapeHtml(s.phone || '')}"></div>
              <div class="col-md-4"><label class="form-label">واحد پول</label>
                <select class="form-select" name="currency">
                  <option value="تومان" ${s.currency === 'تومان' ? 'selected' : ''}>تومان</option>
                  <option value="ریال" ${s.currency === 'ریال' ? 'selected' : ''}>ریال</option>
                </select></div>
              <div class="col-md-4"><label class="form-label">رنگ اصلی</label>
                <input class="form-control form-control-color" type="color" name="primaryColor" value="${s.primaryColor || '#2563eb'}"></div>
              <div class="col-md-4"><label class="form-label">حالت نمایش</label>
                <select class="form-select" name="theme">
                  <option value="light" ${s.theme === 'light' ? 'selected' : ''}>روشن</option>
                  <option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>تیره</option>
                </select></div>
              <div class="col-md-6"><label class="form-label">لوگوی ساختمان</label>
                <input class="form-control" type="file" name="logoFile" accept="image/*">
                ${s.logo ? `<img src="${s.logo}" class="mt-2" style="height:60px;border-radius:8px">` : ''}</div>
            </div>
            <button type="button" class="btn btn-primary mt-4" id="saveSettingsBtn"><i class="bi bi-check-lg"></i> ذخیره تنظیمات</button>
          </form>
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-header"><svg class="page-icon" viewBox="0 0 24 24" style="width:18px;height:18px"><rect x="5" y="10" width="14" height="10" rx="1.6"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg> ورود با نام کاربری و رمز عبور</div>
        <div class="card-body">
          <form id="authForm">
            <div class="form-check form-switch mb-3">
              <input class="form-check-input" type="checkbox" role="switch" id="authEnabledSwitch" ${s.authEnabled ? 'checked' : ''}>
              <label class="form-check-label" for="authEnabledSwitch">فعال‌سازی رمز عبور برای ورود به نرم‌افزار</label>
            </div>
            <div class="row g-3">
              <div class="col-md-6"><label class="form-label">نام کاربری</label>
                <input class="form-control" name="authUsername" value="${Utils.escapeHtml(s.authUsername || '')}"></div>
              <div class="col-md-6"><label class="form-label">مدت زمان عدم فعالیت برای خروج خودکار (دقیقه)</label>
                <input class="form-control" type="number" min="1" name="authTimeoutMinutes" value="${s.authTimeoutMinutes || 15}"></div>
              <div class="col-md-6"><label class="form-label">رمز عبور جدید</label>
                <input class="form-control" type="password" name="authPassword" autocomplete="new-password" placeholder="${s.authPasswordHash ? 'برای تغییر وارد کنید، در غیر این صورت خالی بگذارید' : ''}"></div>
              <div class="col-md-6"><label class="form-label">تکرار رمز عبور جدید</label>
                <input class="form-control" type="password" name="authPasswordConfirm" autocomplete="new-password"></div>
            </div>
            <div class="form-text mt-2">
              توجه: این قفل فقط برای جلوگیری از دسترسی افراد غیرمجاز به رابط کاربری روی همین دستگاه/مرورگر است.
              چون این نرم‌افزار مستقیماً از مرورگر به Supabase وصل می‌شود، برای امنیت کامل داده‌ها روی سرور،
              بعداً باید Supabase Auth و RLS مناسب اضافه شود.
            </div>
            <button type="button" class="btn btn-primary mt-3" id="saveAuthBtn"><i class="bi bi-shield-lock"></i> ذخیره تنظیمات ورود</button>
          </form>
        </div>
      </div>

      <div class="card">
        <div class="card-header">اتصال پایگاه داده (Supabase)</div>
        <div class="card-body">
          <div class="mb-2"><span class="text-muted small">آدرس پروژه متصل:</span>
            <div class="fw-bold" style="direction:ltr;text-align:left">${Utils.escapeHtml(cfg?.url || '-')}</div>
          </div>
          <button class="btn btn-outline-danger btn-sm" id="btnDisconnectSupabase">
            <i class="bi bi-plug"></i> اتصال به پروژه Supabase دیگر
          </button>
        </div>
      </div>
    `;
    document.getElementById('saveSettingsBtn').addEventListener('click', save);
    document.getElementById('saveAuthBtn').addEventListener('click', saveAuth);
    document.getElementById('btnDisconnectSupabase').addEventListener('click', () => {
      Swal.fire({
        title: 'اتصال به پروژه دیگر',
        text: 'می‌توانید آدرس و کلید یک پروژه Supabase دیگر را وارد کنید. توجه: باید جدول‌ها قبلاً روی آن پروژه ساخته شده باشند.',
        icon: 'warning', showCancelButton: true, confirmButtonText: 'ادامه', cancelButtonText: 'انصراف'
      }).then(res => {
        if (res.isConfirmed) {
          App.showSupabaseSetup();
        }
      });
    });
  }

  async function saveAuth() {
    const form = document.getElementById('authForm');
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());
    const current = DB.getSettings();

    const enabled = document.getElementById('authEnabledSwitch').checked;
    const username = Utils.sanitizeInput(data.authUsername || '');
    const timeoutMinutes = parseInt(data.authTimeoutMinutes) || 15;
    const newPassword = data.authPassword || '';
    const confirmPassword = data.authPasswordConfirm || '';

    if (newPassword && newPassword !== confirmPassword) {
      Utils.showToast('رمز عبور و تکرار آن یکسان نیستند', 'error');
      return;
    }

    if (enabled) {
      if (!username) { Utils.showToast('برای فعال‌سازی ورود، نام کاربری الزامی است', 'error'); return; }
      if (!newPassword && !current.authPasswordHash) {
        Utils.showToast('برای فعال‌سازی ورود، تعیین رمز عبور الزامی است', 'error');
        return;
      }
    }

    const patch = { authEnabled: enabled, authUsername: username, authTimeoutMinutes: timeoutMinutes };
    if (newPassword) {
      patch.authPasswordHash = await Utils.sha256Hex(newPassword);
    }

    const success = await DB.saveSettings(patch);
    if (success) {
      Utils.showToast('تنظیمات ورود ذخیره شد', 'success');
      App.renderTopbarActions();
      render();
    }
  }

  async function save() {
    const form = document.getElementById('settingsForm');
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());

    const file = form.querySelector('[name="logoFile"]').files[0];
    if (file) {
      data.logo = await Utils.fileToBase64(file);
    }
    delete data.logoFile;

    ['buildingName', 'manager', 'address', 'phone'].forEach(k => data[k] = Utils.sanitizeInput(data[k]));

    await DB.saveSettings(data);
    Utils.showToast('تنظیمات ذخیره شد', 'success');
    App.applySettings();
  }

  return { render };
})();
