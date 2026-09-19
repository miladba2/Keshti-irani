/**
 * utils.js
 * توابع کمکی عمومی: تبدیل تاریخ جلالی، فرمت اعداد، اعتبارسنجی، نوتیفیکیشن و امنیت
 */

const Utils = (() => {

  /* ---------------------------------------------------------
   * تبدیل تاریخ میلادی <-> جلالی (الگوریتم استاندارد بدون نیاز به کتابخانه خارجی)
   * --------------------------------------------------------- */
  function div(a, b) { return ~~(a / b); }

  function gregorianToJalali(gy, gm, gd) {
    const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let jy = (gy <= 1600) ? 0 : 979;
    gy -= (gy <= 1600) ? 621 : 1600;
    const gy2 = (gm > 2) ? (gy + 1) : gy;
    let days = (365 * gy) + div(gy2 + 3, 4) - div(gy2 + 99, 100) + div(gy2 + 399, 400) - 80 + gd + g_d_m[gm - 1];
    jy += 33 * div(days, 12053);
    days %= 12053;
    jy += 4 * div(days, 1461);
    days %= 1461;
    if (days > 365) {
      jy += div(days - 1, 365);
      days = (days - 1) % 365;
    }
    let jm, jd;
    if (days < 186) {
      jm = 1 + div(days, 31);
      jd = 1 + (days % 31);
    } else {
      jm = 7 + div(days - 186, 30);
      jd = 1 + ((days - 186) % 30);
    }
    return [jy, jm, jd];
  }

  function jalaliToGregorian(jy, jm, jd) {
    let gy = (jy <= 979) ? 621 : 1600;
    jy -= (jy <= 979) ? 0 : 979;
    let days = (365 * jy) + (div(jy, 33) * 8) + div(((jy % 33) + 3), 4) + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
    gy += 400 * div(days, 146097);
    days %= 146097;
    if (days > 36524) {
      gy += 100 * div(--days, 36524);
      days %= 36524;
      if (days >= 365) days++;
    }
    gy += 4 * div(days, 1461);
    days %= 1461;
    if (days > 365) {
      gy += div(days - 1, 365);
      days = (days - 1) % 365;
    }
    let gd = days + 1;
    const sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let gm;
    for (gm = 0; gm < 13; gm++) {
      if (gd <= sal_a[gm]) break;
      gd -= sal_a[gm];
    }
    return [gy, gm, gd];
  }

  const PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

  /** تبدیل رشته ISO (yyyy-mm-dd) به تاریخ جلالی با ارقام فارسی، به فرمت ۱۴۰۵/۰۲/۲۱ */
  function isoToJalaliDisplay(isoDate) {
    if (!isoDate) return '-';
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return '-';
    const [jy, jm, jd] = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const str = `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
    return toPersianDigits(str);
  }

  /** گرفتن تاریخ جلالی امروز به صورت آبجکت {jy,jm,jd} */
  function todayJalali() {
    const now = new Date();
    const [jy, jm, jd] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
    return { jy, jm, jd };
  }

  /** ساخت رشته ISO از تاریخ جلالی جهت ذخیره‌سازی و مرتب‌سازی صحیح */
  function jalaliToIso(jy, jm, jd) {
    const [gy, gm, gd] = jalaliToGregorian(parseInt(jy), parseInt(jm), parseInt(jd));
    return `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
  }

  function jalaliMonthName(m) {
    return PERSIAN_MONTHS[m - 1] || '';
  }

  /* ---------------------------------------------------------
   * فرمت اعداد و ارز
   * --------------------------------------------------------- */
  function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return Number(num).toLocaleString('fa-IR');
  }

  function formatCurrency(num, unit) {
    unit = unit || (Storage_getCurrencyUnit ? Storage_getCurrencyUnit() : 'تومان');
    return `${formatNumber(num)} ${unit}`;
  }

  /** تبدیل ارقام انگلیسی به فارسی برای نمایش */
  function toPersianDigits(str) {
    if (str === null || str === undefined) return '';
    const en = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const fa = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(str).replace(/[0-9]/g, d => fa[en.indexOf(d)]);
  }

  /** فرمت زنده مبلغ برای نمایش داخل input: جداکننده سه رقمی + ارقام فارسی */
  function formatMoneyDisplay(value) {
    let v = toEnglishDigits(value).replace(/[^\d]/g, '');
    if (!v) return '';
    v = v.replace(/^0+(?=\d)/, '');
    v = v.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return toPersianDigits(v);
  }

  /** استخراج مقدار عددی خام (انگلیسی، بدون جداکننده) از مقدار فرمت‌شده فارسی */
  function parseMoneyValue(value) {
    if (value === null || value === undefined) return 0;
    const v = toEnglishDigits(value).replace(/[^\d]/g, '');
    return v ? parseFloat(v) : 0;
  }

  /** اتصال رفتار فرمت‌دهی زنده به یک input مبلغ */
  function bindMoneyInput(inputEl) {
    if (!inputEl || inputEl.dataset.moneyBound) return;
    inputEl.dataset.moneyBound = '1';
    inputEl.setAttribute('inputmode', 'numeric');
    inputEl.setAttribute('autocomplete', 'off');
    if (inputEl.value) inputEl.value = formatMoneyDisplay(inputEl.value);
    inputEl.addEventListener('input', () => {
      const raw = inputEl.value;
      const digitsBeforeCursor = toEnglishDigits(raw.slice(0, inputEl.selectionStart)).replace(/[^\d]/g, '').length;
      const formatted = formatMoneyDisplay(raw);
      inputEl.value = formatted;
      // بازگرداندن تقریبی مکان‌نما بر اساس تعداد ارقام قبل از آن
      let count = 0, pos = formatted.length;
      for (let i = 0; i < formatted.length; i++) {
        if (/[۰-۹]/.test(formatted[i])) count++;
        if (count === digitsBeforeCursor) { pos = i + 1; break; }
      }
      inputEl.setSelectionRange(pos, pos);
    });
  }

  /** اتصال خودکار به تمام input های دارای کلاس money-input داخل یک ظرف */
  function bindAllMoneyInputs(container) {
    (container || document).querySelectorAll('.money-input').forEach(bindMoneyInput);
  }

  /** تبدیل زنده ارقام انگلیسی تایپ‌شده به فارسی، بدون جداکننده هزارگان
   *  (برای فیلدهایی مثل شماره واحد، طبقه، بلوک، تلفن، متراژ که مبلغ نیستند) */
  function bindPersianDigitInput(inputEl) {
    if (!inputEl || inputEl.dataset.persianBound) return;
    inputEl.dataset.persianBound = '1';
    if (inputEl.value) inputEl.value = toPersianDigits(inputEl.value);
    inputEl.addEventListener('input', () => {
      const pos = inputEl.selectionStart;
      inputEl.value = toPersianDigits(inputEl.value);
      inputEl.setSelectionRange(pos, pos);
    });
  }

  /** اتصال خودکار به تمام input های دارای کلاس persian-digit-input داخل یک ظرف */
  function bindAllPersianDigitInputs(container) {
    (container || document).querySelectorAll('.persian-digit-input').forEach(bindPersianDigitInput);
  }

  /* ---------------------------------------------------------
   * تبدیل عدد به حروف فارسی (برای مبلغ به حروف در رسید)
   * --------------------------------------------------------- */
  /** هش کردن رشته (برای ذخیره رمز عبور ورود به نرم‌افزار، نه به‌عنوان یک لایه امنیتی سطح‌بالا) */
  async function sha256Hex(text) {
    try {
      const enc = new TextEncoder().encode(text);
      const buf = await crypto.subtle.digest('SHA-256', enc);
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      // محیط‌های بدون دسترسی به Web Crypto (مثلاً غیر-https) - جایگزین ساده و غیرامن
      let hash = 0;
      for (let i = 0; i < text.length; i++) { hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0; }
      return 'fallback-' + Math.abs(hash).toString(16);
    }
  }

  function numberToPersianWords(num) {
    num = Math.floor(Math.abs(parseFloat(num)) || 0);
    if (num === 0) return 'صفر';

    const yekan = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
    const dahgan = ['', 'ده', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
    const dahyek = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
    const sadgan = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
    const scales = ['', ' هزار', ' میلیون', ' میلیارد', ' هزار میلیارد'];

    function threeDigits(n) {
      const parts = [];
      const s = Math.floor(n / 100);
      const rem = n % 100;
      if (s) parts.push(sadgan[s]);
      if (rem >= 10 && rem < 20) {
        parts.push(dahyek[rem - 10]);
      } else {
        const d = Math.floor(rem / 10);
        const y = rem % 10;
        if (d) parts.push(dahgan[d]);
        if (y) parts.push(yekan[y]);
      }
      return parts.join(' و ');
    }

    const groups = [];
    let n = num;
    while (n > 0) {
      groups.push(n % 1000);
      n = Math.floor(n / 1000);
    }

    const words = [];
    for (let i = groups.length - 1; i >= 0; i--) {
      if (groups[i] > 0) {
        words.push(threeDigits(groups[i]) + (scales[i] || ''));
      }
    }
    return words.join(' و ') || 'صفر';
  }

  /** برچسب یکپارچه واحد جهت نمایش در لیست‌ها و انتخابگرها: شماره واحد + مستاجر + مالک با هم */
  function unitLabel(unit) {
    if (!unit) return '';
    const owner = unit.owner || '-';
    const tenant = unit.tenant || '-';
    return `واحد ${unit.number} (مستاجر: ${tenant} | مالک: ${owner})`;
  }

  function toEnglishDigits(str) {
    if (str === null || str === undefined) return str;
    const fa = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(str).replace(/[۰-۹]/g, d => fa.indexOf(d));
  }

  /** تبدیل اعداد انگلیسی به ارقام فارسی جهت نمایش */
  function toPersianDigits(num) {
    if (num === null || num === undefined) return '';
    const fa = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(num).replace(/[0-9]/g, d => fa[d]);
  }

  /** حذف جداکننده هزارگان (فارسی/انگلیسی) و تبدیل ارقام فارسی به انگلیسی جهت محاسبه و ذخیره‌سازی */
  function stripNumberFormatting(str) {
    if (str === null || str === undefined) return '';
    let s = toEnglishDigits(str);
    s = s.replace(/[^\d.\-]/g, '');
    return s;
  }

  /**
   * فعال‌سازی فرمت خودکار ورودی مبلغ/عدد:
   * حین تایپ، ارقام به فارسی و جداکننده سه‌رقمی (هزارگان) به‌صورت خودکار اعمال می‌شود
   * مقدار واقعی (انگلیسی) هنگام ثبت با Utils.stripNumberFormatting قابل استخراج است
   */
  function bindAmountInput(el) {
    if (!el) return;
    el.setAttribute('dir', 'ltr');
    el.classList.add('text-start');
    const formatEl = () => {
      const raw = stripNumberFormatting(el.value);
      if (raw === '' || raw === '-') { el.value = raw ? toPersianDigits(raw) : ''; return; }
      const num = Number(raw);
      if (isNaN(num)) return;
      el.value = num.toLocaleString('fa-IR');
    };
    el.addEventListener('input', formatEl);
    formatEl();
  }

  /* ---------------------------------------------------------
   * امنیت - جلوگیری از XSS
   * --------------------------------------------------------- */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  function sanitizeInput(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/</g, '&lt;').replace(/>/g, '&gt;').trim();
  }

  /* ---------------------------------------------------------
   * شناسه یکتا
   * --------------------------------------------------------- */
  function generateId() {
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  }

  function generateDocNo(prefix, list) {
    const n = (list?.length || 0) + 1;
    return `${prefix}-${String(n).padStart(4, '0')}`;
  }

  /* ---------------------------------------------------------
   * نوتیفیکیشن Toast سبک (بدون وابستگی خارجی)
   * --------------------------------------------------------- */
  function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const icons = { success: 'check-circle', error: 'x-circle', warning: 'exclamation-triangle', info: 'info-circle' };
    const toastEl = document.createElement('div');
    toastEl.className = `app-toast toast-${type}`;
    toastEl.innerHTML = `<i class="bi bi-${icons[type] || 'info-circle'}"></i><span>${escapeHtml(message)}</span>`;
    container.appendChild(toastEl);
    requestAnimationFrame(() => toastEl.classList.add('show'));
    setTimeout(() => {
      toastEl.classList.remove('show');
      setTimeout(() => toastEl.remove(), 300);
    }, 3500);
  }

  /* ---------------------------------------------------------
   * اعتبارسنجی فرم عمومی
   * --------------------------------------------------------- */
  function validateRequired(value) {
    return value !== null && value !== undefined && String(value).trim() !== '';
  }

  function validatePhone(value) {
    return /^0?9\d{9}$|^0\d{10}$/.test(toEnglishDigits(value).replace(/\s/g, ''));
  }

  function validateNumber(value) {
    return !isNaN(parseFloat(toEnglishDigits(value))) && isFinite(value);
  }

  /* ---------------------------------------------------------
   * خواندن فایل به صورت Base64
   * --------------------------------------------------------- */
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      if (!file) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /** آپلود واقعی فایل به باکت Supabase Storage با نمایش درصد پیشرفت */
  function uploadAttachment(file, onProgress) {
    return new Promise((resolve, reject) => {
      const cfg = SupabaseConfig.get();
      if (!cfg) { reject(new Error('اطلاعات اتصال Supabase یافت نشد')); return; }
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
      const url = `${cfg.url}/storage/v1/object/attachments/${encodeURIComponent(path)}`;
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Authorization', 'Bearer ' + cfg.anonKey);
      xhr.setRequestHeader('apikey', cfg.anonKey);
      xhr.setRequestHeader('x-upsert', 'true');
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const publicUrl = `${cfg.url}/storage/v1/object/public/attachments/${path}`;
          resolve({ url: publicUrl, path, name: file.name });
        } else {
          reject(new Error('خطا در آپلود فایل (کد ' + xhr.status + ')'));
        }
      };
      xhr.onerror = () => reject(new Error('خطای شبکه هنگام آپلود فایل'));
      xhr.send(file);
    });
  }

  /** حذف فایل پیوست از Supabase Storage با استفاده از آدرس عمومی آن */
  async function deleteAttachmentByUrl(url) {
    try {
      const cfg = SupabaseConfig.get();
      if (!cfg || !url || !url.includes('/storage/v1/object/public/attachments/')) return;
      const path = url.split('/storage/v1/object/public/attachments/')[1];
      if (!path) return;
      await fetch(`${cfg.url}/storage/v1/object/attachments/${path}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + cfg.anonKey, 'apikey': cfg.anonKey }
      });
    } catch (e) {
      console.error('خطا در حذف فایل پیوست', e);
    }
  }

  /** آیا آدرس پیوست به یک فایل تصویری اشاره دارد؟ (برای پیش‌نمایش) */
  function isImageAttachment(url) {
    if (!url) return false;
    if (url.startsWith('data:image')) return true;
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(url.split('?')[0]);
  }

  /** ساخت کنترل‌کننده آپلود پیوست: نوار پیشرفت هنگام آپلود، و امکان مشاهده/تغییر/حذف پس از اتمام.
   *  container: عنصر DOM که رابط کاربری پیوست داخل آن رندر می‌شود
   *  initialUrl: آدرس پیوست فعلی (در حالت ویرایش) یا null */
  function createAttachmentUploader(container, initialUrl) {
    let currentUrl = initialUrl || null;
    let uploading = false;

    function render() {
      if (uploading) {
        container.innerHTML = `
          <div class="progress" style="height:10px;">
            <div class="progress-bar" id="attachUploadBar" role="progressbar" style="width:0%"></div>
          </div>
          <div class="small text-muted mt-1" id="attachUploadLabel">در حال آپلود... ۰٪</div>`;
        return;
      }
      if (currentUrl) {
        const isImg = isImageAttachment(currentUrl);
        container.innerHTML = `
          <div class="d-flex align-items-center gap-2 flex-wrap">
            ${isImg
              ? `<img src="${currentUrl}" style="height:44px;width:44px;object-fit:cover;border-radius:8px;border:1px solid var(--border-color)">`
              : `<span class="badge bg-secondary"><i class="bi bi-file-earmark"></i> فایل پیوست</span>`}
            <a href="${currentUrl}" target="_blank" rel="noopener" class="btn btn-sm btn-outline-secondary">مشاهده</a>
            <button type="button" class="btn btn-sm btn-outline-primary" data-action="replace">تغییر پیوست</button>
            <button type="button" class="btn btn-sm btn-outline-danger" data-action="delete">حذف پیوست</button>
          </div>
          <input type="file" class="d-none" data-role="attachFileInput" accept="image/*,.pdf">`;
      } else {
        container.innerHTML = `<input type="file" class="form-control" data-role="attachFileInput" accept="image/*,.pdf">`;
      }
      bindEvents();
    }

    function bindEvents() {
      const fileInput = container.querySelector('[data-role="attachFileInput"]');
      const replaceBtn = container.querySelector('[data-action="replace"]');
      const deleteBtn = container.querySelector('[data-action="delete"]');

      if (replaceBtn) replaceBtn.addEventListener('click', () => fileInput.click());

      if (deleteBtn) deleteBtn.addEventListener('click', () => {
        Swal.fire({
          title: 'حذف پیوست', text: 'آیا از حذف فایل پیوست مطمئن هستید؟', icon: 'warning',
          showCancelButton: true, confirmButtonText: 'حذف', cancelButtonText: 'انصراف', confirmButtonColor: '#dc3545'
        }).then(res => {
          if (res.isConfirmed) {
            const old = currentUrl;
            currentUrl = null;
            render();
            if (old) deleteAttachmentByUrl(old);
          }
        });
      });

      if (fileInput) fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0];
        if (!file) return;
        if (file.size > 8 * 1024 * 1024) { showToast('حجم فایل نباید بیش از ۸ مگابایت باشد', 'error'); return; }
        const oldUrl = currentUrl;
        uploading = true;
        render();
        try {
          const result = await uploadAttachment(file, (pct) => {
            const bar = document.getElementById('attachUploadBar');
            const label = document.getElementById('attachUploadLabel');
            if (bar) bar.style.width = pct + '%';
            if (label) label.textContent = `در حال آپلود... ${toPersianDigits(pct)}٪`;
          });
          currentUrl = result.url;
          uploading = false;
          render();
          showToast('فایل با موفقیت آپلود شد', 'success');
          if (oldUrl) deleteAttachmentByUrl(oldUrl);
        } catch (e) {
          uploading = false;
          render();
          showToast('خطا در آپلود فایل: ' + e.message, 'error');
        }
      });
    }

    render();
    return { getValue: () => currentUrl, isUploading: () => uploading };
  }

  function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  /* ---------------------------------------------------------
   * ویجت انتخاب تاریخ جلالی (سه انتخابگر روز/ماه/سال - بدون وابستگی خارجی)
   * --------------------------------------------------------- */
  function renderJalaliDateInput(name, isoValue) {
    const t = todayJalali();
    let jy = t.jy, jm = t.jm, jd = t.jd;
    if (isoValue) {
      const d = new Date(isoValue);
      if (!isNaN(d.getTime())) {
        const [y, m, dd] = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
        jy = y; jm = m; jd = dd;
      }
    }
    const years = [];
    for (let y = t.jy - 5; y <= t.jy + 2; y++) years.push(y);
    const days = Array.from({ length: 31 }, (_, i) => i + 1);

    return `
      <div class="jalali-date-input" data-field="${name}">
        <select class="form-select jd-day" data-part="d">
          ${days.map(d => `<option value="${d}" ${d === jd ? 'selected' : ''}>${toPersianDigits(d)}</option>`).join('')}
        </select>
        <select class="form-select jd-month" data-part="m">
          ${PERSIAN_MONTHS.map((mn, i) => `<option value="${i + 1}" ${(i + 1) === jm ? 'selected' : ''}>${mn}</option>`).join('')}
        </select>
        <select class="form-select jd-year" data-part="y">
          ${years.map(y => `<option value="${y}" ${y === jy ? 'selected' : ''}>${toPersianDigits(y)}</option>`).join('')}
        </select>
      </div>`;
  }

  function readJalaliDateInput(container, name) {
    const wrap = container.querySelector(`.jalali-date-input[data-field="${name}"]`);
    if (!wrap) return null;
    const y = wrap.querySelector('.jd-year').value;
    const m = wrap.querySelector('.jd-month').value;
    const d = wrap.querySelector('.jd-day').value;
    return jalaliToIso(y, m, d);
  }

  return {
    gregorianToJalali, jalaliToGregorian, isoToJalaliDisplay, todayJalali, jalaliToIso,
    jalaliMonthName, PERSIAN_MONTHS, formatNumber, formatCurrency, toEnglishDigits,
    escapeHtml, sanitizeInput, generateId, generateDocNo, showToast,
    validateRequired, validatePhone, validateNumber, fileToBase64, debounce,
    renderJalaliDateInput, readJalaliDateInput,
    toPersianDigits, formatMoneyDisplay, parseMoneyValue, bindMoneyInput, bindAllMoneyInputs,
    bindPersianDigitInput, bindAllPersianDigitInputs,
    numberToPersianWords, unitLabel, sha256Hex,
    uploadAttachment, deleteAttachmentByUrl, isImageAttachment, createAttachmentUploader
  };
})();
