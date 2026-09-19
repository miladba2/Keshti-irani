-- =========================================================
-- اسکریپت ساخت پایگاه داده نرم‌افزار مدیریت شارژ ساختمان روی Supabase
-- نحوه استفاده: Supabase Dashboard → پروژه شما → SQL Editor → New query
-- کل این فایل را paste کرده و Run بزنید.
-- =========================================================

-- برای تولید خودکار شناسه یکتا (UUID)
create extension if not exists "pgcrypto";

-- =========================================================
-- جدول واحدها
-- =========================================================
create table if not exists units (
  id uuid primary key default gen_random_uuid(),
  code text,
  number text not null,
  floor text,
  block text,
  owner text,
  tenant text,
  phone text,
  area numeric,
  charge_share numeric default 0,
  initial_debt numeric default 0,
  status text default 'active',
  description text,
  created_at timestamptz default now()
);

-- =========================================================
-- جدول اشخاص (پیمانکاران، تامین‌کنندگان، پرسنل و ...)
-- =========================================================
create table if not exists persons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text,
  phone text,
  national_id text,
  status text default 'active',
  description text,
  created_at timestamptz default now()
);

-- =========================================================
-- جدول دریافت‌ها
-- =========================================================
create table if not exists receipts (
  id uuid primary key default gen_random_uuid(),
  doc_no text,
  date date not null,
  unit_id uuid references units(id) on delete set null,
  type text,
  description text,
  amount numeric not null default 0,
  method text default 'transfer',
  tracking_no text,
  registrar text,
  attachment text,
  created_at timestamptz default now()
);

-- =========================================================
-- جدول هزینه‌ها
-- =========================================================
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  doc_no text,
  date date not null,
  category text,
  description text,
  amount numeric not null default 0,
  pay_to text,
  invoice_no text,
  registrar text,
  attachment text,
  person_id uuid references persons(id) on delete set null,
  created_at timestamptz default now()
);

-- =========================================================
-- جدول اسناد شارژ ماهانه
-- =========================================================
create table if not exists charges (
  id uuid primary key default gen_random_uuid(),
  doc_no text,
  unit_id uuid references units(id) on delete cascade,
  jy int not null,
  jm int not null,
  date date not null,
  amount numeric not null default 0,
  description text,
  created_at timestamptz default now(),
  unique (unit_id, jy, jm)
);

-- =========================================================
-- جدول تنظیمات (تک‌رکورد)
-- =========================================================
create table if not exists settings (
  id int primary key default 1,
  building_name text default 'ساختمان نمونه',
  address text,
  phone text,
  manager text,
  logo text,
  currency text default 'تومان',
  primary_color text default '#2563eb',
  theme text default 'light',
  font text default 'IRANSansX',
  constraint single_row check (id = 1)
);
-- توجه: عمداً ردیف اولیه اینجا درج نمی‌شود؛ خود نرم‌افزار در اولین اتصال،
-- ردیف تنظیمات را همراه با لوگوی پیش‌فرض می‌سازد.

-- =========================================================
-- ستون‌های ورود با نام کاربری/رمز عبور به نرم‌افزار (در صورت اجرای مجدد این اسکریپت
-- روی یک پایگاه داده قدیمی‌تر، این دستورات بدون خطا فقط ستون‌های جدید را اضافه می‌کنند)
-- =========================================================
alter table settings add column if not exists auth_enabled boolean default false;
alter table settings add column if not exists auth_username text;
alter table settings add column if not exists auth_password_hash text;
alter table settings add column if not exists auth_timeout_minutes int default 15;

-- =========================================================
-- ایندکس‌های پرکاربرد برای سرعت گزارش‌گیری
-- =========================================================
create index if not exists idx_receipts_unit on receipts(unit_id);
create index if not exists idx_receipts_date on receipts(date);
create index if not exists idx_expenses_date on expenses(date);
create index if not exists idx_expenses_person on expenses(person_id);
create index if not exists idx_charges_unit on charges(unit_id);

-- =========================================================
-- Row Level Security
-- توجه امنیتی مهم:
-- این نرم‌افزار فعلاً بدون سیستم ورود/کاربر (Auth) طراحی شده، پس در این اسکریپت
-- دسترسی کامل خواندن/نوشتن به همه (نقش anon) داده شده تا برنامه فعلی بدون تغییر
-- زیاد بتواند مستقیماً از مرورگر به Supabase وصل شود.
-- *** اگر این پروژه عمومی/اینترنتی خواهد بود، حتماً بعداً Supabase Auth اضافه کنید
-- و این پالیسی‌ها را محدود به کاربر لاگین‌کرده کنید، وگرنه هر کسی با کلید anon
-- می‌تواند تمام اطلاعات ساختمان را بخواند یا تغییر دهد. ***
-- =========================================================
alter table units enable row level security;
alter table persons enable row level security;
alter table receipts enable row level security;
alter table expenses enable row level security;
alter table charges enable row level security;
alter table settings enable row level security;

create policy "allow all - units" on units for all using (true) with check (true);
create policy "allow all - persons" on persons for all using (true) with check (true);
create policy "allow all - receipts" on receipts for all using (true) with check (true);
create policy "allow all - expenses" on expenses for all using (true) with check (true);
create policy "allow all - charges" on charges for all using (true) with check (true);
create policy "allow all - settings" on settings for all using (true) with check (true);

-- =========================================================
-- باکت فایل‌های پیوست (رسیدها، فاکتورها و ...)
-- به‌جای ذخیره فایل به‌صورت Base64 داخل جدول، فایل واقعی اینجا آپلود
-- و فقط آدرس عمومی آن در ستون attachment ذخیره می‌شود.
-- =========================================================
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

create policy "allow all - read attachments" on storage.objects
  for select using (bucket_id = 'attachments');
create policy "allow all - upload attachments" on storage.objects
  for insert with check (bucket_id = 'attachments');
create policy "allow all - update attachments" on storage.objects
  for update using (bucket_id = 'attachments');
create policy "allow all - delete attachments" on storage.objects
  for delete using (bucket_id = 'attachments');
