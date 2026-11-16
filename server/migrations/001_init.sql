-- СӨХ Platform — анхны схем. Бүх хүснэгт cx_id (хотхон)-оор тусгаарлагдана.
-- Огноо (YYYY-MM-DD) болон сар (YYYY-MM)-ыг Улаанбаатарын цагаар text-ээр хадгална.

create table complexes (
  id text primary key,
  name text not null,
  sokh text not null default '',
  district text not null default '',
  color text not null default '#0A72B8',
  layout jsonb,                                  -- засварласан map (null → кодонд байгаа анхных)
  settings jsonb not null default '{}'::jsonb,   -- нэхэмжлэл, SLA, сан, ус алдалт, зогсоол
  ver integer not null default 0,                -- өөрчлөлт бүрт +1 (client sync)
  created_at timestamptz not null default now()
);

create table units (
  id serial primary key,
  cx_id text not null references complexes(id) on delete cascade,
  b integer not null,
  n integer not null,
  floor integer not null default 1,
  owner text not null default '',
  tenant text not null default '',
  phone text not null default '',
  plate text not null default '',
  fee integer not null default 0 check (fee >= 0), -- сарын СӨХ-ийн хураамж
  active boolean not null default true,            -- map-аас хасагдсан айл false
  unique (cx_id, b, n)
);

create table accounts (
  id text primary key,
  cx_id text not null references complexes(id) on delete cascade,
  role text not null check (role in ('admin', 'staff', 'resident')),
  login text not null,
  login_key text not null,
  name text not null,
  phone text not null default '',
  pw text not null,
  status text not null default 'active' check (status in ('pending', 'active', 'rejected', 'disabled')),
  unit_id integer references units(id) on delete set null,
  b integer,
  u integer,
  fam integer,
  pos text not null default '',
  cats text[] not null default '{}',
  note text not null default '',
  created_at timestamptz not null default now(),
  created_by text not null default '',
  decided_at timestamptz,
  decided_by text not null default '',
  unique (cx_id, role, login_key)
);
create index accounts_cx on accounts (cx_id, role, status);
create index accounts_unit on accounts (unit_id);

create table sessions (
  token_hash text primary key,
  account_id text not null references accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ip text not null default '',
  ua text not null default ''
);
create index sessions_acc on sessions (account_id);

create table rate_limits (
  key text primary key,
  n integer not null,
  reset_at timestamptz not null
);

create table otps (
  id serial primary key,
  account_id text not null references accounts(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  tries integer not null default 0,
  used boolean not null default false,
  created_at timestamptz not null default now()
);
create index otps_acc on otps (account_id, id desc);

create table counters (
  cx_id text not null,
  name text not null,
  n integer not null,
  primary key (cx_id, name)
);

create table files (
  id text primary key,
  cx_id text not null references complexes(id) on delete cascade,
  mime text not null,
  size integer not null,
  data bytea not null,
  public boolean not null default false,
  created_by text not null default '',
  created_at timestamptz not null default now()
);

/* ---------- төлбөр ---------- */
create table invoices (
  id serial primary key,
  cx_id text not null references complexes(id) on delete cascade,
  unit_id integer not null references units(id) on delete cascade,
  code text not null,
  month text not null,
  amount integer not null check (amount >= 0),
  paid integer not null default 0,
  items jsonb not null default '[]'::jsonb,
  due_date text not null,
  status text not null default 'unpaid' check (status in ('unpaid', 'paid', 'void')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (unit_id, month)
);
create index invoices_cx on invoices (cx_id, month);
create index invoices_open on invoices (cx_id, status);

create table payments (
  id serial primary key,
  cx_id text not null references complexes(id) on delete cascade,
  unit_id integer references units(id) on delete set null,
  amount integer not null check (amount > 0),
  channel text not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'cancelled')),
  provider text not null default '',
  provider_ref text,
  provider_data jsonb not null default '{}'::jsonb,
  payer text not null default '',
  ebarimt jsonb,
  month text,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index payments_cx on payments (cx_id, status, paid_at desc);
create index payments_unit on payments (unit_id, created_at desc);
create unique index payments_ref on payments (provider, provider_ref) where provider_ref is not null;

create table reminders (
  id serial primary key,
  cx_id text not null references complexes(id) on delete cascade,
  unit_id integer not null references units(id) on delete cascade,
  kind text not null check (kind in ('manual', 'before', 'after')),
  month text not null,
  channel text not null default 'sms',
  created_by text not null default '',
  created_at timestamptz not null default now()
);
create unique index reminders_auto on reminders (unit_id, kind, month) where kind <> 'manual';

/* ---------- засварын хүсэлт ---------- */
create table requests (
  id serial primary key,
  cx_id text not null references complexes(id) on delete cascade,
  code text not null,
  unit_id integer references units(id) on delete set null,
  b integer,
  n integer,
  title text not null,
  cat text not null,
  priority text not null default 'MED' check (priority in ('LOW', 'MED', 'HIGH')),
  descr text not null default '',
  status smallint not null default 0 check (status between 0 and 4),
  assignee_id text references accounts(id) on delete set null,
  assignee_name text not null default '',
  source text not null default 'resident',
  ref text not null default '',                  -- 'light:L07', 'leak:12'
  created_by text references accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  status_at timestamptz not null default now(),
  resolved_at timestamptz,
  sla_alerted boolean not null default false,
  unique (cx_id, code)
);
create index requests_cx on requests (cx_id, status, created_at desc);
create index requests_asg on requests (assignee_id, status);

create table request_events (
  id serial primary key,
  request_id integer not null references requests(id) on delete cascade,
  status smallint not null,
  note text not null default '',
  by_id text,
  by_name text not null default '',
  at timestamptz not null default now()
);
create index request_events_req on request_events (request_id, id);

create table request_photos (
  id serial primary key,
  request_id integer not null references requests(id) on delete cascade,
  file_id text not null references files(id) on delete cascade,
  kind text not null check (kind in ('before', 'after')),
  by_id text,
  at timestamptz not null default now()
);
create index request_photos_req on request_photos (request_id);

/* ---------- IoT: ус алдалт, гэрэл, зогсоол ---------- */
create table devices (
  id text primary key,
  cx_id text not null references complexes(id) on delete cascade,
  kind text not null check (kind in ('leak', 'valve', 'slot', 'light')),
  ref text not null default '',                  -- 'b-n' (айл), 'P07' (зогсоол), 'L03' (гэрэл)
  secret_hash text not null,
  battery integer,
  last_seen timestamptz,
  created_at timestamptz not null default now()
);
create index devices_ref on devices (cx_id, kind, ref);

create table device_commands (
  id serial primary key,
  cx_id text not null references complexes(id) on delete cascade,
  device_id text not null references devices(id) on delete cascade,
  cmd text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'sent', 'done', 'failed')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  done_at timestamptz
);
create index device_commands_dev on device_commands (device_id, status);

create table leaks (
  id serial primary key,
  cx_id text not null references complexes(id) on delete cascade,
  code text not null,
  unit_id integer references units(id) on delete set null,
  b integer not null,
  n integer not null,
  room text not null default '',
  device_id text references devices(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'closed', 'fixing', 'fixed')),
  detected_at timestamptz not null default now(),
  notified_at timestamptz,
  closed_at timestamptz,
  assigned_at timestamptz,
  fixed_at timestamptz,
  assignee_id text references accounts(id) on delete set null,
  assignee_name text not null default '',
  request_id integer references requests(id) on delete set null
);
create index leaks_cx on leaks (cx_id, status, detected_at desc);

create table lights (
  cx_id text not null references complexes(id) on delete cascade,
  id text not null,
  loc text not null default '',
  x real not null default 0,
  z real not null default 0,
  status text not null default 'on' check (status in ('on', 'off', 'fixing')),
  request_id integer references requests(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (cx_id, id)
);

-- state: 0 сул · 1 эзэлсэн (оршин суугч) · 2 зочин · 3 захиалсан
create table slots (
  cx_id text not null references complexes(id) on delete cascade,
  id text not null,
  zone text not null check (zone in ('p', 'g')),
  state smallint not null default 0 check (state between 0 and 3),
  plate text not null default '',
  sensor text not null default 'ok' check (sensor in ('ok', 'low', 'off')),
  battery integer,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (cx_id, id)
);

create table slot_rentals (
  id serial primary key,
  cx_id text not null,
  slot_id text not null,
  unit_id integer not null references units(id) on delete cascade,
  fee integer not null default 0 check (fee >= 0),
  start_at timestamptz not null default now(),
  end_at timestamptz,
  created_by text not null default '',
  foreign key (cx_id, slot_id) references slots(cx_id, id) on delete cascade
);
create unique index slot_rentals_slot on slot_rentals (cx_id, slot_id) where end_at is null;
create unique index slot_rentals_unit on slot_rentals (unit_id) where end_at is null;

create table slot_reservations (
  id serial primary key,
  cx_id text not null,
  slot_id text not null,
  account_id text not null references accounts(id) on delete cascade,
  plate text not null default '',
  status text not null check (status in ('held', 'parked', 'done', 'expired', 'cancelled')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  arrived_at timestamptz,
  left_at timestamptz,
  foreign key (cx_id, slot_id) references slots(cx_id, id) on delete cascade
);
create unique index slot_res_acc on slot_reservations (account_id) where status in ('held', 'parked');
create unique index slot_res_slot on slot_reservations (cx_id, slot_id) where status in ('held', 'parked');

create table park_queue (
  id serial primary key,
  cx_id text not null references complexes(id) on delete cascade,
  account_id text not null references accounts(id) on delete cascade,
  status text not null check (status in ('waiting', 'offered', 'done', 'cancelled')),
  slot_id text,
  offer_expires_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index park_queue_acc on park_queue (account_id) where status in ('waiting', 'offered');

/* ---------- санхүү, ил тод тайлан ---------- */
create table ledger (
  id serial primary key,
  cx_id text not null references complexes(id) on delete cascade,
  code text not null,
  month text not null,
  date text not null,
  cat text not null,
  title text not null,
  amount integer not null check (amount > 0),
  vendor text not null default '',
  obligation_id integer,
  created_by text not null default '',
  created_at timestamptz not null default now()
);
create index ledger_cx on ledger (cx_id, month);

create table obligations (
  id serial primary key,
  cx_id text not null references complexes(id) on delete cascade,
  cat text not null,
  title text not null,
  amount integer not null check (amount > 0),
  due_date text not null default '',
  paid_at timestamptz,
  created_by text not null default '',
  created_at timestamptz not null default now()
);

create table works (
  id serial primary key,
  cx_id text not null references complexes(id) on delete cascade,
  code text not null,
  month text not null,
  date text not null,
  cat text not null,
  title text not null,
  location text not null default '',
  by_name text not null default '',
  source text not null default 'staff',
  request_id integer references requests(id) on delete set null,
  created_at timestamptz not null default now()
);
create index works_cx on works (cx_id, month);

create table reports (
  cx_id text not null references complexes(id) on delete cascade,
  month text not null,
  summary jsonb not null default '{}'::jsonb,
  published_at timestamptz not null default now(),
  published_by text not null default '',
  primary key (cx_id, month)
);

/* ---------- мэдэгдэл, SMS, audit ---------- */
create table notifications (
  id serial primary key,
  cx_id text not null references complexes(id) on delete cascade,
  account_id text not null references accounts(id) on delete cascade,
  kind text not null default 'acc',
  title text not null,
  body text not null default '',
  link text not null default '',
  unread boolean not null default true,
  created_at timestamptz not null default now()
);
create index notifications_acc on notifications (account_id, id desc);

create table outbox (
  id serial primary key,
  cx_id text,
  channel text not null check (channel in ('sms', 'push')),
  to_addr text not null,
  body text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  tries integer not null default 0,
  error text not null default '',
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index outbox_q on outbox (status, id);

create table audit_log (
  id serial primary key,
  cx_id text,
  account_id text,
  action text not null,
  entity text not null default '',
  entity_id text not null default '',
  data jsonb not null default '{}'::jsonb,
  ip text not null default '',
  at timestamptz not null default now()
);
create index audit_cx on audit_log (cx_id, id desc);
