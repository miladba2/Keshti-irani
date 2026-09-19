/**
 * app.js
 * کنترل‌کننده اصلی برنامه: مسیریابی بین صفحات، مدیریت تم، مودال‌ها و راه‌اندازی اولیه
 */

const App = (() => {
  const PAGES = ['dashboard', 'units', 'receipts', 'expenses', 'charges', 'persons', 'ledger', 'reports', 'settings', 'backup'];
  let activeModal = null;
  const AUTH_SESSION_KEY = 'bcm_auth_session';
  let idleCheckInterval = null;
  let currentPageName = 'dashboard';

  async function init() {
    if (!StorageManager.isStorageAvailable()) {
      showStorageWarning();
      return;
    }

    if (!SupabaseConfig.isConfigured()) {
      showSupabaseSetup();
      return;
    }

    // اگر نسخه‌ای از داده‌ها قبلاً در همین مرورگر ذخیره شده، بلافاصله و بدون
    // نمایش صفحه «در حال اتصال»، با همان داده‌ها برنامه را نشان می‌دهیم؛
    // و در پس‌زمینه (بی‌صدا) از Supabase نسخه تازه را می‌گیریم.
    const hasCache = DB.loadCacheFromLocalStorage();

    if (hasCache) {
      proceedAfterDataReady();
      DB.init().then(() => {
        refreshActivePage();
      }).catch(e => {
        console.warn('به‌روزرسانی بی‌صدا از Supabase ناموفق بود', e);
      });
      return;
    }

    showLoadingOverlay();
    try {
      await DB.init();
    } catch (e) {
      console.error(e);
      showSupabaseError(e);
      return;
    }
    hideLoadingOverlay();
    proceedAfterDataReady();
  }

  /** پس از آماده شدن داده‌ها (از کش یا از سرور)، بررسی ورود و سپس نمایش برنامه */
  function proceedAfterDataReady() {
    const s = DB.getSettings();
    if (s.authEnabled && !isAuthSessionValid(s.authTimeoutMinutes)) {
      showLoginScreen();
      return;
    }
    renderAppShell();
  }

  /** بازرندر بی‌صدای صفحه فعلی، پس از رسیدن داده‌های تازه از سرور در پس‌زمینه */
  function refreshActivePage() {
    if (document.getElementById('page-' + currentPageName)) {
      navigate(currentPageName);
    }
    applySettings();
  }

  function renderAppShell() {
    renderShell();
    applySettings();
    bindNav();
    navigate('dashboard');

    document.getElementById('sidebarToggle')?.addEventListener('click', () => {
      document.querySelector('.app-sidebar').classList.toggle('show');
    });

    renderTopbarActions();

    if (DB.getSettings().authEnabled) {
      touchAuthSession();
      startIdleWatcher();
    }
  }

  /* ------------------ ورود با نام کاربری/رمز عبور ------------------ */
  function getAuthSession() {
    try { return JSON.parse(sessionStorage.getItem(AUTH_SESSION_KEY)); } catch (e) { return null; }
  }
  function setAuthSession() {
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ loggedIn: true, lastActivity: Date.now() }));
  }
  function touchAuthSession() {
    const s = getAuthSession();
    if (s) { s.lastActivity = Date.now(); sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(s)); }
  }
  function clearAuthSession() {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
  }
  function isAuthSessionValid(timeoutMinutes) {
    const s = getAuthSession();
    if (!s || !s.loggedIn) return false;
    const elapsedMin = (Date.now() - s.lastActivity) / 60000;
    return elapsedMin < (timeoutMinutes || 15);
  }

  /** نمایش صفحه ورود؛ در صورت موفقیت، صفحه دوباره بارگذاری می‌شود تا برنامه عادی نمایش داده شود */
  function showLoginScreen() {
    const s = DB.getSettings();
    document.body.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;
        font-family:'IRANSansX','Vazirmatn',Tahoma,sans-serif;direction:rtl;background:#f3f5f9;">
        <div style="max-width:380px;width:100%;background:#fff;border-radius:16px;padding:32px;box-shadow:0 4px 24px rgba(0,0,0,.08)">
          <div style="text-align:center;margin-bottom:18px">
            ${s.logo ? `<img src="${s.logo}" style="height:56px;border-radius:10px">` : ''}
            <h5 style="margin-top:12px">${Utils.escapeHtml(s.buildingName || 'ورود به نرم‌افزار')}</h5>
          </div>
          <div class="mb-2">
            <label style="font-size:13px;font-weight:600;color:#555">نام کاربری</label>
            <input id="loginUser" type="text" autocomplete="username"
              style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;margin-top:4px">
          </div>
          <div class="mb-3">
            <label style="font-size:13px;font-weight:600;color:#555">رمز عبور</label>
            <input id="loginPass" type="password" autocomplete="current-password"
              style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;margin-top:4px">
          </div>
          <button id="loginBtn" style="width:100%;padding:12px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer">
            ورود
          </button>
          <div id="loginMsg" style="color:#dc2626;font-size:13px;margin-top:10px;text-align:center"></div>
        </div>
      </div>`;

    const attemptLogin = async () => {
      const u = document.getElementById('loginUser').value.trim();
      const p = document.getElementById('loginPass').value;
      const msg = document.getElementById('loginMsg');
      if (!u || !p) { msg.textContent = 'نام کاربری و رمز عبور را وارد کنید'; return; }
      const hash = await Utils.sha256Hex(p);
      const settings = DB.getSettings();
      if (u === settings.authUsername && hash === settings.authPasswordHash) {
        setAuthSession();
        location.reload();
      } else {
        msg.textContent = 'نام کاربری یا رمز عبور اشتباه است';
      }
    };
    document.getElementById('loginBtn').addEventListener('click', attemptLogin);
    document.getElementById('loginPass').addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptLogin(); });
  }

  /** خروج از نرم‌افزار: نشست ورود پاک شده و صفحه دوباره بارگذاری می‌شود */
  function logout() {
    clearAuthSession();
    if (idleCheckInterval) clearInterval(idleCheckInterval);
    location.reload();
  }

  /** رصد فعالیت کاربر و خروج خودکار پس از مدت مشخصی بی‌فعالیتی */
  function startIdleWatcher() {
    const activityHandler = Utils.debounce(() => touchAuthSession(), 1000);
    ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach(ev => {
      document.addEventListener(ev, activityHandler);
    });
    if (idleCheckInterval) clearInterval(idleCheckInterval);
    idleCheckInterval = setInterval(() => {
      const s = DB.getSettings();
      if (s.authEnabled && !isAuthSessionValid(s.authTimeoutMinutes)) {
        logout();
      }
    }, 15000);
  }

  /** نمایش دکمه خروج در نوار بالا، فقط وقتی ورود با رمز عبور فعال باشد */
  function renderTopbarActions() {
    const el = document.getElementById('topbarActions');
    if (!el) return;
    if (DB.getSettings().authEnabled) {
      el.innerHTML = `
        <button class="btn btn-sm btn-outline-danger" id="logoutBtn" title="خروج از نرم‌افزار">
          <svg style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;vertical-align:-3px" viewBox="0 0 24 24">
            <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>
          </svg>
          خروج
        </button>`;
      document.getElementById('logoutBtn').addEventListener('click', () => {
        Swal.fire({
          title: 'خروج از نرم‌افزار', text: 'آیا می‌خواهید از نرم‌افزار خارج شوید؟', icon: 'question',
          showCancelButton: true, confirmButtonText: 'خروج', cancelButtonText: 'انصراف'
        }).then(res => { if (res.isConfirmed) logout(); });
      });
    } else {
      el.innerHTML = '';
    }
  }

  /** پیام راهنما وقتی مرورگر اجازه ذخیره‌سازی محلی نمی‌دهد */
  function showStorageWarning() {
    document.body.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;
        font-family:Tahoma,sans-serif;direction:rtl;background:#f3f5f9;">
        <div style="max-width:480px;background:#fff;border-radius:16px;padding:32px;box-shadow:0 4px 24px rgba(0,0,0,.08);text-align:center">
          <div style="font-size:40px;margin-bottom:12px">⚠️</div>
          <h4 style="margin-bottom:14px;color:#dc2626">امکان ذخیره‌سازی اطلاعات وجود ندارد</h4>
          <p style="color:#555;font-size:14.5px;line-height:2">
            مرورگر شما اجازه استفاده از حافظه محلی (LocalStorage) را در این حالت نمی‌دهد.
            این معمولاً زمانی رخ می‌دهد که فایل به‌صورت مستقیم (بدون میزبانی روی وب) یا در حالت
            مرور خصوصی (Private Browsing) در سافاری باز شده باشد.
          </p>
          <p style="color:#555;font-size:14.5px;line-height:2">
            برای رفع این مشکل:<br>
            ۱. حالت مرور خصوصی سافاری را خاموش کنید، یا<br>
            ۲. فایل را روی <b>GitHub Pages</b> یا هر هاست دیگری قرار دهید و از طریق آدرس
            <b>https://</b> آن را باز کنید (نه به‌صورت فایل محلی).
          </p>
        </div>
      </div>`;
  }

  /** فرم اتصال اولیه به Supabase (فقط یک‌بار، تا وقتی اطلاعات اتصال ذخیره شود) */
  function showSupabaseSetup() {
    document.body.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;
        font-family:'IRANSansX','Vazirmatn',Tahoma,sans-serif;direction:rtl;background:#f3f5f9;">
        <div style="max-width:480px;width:100%;background:#fff;border-radius:16px;padding:32px;box-shadow:0 4px 24px rgba(0,0,0,.08)">
          <div style="text-align:center;font-size:34px;margin-bottom:10px">🔗</div>
          <h4 style="text-align:center;margin-bottom:18px">اتصال به پایگاه داده Supabase</h4>
          <p style="color:#666;font-size:13.5px;line-height:2;margin-bottom:18px">
            این نرم‌افزار داده‌هایش را روی Supabase شما ذخیره می‌کند. آدرس پروژه (Project URL) و
            کلید عمومی (anon public key) را از داشبورد Supabase → Project Settings → API کپی کرده
            و اینجا وارد کنید.
          </p>
          <div class="mb-2">
            <label style="font-size:13px;font-weight:600;color:#555">Project URL</label>
            <input id="sbUrl" type="text" placeholder="https://xxxx.supabase.co"
              style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;margin-top:4px;direction:ltr;text-align:left">
          </div>
          <div class="mb-3">
            <label style="font-size:13px;font-weight:600;color:#555">anon public key</label>
            <textarea id="sbKey" rows="3" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;margin-top:4px;direction:ltr;text-align:left;font-size:12px"></textarea>
          </div>
          <button id="sbConnectBtn" style="width:100%;padding:12px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer">
            اتصال و شروع
          </button>
          <div id="sbSetupMsg" style="color:#dc2626;font-size:13px;margin-top:10px;text-align:center"></div>
          <p style="color:#999;font-size:12px;margin-top:16px;line-height:1.9">
            پیش‌نیاز: جدول‌های پایگاه داده باید قبلاً با اسکریپت SQL روی همین پروژه Supabase ساخته شده باشند.
          </p>
        </div>
      </div>`;

    document.getElementById('sbConnectBtn').addEventListener('click', async () => {
      const url = document.getElementById('sbUrl').value.trim();
      const key = document.getElementById('sbKey').value.trim();
      const msg = document.getElementById('sbSetupMsg');
      if (!url || !key) { msg.textContent = 'هر دو فیلد الزامی است'; return; }
      if (!/^https:\/\/.+\.supabase\.co/.test(url)) { msg.textContent = 'آدرس Project URL معتبر به نظر نمی‌رسد'; return; }
      SupabaseConfig.save(url, key);
      location.reload();
    });
  }

  function showSupabaseError(err) {
    document.body.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;
        font-family:'IRANSansX','Vazirmatn',Tahoma,sans-serif;direction:rtl;background:#f3f5f9;">
        <div style="max-width:480px;background:#fff;border-radius:16px;padding:32px;box-shadow:0 4px 24px rgba(0,0,0,.08);text-align:center">
          <div style="font-size:40px;margin-bottom:12px">⚠️</div>
          <h4 style="margin-bottom:14px;color:#dc2626">اتصال به Supabase ناموفق بود</h4>
          <p style="color:#555;font-size:13.5px;line-height:2;direction:ltr;text-align:left;background:#f7f7f7;padding:10px;border-radius:8px">
            ${Utils.escapeHtml(err?.message || String(err))}
          </p>
          <p style="color:#555;font-size:13.5px;line-height:2;margin-top:14px">
            آدرس و کلید را بررسی کنید، یا مطمئن شوید جدول‌ها با اسکریپت SQL ساخته شده‌اند.
          </p>
          <button id="sbResetBtn" style="margin-top:10px;padding:10px 20px;background:#dc2626;color:#fff;border:none;border-radius:8px;cursor:pointer">
            وارد کردن مجدد اطلاعات اتصال
          </button>
        </div>
      </div>`;
    document.getElementById('sbResetBtn').addEventListener('click', () => {
      SupabaseConfig.clear();
      location.reload();
    });
  }

  function showLoadingOverlay() {
    const el = document.createElement('div');
    el.id = 'appLoadingOverlay';
    el.style.cssText = 'position:fixed;inset:0;background:#f3f5f9;display:flex;align-items:center;justify-content:center;z-index:9999;flex-direction:column;gap:14px;font-family:Tahoma,sans-serif';
    el.innerHTML = `
      <div style="width:42px;height:42px;border:4px solid #dbe3f5;border-top-color:#2563eb;border-radius:50%;animation:spin 0.8s linear infinite"></div>
      <div style="color:#555;font-size:14px">در حال اتصال به پایگاه داده...</div>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;
    document.body.appendChild(el);
  }

  function hideLoadingOverlay() {
    document.getElementById('appLoadingOverlay')?.remove();
  }

  function renderShell() {
    document.getElementById('appVersion') && (document.getElementById('appVersion').textContent = 'نسخه ۱.۰');
  }

  function bindNav() {
    document.querySelectorAll('.nav-link[data-page]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(link.dataset.page);
        document.querySelector('.app-sidebar').classList.remove('show');
      });
    });
  }

  function navigate(page) {
    if (!PAGES.includes(page)) page = 'dashboard';
    currentPageName = page;
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + page)?.classList.add('active');
    document.querySelectorAll('.nav-link[data-page]').forEach(l => l.classList.toggle('active', l.dataset.page === page));

    const titleMap = {
      dashboard: 'داشبورد', units: 'مدیریت واحدها', receipts: 'دریافت‌ها', expenses: 'هزینه‌ها',
      charges: 'شارژ ماهانه', persons: 'اشخاص', ledger: 'دفتر معین', reports: 'گزارشات', settings: 'تنظیمات', backup: 'پشتیبان‌گیری'
    };
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.textContent = titleMap[page] || '';

    switch (page) {
      case 'dashboard': Dashboard.render(); break;
      case 'units': Units.render(); break;
      case 'receipts': Receipts.render(); break;
      case 'expenses': Expenses.render(); break;
      case 'charges': Charges.render(); break;
      case 'persons': Persons.render(); break;
      case 'ledger': Ledger.render(); break;
      case 'reports': Reports.render(); break;
      case 'settings': Settings.render(); break;
      case 'backup': Backup.render(); break;
    }
  }

  /* ------------------ مودال‌ها (Bootstrap) ------------------ */
  function mountModal(html, id) {
    closeModal(id);
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    document.getElementById('modalRoot').appendChild(wrapper.firstElementChild);
    const modalEl = document.getElementById(id);
    activeModal = new bootstrap.Modal(modalEl);
    modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove());
    activeModal.show();
  }

  function closeModal(id) {
    const existing = document.getElementById(id);
    if (existing) {
      const inst = bootstrap.Modal.getInstance(existing);
      if (inst) inst.hide();
      existing.remove();
    }
  }

  /* ------------------ تم و تنظیمات ظاهری ------------------ */
  function applySettings() {
    const s = DB.getSettings();
    document.documentElement.style.setProperty('--primary-color', s.primaryColor || '#2563eb');
    document.getElementById('sidebarBuildingName') && (document.getElementById('sidebarBuildingName').textContent = s.buildingName || 'ساختمان نمونه');
    const logoEl = document.getElementById('sidebarLogo');
    if (logoEl) {
      if (s.logo) { logoEl.src = s.logo; logoEl.style.display = 'inline-block'; }
      else logoEl.style.display = 'none';
    }
    setTheme(s.theme || DB.getTheme() || 'light');
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    DB.setTheme(theme);
    const icon = document.getElementById('themeIcon');
    if (icon) icon.className = theme === 'dark' ? 'bi bi-sun' : 'bi bi-moon-stars';
  }

  async function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    setTheme(next);
    await DB.saveSettings({ theme: next });
  }

  return { init, navigate, mountModal, closeModal, applySettings, toggleTheme, showSupabaseSetup, logout, renderTopbarActions };
})();

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
