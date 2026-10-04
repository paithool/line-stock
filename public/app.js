/* ============================================================
   Stock — Web App dashboard
   ============================================================ */

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const state = {
  config: null,
  me: null,
  tab: 'overview',
  products: [],
  locations: [],
  filters: { q: '', status: 'all', locationId: '' },
  historyType: 'all',
  historyStartDate: '',
  historyEndDate: '',
  summary: null,
};

const ACTIONS = {
  issue:    { label: 'เบิกออก', icon: '📤', cls: 'issue',    verb: 'เบิก' },
  receive:  { label: 'รับเข้า', icon: '📥', cls: 'receive',  verb: 'รับเข้า' },
  adjust:   { label: 'ปรับยอด', icon: '⚖️', cls: 'adjust',   verb: 'ปรับเป็น' },
  transfer: { label: 'ย้ายคลัง', icon: '🔁', cls: 'transfer', verb: 'ย้าย' },
};

const MOVE_META = {
  issue:        { label: 'เบิกออก', icon: '📤', cls: 'issue' },
  receive:      { label: 'รับเข้า', icon: '📥', cls: 'receive' },
  adjust:       { label: 'ปรับยอด', icon: '⚖️', cls: 'adjust' },
  transfer_out: { label: 'ย้ายออก', icon: '🔁', cls: 'transfer' },
  transfer_in:  { label: 'ย้ายเข้า', icon: '🔁', cls: 'transfer' },
  archive:      { label: 'นำสินค้าออกจากระบบ', icon: '🗑️', cls: 'archive' },
};

/* ------------------------------------------------------------ helpers */

const fmt = (n) => {
  const v = Math.round((Number(n) || 0) * 1000) / 1000;
  return v.toLocaleString('th-TH', { maximumFractionDigits: 3 });
};

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function stockClass(qty, min) {
  if (qty <= 0) return 'out';
  if (min > 0 && qty <= min) return 'low';
  return 'ok';
}

function relTime(sqlUtc) {
  const d = new Date(String(sqlUtc).replace(' ', 'T') + 'Z');
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'เมื่อครู่';
  if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} วันที่แล้ว`;
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Asia/Bangkok' });
}

function toast(message, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind ? 'toast--' + kind : ''}`;
  el.textContent = message;
  $('#toasts').appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .25s, transform .25s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(-10px)';
    setTimeout(() => el.remove(), 260);
  }, 2600);
}

async function api(path, options = {}) {
  const headers = {
    'content-type': 'application/json',
    ...(options.headers || {}),
  };

  const res = await fetch(`/api${path}`, {
    ...options,
    headers,
    credentials: 'same-origin',
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(
      data.error || `เกิดข้อผิดพลาด (${res.status})`,
    );
    error.status = res.status;
    throw error;
  }

  return data;
}


   /* --------------------------------------------------------- bootstrap */

async function boot() {
  try {
  
     state.me = await api('/me');

    paintUser();

    $('#boot').hidden = true;
    $('#loginScreen').hidden = true;
    $('#app').hidden = false;

    if (state.me.role === 'admin') {
      await openAdminPage();
    } else {
      await refreshAll();
      applyDeepLink();
    }

  } catch (err) {
    if (err.status === 401) {
      $('#boot').hidden = true;
      $('#app').hidden = true;
      $('#loginScreen').hidden = false;
      $('#loginUsername').focus();
      return;
    }

    $('#boot').innerHTML = `
      <div class="boot__logo">⚠️</div>
      <div
        class="boot__text"
        style="max-width:280px;text-align:center"
      >
        ${esc(err.message)}
      </div>

      <button
        class="btn btn--ghost"
        onclick="location.reload()"
      >
        ลองใหม่
      </button>`;
  }
}



function applyDeepLink() {
  const p = new URLSearchParams(location.search);
  if (p.get('status')) {
    state.filters.status = p.get('status');
    $$('#statusChips .chip').forEach((c) => c.classList.toggle('is-active', c.dataset.status === state.filters.status));
  }
  if (p.get('tab')) switchTab(p.get('tab'));
  if (p.get('p')) openProduct(Number(p.get('p')));
}

function paintUser() {
  const name = state.me?.name || 'ผู้ใช้';

  $('#userInitial').textContent =
    name.trim().charAt(0).toUpperCase();

  $('#userAvatar').hidden = true;
  $('#userInitial').hidden = false;

  $('#currentDisplayName').textContent =
    state.me?.name ?? '-';

  $('#currentUsername').textContent =
    state.me?.username ?? '-';

  $('#editDisplayName').value =
    state.me?.name ?? '';

  $('#editUsername').value =
    state.me?.username ?? '';
}


async function refreshAll() {
  const [data, products] = await Promise.all([api('/summary'), loadProducts()]);
  state.summary = data.summary;
  state.locations = data.locations;
  renderOverview(data);
  renderLocationFilter();
  renderProducts(products);
  renderSettingsLocations(data.byLocation);
}


/* ------------------------------------------------------ admin */

async function refreshAdminUsers() {
  const list = $('#adminUserList');

  if (!list) return;

  list.innerHTML = '<div class="skeleton"></div>';

  try {
    const data = await api('/admin/users');

    list.innerHTML = data.users.length
      ? data.users.map((user) => `
          <div
            class="item item--plain"
            style="
              display:flex;
              align-items:center;
              justify-content:space-between;
              gap:12px;
            "
          >
            <div class="item__main">
              <div class="item__name">
                ${esc(user.display_name)}
              </div>

              <div class="item__meta">
                <span>${esc(user.username)}</span>
                <span>·</span>
                <span>
                  ${user.role === 'admin'
                    ? 'ผู้ดูแลระบบ'
                    : 'ผู้ใช้ทั่วไป'}
                </span>
              </div>
            </div>

            <div style="display:flex;align-items:center;gap:8px;">
  <span
    class="badge ${
      Number(user.active) === 1
        ? 'badge--ok'
        : 'badge--out'
    }"
  >
    ${
      Number(user.active) === 1
        ? 'ใช้งาน'
        : 'ปิดใช้งาน'
    }
  </span>

  <button
    type="button"
    class="btn btn--ghost"
    data-admin-edit-user="${user.id}"
  >
    แก้ไข
  </button>
</div>
        `).join('')
      : '<div class="empty">ยังไม่มีบัญชีผู้ใช้</div>';

  } catch (err) {
    list.innerHTML = `
      <div class="empty">
        ไม่สามารถโหลดรายชื่อผู้ใช้ได้<br>
        <small>${esc(err.message)}</small>
      </div>
    `;
  }
}


        function openAdminUserEdit(user) {
  const editBox = $('#adminUserEdit');
  const form = $('#adminUserEditForm');

  if (!editBox || !form) return;

  form.innerHTML = `
    <label for="adminEditUsername">ชื่อผู้ใช้</label>
    <input
      id="adminEditUsername"
      type="text"
      value="${esc(user.username)}"
    >

    <label for="adminEditDisplayName">ชื่อที่แสดง</label>
    <input
      id="adminEditDisplayName"
      type="text"
      value="${esc(user.display_name)}"
    >

    <label for="adminEditRole">สิทธิ์ผู้ใช้</label>
    <select id="adminEditRole">
      <option value="user" ${user.role === 'user' ? 'selected' : ''}>
        ผู้ใช้ทั่วไป
      </option>
      <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>
        ผู้ดูแลระบบ
      </option>
    </select>

    <label for="adminEditActive">สถานะ</label>
    <select id="adminEditActive">
      <option value="1" ${Number(user.active) === 1 ? 'selected' : ''}>
        ใช้งาน
      </option>
      <option value="0" ${Number(user.active) === 0 ? 'selected' : ''}>
        ปิดใช้งาน
      </option>
    </select>

    <label for="adminEditPassword">
      รหัสผ่านใหม่
    </label>

    <input
      id="adminEditPassword"
      type="password"
      placeholder="เว้นว่างหากไม่ต้องการเปลี่ยน"
    >

    <div style="display:flex;gap:10px;margin-top:16px;">
      <button
        class="btn btn--block"
        type="button"
        id="adminSaveEditBtn"
      >
        บันทึก
      </button>

      <button
        class="btn btn--ghost btn--block"
        type="button"
        id="adminCancelEditBtn"
      >
        ยกเลิก
      </button>
    </div>

    <div
      id="adminEditMessage"
      style="margin-top:10px;"
      hidden
    ></div>
  `;

  editBox.hidden = false;

  editBox.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
       $('#adminCancelEditBtn').addEventListener('click', () => {
  editBox.hidden = true;
  form.innerHTML = '';
});    
}

      

      

      
        
  

async function openAdminView() {
  $('#adminCurrentUser').textContent =
    state.me
      ? `${state.me.name} (${state.me.username})`
      : '-';

  await refreshAdminUsers();
}

async function loadProducts() {
  const p = new URLSearchParams();
  if (state.filters.q) p.set('q', state.filters.q);
  if (state.filters.status !== 'all') p.set('status', state.filters.status);
  if (state.filters.locationId) p.set('locationId', state.filters.locationId);
  state.products = await api(`/products?${p}`);
  return state.products;
}

/* ------------------------------------------------------------ ภาพรวม */

function renderOverview(data) {
  const s = data.summary;
  $('#statGrid').innerHTML = `
    ${statTile('รายการสินค้า', fmt(s.productCount), `${s.locationCount} คลัง`, '')}
    ${statTile('หน่วยคงเหลือรวม', fmt(s.totalUnits), 'ทุกคลังรวมกัน', '')}
    ${statTile('ใกล้หมด', fmt(s.lowCount), 'ต่ำกว่าจุดสั่งซื้อ', 'warn')}
    ${statTile('หมดสต๊อก', fmt(s.outCount), 'ต้องสั่งซื้อด่วน', 'danger')}
    <div class="stat" style="grid-column:1/-1">
      <div class="stat__label">ความเคลื่อนไหววันนี้</div>
      <div style="display:flex;gap:22px;margin-top:8px">
        <div><div class="stat__value" style="color:var(--issue);font-size:22px">${fmt(s.todayIssue)}</div><div class="stat__hint">เบิกออก</div></div>
        <div><div class="stat__value" style="color:var(--receive);font-size:22px">${fmt(s.todayReceive)}</div><div class="stat__hint">รับเข้า</div></div>
        <div><div class="stat__value" style="font-size:22px">${fmt(s.todayMovements)}</div><div class="stat__hint">รายการ</div></div>
      </div>
    </div>`;

  const max = Math.max(1, ...data.byLocation.map((l) => Number(l.units) || 0));
  $('#locationBars').innerHTML = data.byLocation.length
    ? data.byLocation
        .map(
          (l) => `
      <div class="loc-bar">
        <div class="loc-bar__top">
          <span class="loc-bar__name">${esc(l.name)}</span>
          <span class="loc-bar__value">${fmt(l.units)} หน่วย · ${l.items} รายการ</span>
        </div>
        <div class="loc-bar__track"><div class="loc-bar__fill" style="width:${((Number(l.units) || 0) / max) * 100}%"></div></div>
      </div>`,
        )
        .join('')
    : '<div class="empty">ยังไม่มีคลังสินค้า</div>';

  $('#lowList').innerHTML = data.low.length
    ? data.low.map((p) => productRow(p, true)).join('')
    : '<div class="empty">ไม่มีสินค้าต่ำกว่าจุดสั่งซื้อ 🎉</div>';

  $('#recentList').innerHTML = data.recent.length
    ? data.recent.slice(0, 6).map(movementRow).join('')
    : '<div class="empty">ยังไม่มีความเคลื่อนไหว</div>';
}

function statTile(label, value, hint, kind) {
  return `<div class="stat ${kind ? 'stat--' + kind : ''}">
    <div class="stat__label">${kind ? `<span class="dot"></span>` : ''}${esc(label)}</div>
    <div class="stat__value">${value}</div>
    <div class="stat__hint">${esc(hint)}</div>
  </div>`;
}

function productRow(p, plain = false) {
  const cls = stockClass(Number(p.total_qty), Number(p.min_qty));
  const badge = cls === 'out' ? 'หมด' : cls === 'low' ? 'ใกล้หมด' : '';
  return `<button class="item ${plain ? 'item--plain' : ''}" data-product="${p.id}">
    <div class="item__main">
      <div class="item__name">${esc(p.name)}</div>
      <div class="item__meta">
        <span>${esc(p.sku)}</span>
        ${p.category ? `<span>· ${esc(p.category)}</span>` : ''}
        ${badge ? `<span class="badge badge--${cls}">${badge}</span>` : ''}
      </div>
    </div>
    <div class="item__qty">
      <b class="qty-${cls}">${fmt(p.total_qty)}</b>
      <span>${esc(p.unit)}</span>
    </div>
  </button>`;
}

function movementRow(m) {
  const isInitialAdd =
    m.type === 'receive' &&
    m.note === 'จำนวนเริ่มต้นตอนเพิ่มสินค้า';

  const meta = isInitialAdd
    ? { label: 'เพิ่มเข้า', icon: '🆕', cls: 'receive' }
    : (MOVE_META[m.type] ?? { label: m.type, icon: '•', cls: '' });

  const positive = Number(m.delta) > 0;

  return `<div class="tl">
    <div class="tl__icon badge--${meta.cls}">${meta.icon}</div>
    <div>
      <div class="tl__name">${esc(m.product_name)}</div>
      <div class="tl__meta">${meta.label} · ${esc(m.location_name)} · ${relTime(m.created_at)}${m.actor_name ? ' · ' + esc(m.actor_name) : ''}${m.note && !isInitialAdd ? ' · ' + esc(m.note) : ''}</div>
    </div>
    <div>
      <div class="tl__delta" style="color:var(--${positive ? 'receive' : 'issue'})">${positive ? '+' : ''}${fmt(m.delta)}</div>
      <div class="tl__balance">เหลือ ${fmt(m.balance_after)}</div>
    </div>
  </div>`;
}

/* ------------------------------------------------------------- สินค้า */

function renderLocationFilter() {
  const sel = $('#locationFilter');
  sel.innerHTML =
    '<option value="">ทุกคลัง</option>' +
    state.locations.map((l) => `<option value="${l.id}">${esc(l.name)}</option>`).join('');
  sel.value = state.filters.locationId;
}

function renderProducts(products) {
  $('#productList').innerHTML = products.length
    ? products.map((p) => productRow(p)).join('')
    : `<div class="empty">ไม่พบสินค้าที่ตรงกับเงื่อนไข</div>`;
}

function renderSettingsLocations(byLocation = []) {
  const stats = Object.fromEntries(byLocation.map((l) => [l.id, l]));
  $('#locationList').innerHTML = state.locations
    .map((l) => {
      const s = stats[l.id] ?? { units: 0, items: 0 };
      return `<button class="item item--plain" data-location="${l.id}">
        <div class="item__main">
          <div class="item__name">${esc(l.name)} ${l.is_default ? '<span class="badge badge--ok">ค่าเริ่มต้น</span>' : ''}</div>
          <div class="item__meta"><span>${esc(l.code)}</span><span>· ${s.items} รายการ</span></div>
        </div>
        <div class="item__qty"><b>${fmt(s.units)}</b><span>หน่วย</span></div>
      </button>`;
    })
    .join('');
}

/* ------------------------------------------------------------ ประวัติ */

async function renderHistory() {
  const list = $('#historyList');

  if (!list) return;

  list.innerHTML = '<div class="skeleton"></div>';

  try {
    const params = new URLSearchParams();

    params.set('limit', '200');

    // วันที่เริ่มต้น
    if (state.historyStartDate) {
      params.set('startDate', state.historyStartDate);
    }

    // วันที่สิ้นสุด
    if (state.historyEndDate) {
      params.set('endDate', state.historyEndDate);
    }

    // เรียกข้อมูลประวัติจาก API
    const rows = await api(`/movements?${params.toString()}`);

    // กรองตามประเภท
    const filtered =
      state.historyType === 'all'
        ? rows
        : rows.filter((r) => {

            const isInitialAdd =
              r.type === 'receive' &&
              r.note === 'จำนวนเริ่มต้นตอนเพิ่มสินค้า';

            // เพิ่มเข้า
            if (state.historyType === 'initial') {
              return isInitialAdd;
            }

            // รับเข้า
            if (state.historyType === 'receive') {
              return r.type === 'receive' && !isInitialAdd;
            }

            // ย้ายคลัง
            if (state.historyType === 'transfer') {
              return (
                r.type === 'transfer' ||
                r.type === 'transfer_in' ||
                r.type === 'transfer_out'
              );
            }

            // ประเภทอื่น
            return r.type === state.historyType;
          });

    // แสดงผล
    list.innerHTML = filtered.length
      ? filtered.map(movementRow).join('')
      : '<div class="empty">ไม่มีรายการในช่วงวันที่เลือก</div>';

  } catch (err) {

    console.error('renderHistory error:', err);

    list.innerHTML = `
      <div class="empty">
        ไม่สามารถโหลดประวัติได้<br>
        <small>${esc(err.message)}</small>
      </div>
    `;
  }
}

/* -------------------------------------------------------- bottom sheet */

function openSheet(html) {
  $('#sheetBody').innerHTML = html;
  $('#sheet').hidden = false;
  $('#backdrop').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeSheet() {
  $('#sheet').hidden = true;
  $('#backdrop').hidden = true;
  document.body.style.overflow = '';
}

function sheetHead(title, subtitle) {
  return `<div class="sheet__head">
    <div><div class="sheet__title">${esc(title)}</div>${subtitle ? `<div class="sheet__sub">${esc(subtitle)}</div>` : ''}</div>
    <button class="sheet__close" data-close>✕</button>
  </div>`;
}

/* -------------------------------------------------- รายละเอียดสินค้า */

async function openProduct(id) {
  openSheet(`${sheetHead('กำลังโหลด…', '')}<div class="skeleton" style="height:120px"></div>`);
  try {
    const { product, levels, movements, total } = await api(`/products/${id}`);
    const cls = stockClass(total, product.min_qty);
    openSheet(`
      ${sheetHead(product.name, `${product.sku}${product.barcode ? ' · ' + product.barcode : ''}`)}
      <div style="display:flex;align-items:baseline;gap:8px;margin-top:10px">
        <div class="confirm__big qty-${cls}" style="font-size:34px">${fmt(total)}</div>
        <div style="color:var(--muted);font-size:13px">${esc(product.unit)} รวมทุกคลัง</div>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-top:2px">
        ${product.min_qty > 0 ? `จุดสั่งซื้อขั้นต่ำ ${fmt(product.min_qty)} ${esc(product.unit)}` : 'ยังไม่ตั้งจุดสั่งซื้อ'}
        ${product.category ? ' · ' + esc(product.category) : ''}
      </div>

      <div class="btn-grid" style="margin-top:16px">
        <button class="btn btn--issue" data-move="issue" data-id="${product.id}">📤 เบิกออก</button>
        <button class="btn btn--receive" data-move="receive" data-id="${product.id}">📥 รับเข้า</button>
        <button class="btn btn--ghost" data-move="adjust" data-id="${product.id}">⚖️ ปรับยอด</button>
        <button class="btn btn--ghost" data-move="transfer" data-id="${product.id}">🔁 ย้ายคลัง</button>
      </div>

      <section>
        <h3>คงเหลือแยกตามคลัง</h3>
        <div class="list">
          ${levels
            .map(
              (l) => `<div class="row"><span class="row__label">${esc(l.name)} · ${esc(l.code)}</span>
              <span class="row__value">${fmt(l.qty)} ${esc(product.unit)}</span></div>`,
            )
            .join('')}
        </div>
      </section>

      <section>
        <h3>ความเคลื่อนไหวล่าสุด</h3>
        <div class="timeline">${movements.length ? movements.slice(0, 12).map(movementRow).join('') : '<div class="empty">ยังไม่มีรายการ</div>'}</div>
      </section>

      <section>
        <button class="btn btn--ghost btn--block" data-edit-product="${product.id}">แก้ไขข้อมูลสินค้า</button>
      </section>
    `);
  } catch (err) {
    toast(err.message, 'error');
    closeSheet();
  }
}

/* ------------------------------------------------------- ทำรายการสต๊อก */

async function openMovement(productId, action = 'issue') {
  const { product, levels } = await api(`/products/${productId}`);
  const meta = ACTIONS[action];
  const defaultLoc = levels.find((l) => l.qty > 0) ?? levels[0];

  openSheet(`
    ${sheetHead(meta.label, product.name)}
    <div class="seg" style="margin-top:6px">
      ${Object.entries(ACTIONS)
        .map(([key, a]) => `<button data-action="${key}" class="${key === action ? 'is-active' : ''}">${a.icon} ${a.label}</button>`)
        .join('')}
    </div>

    <form id="moveForm" style="margin-top:18px">
      <div class="field">
        <label>${action === 'transfer' ? 'คลังต้นทาง' : 'คลัง'}</label>
        <select name="locationId">
          ${levels.map((l) => `<option value="${l.location_id}" ${l.location_id === defaultLoc?.location_id ? 'selected' : ''}>${esc(l.name)} — คงเหลือ ${fmt(l.qty)} ${esc(product.unit)}</option>`).join('')}
        </select>
      </div>

      ${
        action === 'transfer'
          ? `<div class="field"><label>คลังปลายทาง</label>
              <select name="toLocationId">
                ${levels.map((l) => `<option value="${l.location_id}">${esc(l.name)} — คงเหลือ ${fmt(l.qty)} ${esc(product.unit)}</option>`).join('')}
              </select></div>`
          : ''
      }

      <div class="field">
        <label>${action === 'adjust' ? `จำนวนที่นับได้จริง (${esc(product.unit)})` : `จำนวน (${esc(product.unit)})`}</label>
        <div class="stepper">
          <button type="button" data-step="-1">−</button>
          <input name="qty" type="number" inputmode="decimal" min="0" step="any" value="${action === 'adjust' ? fmt(defaultLoc?.qty ?? 0).replace(/,/g, '') : 1}" />
          <button type="button" data-step="1">+</button>
        </div>
      </div>

      <div class="field">
        <label>หมายเหตุ (ไม่บังคับ)</label>
        <input name="note" placeholder="เช่น ใช้ในงานอีเวนต์ / ผู้รับของ" />
      </div>

      <div class="confirm" id="preview"></div>

      <button class="btn btn--${meta.cls} btn--block" style="margin-top:14px" type="submit" id="submitBtn">ยืนยัน</button>
    </form>
  `);

  const form = $('#moveForm');
  const unit = product.unit;

  const updatePreview = () => {
    const locId = Number(form.locationId.value);
    const level = levels.find((l) => l.location_id === locId);
    const current = level?.qty ?? 0;
    const qty = Number(form.qty.value || 0);
    const after = action === 'receive' ? current + qty : action === 'adjust' ? qty : current - qty;
    const cls = stockClass(after, product.min_qty);
    const invalid = (action !== 'adjust' && qty <= 0) || (action !== 'receive' && action !== 'adjust' && after < 0);

    $('#preview').innerHTML = `
      <div class="row"><span class="row__label">คงเหลือปัจจุบัน</span><span class="row__value">${fmt(current)} ${esc(unit)}</span></div>
      <div class="row"><span class="row__label">${ACTIONS[action].verb}</span><span class="row__value" style="color:var(--${meta.cls})">${fmt(qty)} ${esc(unit)}</span></div>
      <div class="row"><span class="row__label">คงเหลือหลังทำรายการ</span><span class="confirm__big qty-${cls}">${fmt(after)} ${esc(unit)}</span></div>
      ${after < 0 ? '<div style="color:var(--danger);font-size:12px">สต๊อกไม่พอสำหรับจำนวนนี้</div>' : ''}
      ${after >= 0 && product.min_qty > 0 && after <= product.min_qty ? `<div style="color:var(--warn);font-size:12px">⚠️ จะต่ำกว่าจุดสั่งซื้อ (ขั้นต่ำ ${fmt(product.min_qty)})</div>` : ''}`;

    const btn = $('#submitBtn');
    btn.disabled = invalid;
    btn.textContent = `ยืนยัน${ACTIONS[action].label} ${fmt(qty)} ${unit}`;
  };

  form.addEventListener('input', updatePreview);
  form.addEventListener('change', updatePreview);
  $$('[data-step]', form).forEach((b) =>
    b.addEventListener('click', () => {
      const input = form.qty;
      input.value = Math.max(0, (Number(input.value) || 0) + Number(b.dataset.step));
      updatePreview();
    }),
  );
  $$('[data-action]').forEach((b) => b.addEventListener('click', () => openMovement(productId, b.dataset.action)));
  updatePreview();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#submitBtn');
    btn.disabled = true;
    btn.textContent = 'กำลังบันทึก…';
    try {
      const payload = {
        action,
        productId,
        locationId: Number(form.locationId.value),
        qty: Number(form.qty.value),
        note: form.note.value.trim() || undefined,
      };
      if (action === 'transfer') payload.toLocationId = Number(form.toLocationId.value);
      const result = await api('/movements', { method: 'POST', body: JSON.stringify(payload) });
      closeSheet();
      toast(`${meta.label}สำเร็จ · เลขที่ ${result.ref}`, 'ok');
      await refreshAll();
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
      updatePreview();
    }
  });
}

/* ------------------------------------------------------ ฟอร์มสินค้า */

function openProductForm(product = null) {
  const p = product ?? {};
  openSheet(`
    ${sheetHead(product ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่', product ? p.sku : 'กรอกข้อมูลสินค้าที่ต้องการเก็บสต๊อก')}
    <form id="productForm" style="margin-top:14px">
      <div class="field"><label>ชื่อสินค้า *</label><input name="name" required value="${esc(p.name ?? '')}" placeholder="เช่น ปากกาลูกลื่น น้ำเงิน" /></div>
      <div class="field--row">
        <div class="field"><label>รหัสสินค้า (SKU)</label><input name="sku" value="${esc(p.sku ?? '')}" placeholder="เว้นว่างให้ระบบสร้าง" /></div>
        <div class="field"><label>หน่วยนับ</label><input name="unit" value="${esc(p.unit ?? 'ชิ้น')}" /></div>
      </div>
      <div class="field">
        <label>บาร์โค้ด</label>
        <div style="display:flex;gap:8px">
          <input name="barcode" value="${esc(p.barcode ?? '')}" placeholder="สแกนหรือพิมพ์" style="flex:1" />
          <button type="button" class="btn btn--ghost" id="scanIntoField">สแกน</button>
        </div>
      </div>
      <div class="field--row">
        <div class="field"><label>หมวดหมู่</label><input name="category" value="${esc(p.category ?? '')}" placeholder="เช่น เครื่องเขียน" /></div>
        <div class="field"><label>จุดสั่งซื้อขั้นต่ำ</label><input name="min_qty" type="number" min="0" step="any" value="${p.min_qty ?? 0}" /></div>
      </div>
      ${
        product
          ? ''
          : `<div class="field--row">
              <div class="field"><label>จำนวนที่เพิ่ม</label><input name="initial_qty" type="number" min="0" step="any" value="0" /></div>
              <div class="field"><label>เก็บที่คลัง</label><select name="location_id">${state.locations.map((l) => `<option value="${l.id}">${esc(l.name)}</option>`).join('')}</select></div>
            </div>`
      }
      <div class="field"><label>หมายเหตุ</label><input name="note" value="${esc(p.note ?? '')}" /></div>
      <button class="btn btn--primary btn--block" type="submit">${product ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้า'}</button>
      ${product ? `<button class="btn btn--danger btn--block" style="margin-top:8px" type="button" id="archiveBtn">นำสินค้าออกจากระบบ</button>` : ''}
    </form>
  `);

  const form = $('#productForm');
  $('#scanIntoField')?.addEventListener('click', async () => {
    const code = await scan();
    if (code) form.barcode.value = code;
  });

  $('#archiveBtn')?.addEventListener('click', async () => {
    if (!confirm('ต้องการนำสินค้านี้ออกจากระบบหรือไม่? ประวัติเดิมจะยังอยู่')) return;
    try {
      await api(`/products/${p.id}`, { method: 'DELETE' });
      closeSheet();
      toast('นำสินค้าออกแล้ว', 'ok');
      await refreshAll();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(form).entries());
    body.min_qty = Number(body.min_qty || 0);
    if (body.initial_qty !== undefined) body.initial_qty = Number(body.initial_qty || 0);
    if (body.location_id !== undefined) body.location_id = Number(body.location_id || 0);
    try {
      if (product) await api(`/products/${p.id}`, { method: 'PUT', body: JSON.stringify(body) });
      else await api('/products', { method: 'POST', body: JSON.stringify(body) });
      closeSheet();
      toast(product ? 'บันทึกแล้ว' : 'เพิ่มสินค้าแล้ว', 'ok');
      await refreshAll();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

/* -------------------------------------------------------- ฟอร์มคลัง */

function openLocationForm(location = null) {
  const l = location ?? {};
  openSheet(`
    ${sheetHead(location ? 'แก้ไขคลัง' : 'เพิ่มคลังใหม่', location ? l.code : 'สร้างที่เก็บสินค้าใหม่')}
    <form id="locForm" style="margin-top:14px">
      <div class="field--row">
        <div class="field"><label>รหัสคลัง *</label><input name="code" required value="${esc(l.code ?? '')}" placeholder="MAIN" /></div>
        <div class="field"><label>ชื่อคลัง *</label><input name="name" required value="${esc(l.name ?? '')}" placeholder="คลังกลาง" /></div>
      </div>
      <label style="display:flex;gap:10px;align-items:center;font-size:13px;margin:6px 0 16px">
        <input type="checkbox" name="is_default" ${l.is_default ? 'checked' : ''} style="width:18px;height:18px" />
        ตั้งเป็นคลังเริ่มต้น
      </label>
      <button class="btn btn--primary btn--block" type="submit">${location ? 'บันทึก' : 'เพิ่มคลัง'}</button>
      ${location ? `<button class="btn btn--danger btn--block" style="margin-top:8px" type="button" id="delLoc">ลบคลังนี้</button>` : ''}
    </form>
  `);

  const form = $('#locForm');
  $('#delLoc')?.addEventListener('click', async () => {
    if (!confirm('ลบคลังนี้หรือไม่?')) return;
    try {
      await api(`/locations/${l.id}`, { method: 'DELETE' });
      closeSheet();
      toast('ลบคลังแล้ว', 'ok');
      await refreshAll();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      code: form.code.value.trim(),
      name: form.name.value.trim(),
      is_default: form.is_default.checked,
    };
    try {
      if (location) await api(`/locations/${l.id}`, { method: 'PUT', body: JSON.stringify(body) });
      else await api('/locations', { method: 'POST', body: JSON.stringify(body) });
      closeSheet();
      toast('บันทึกแล้ว', 'ok');
      await refreshAll();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

/* ------------------------------------------------------------- สแกน */
let scanStream = null;
let scanTimer = null;
let scanLocked = false;

async function scan() {
  // ถ้าเครื่องไม่รองรับ BarcodeDetector
  if (!('BarcodeDetector' in window)) {
    const manual = prompt(
      'อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับการสแกนด้วยกล้อง\n\nกรุณากรอกบาร์โค้ด'
    );
    return manual?.trim() || null;
  }

  try {
    const supported = await BarcodeDetector.getSupportedFormats();

    const formats = [
      'ean_13',
      'ean_8',
      'upc_a',
      'upc_e',
      'code_128',
      'code_39',
      'code_93',
      'codabar',
      'itf',
      'qr_code',
    ].filter((f) => supported.includes(f));

    const detector = new BarcodeDetector({
      formats: formats.length ? formats : supported,
    });

    return await openBarcodeScanner(detector);

  } catch (err) {
    console.error('Barcode scanner error:', err);

    const manual = prompt(
      'ไม่สามารถเปิดกล้องสแกนบาร์โค้ดได้\n\nกรุณากรอกบาร์โค้ด'
    );

    return manual?.trim() || null;
  }
}


function openBarcodeScanner(detector) {
  return new Promise(async (resolve) => {

    scanLocked = false;

    const scanner = document.createElement('div');

    scanner.id = 'barcodeScanner';

    scanner.innerHTML = `
      <div class="barcode-scanner">

        <div class="barcode-scanner__head">
          <strong>สแกนบาร์โค้ด</strong>
          <button type="button" id="closeBarcodeScanner">✕</button>
        </div>

        <div class="barcode-scanner__camera">
          <video
            id="barcodeVideo"
            autoplay
            muted
            playsinline>
          </video>

          <div class="barcode-scanner__frame">
            <div class="barcode-scanner__line"></div>
          </div>
        </div>

        <div class="barcode-scanner__status" id="barcodeScannerStatus">
          กำลังเปิดกล้อง...
        </div>

        <button
          type="button"
          class="btn btn--ghost btn--block"
          id="barcodeManual">
          กรอกบาร์โค้ดเอง
        </button>

      </div>
    `;

    document.body.appendChild(scanner);

    const video = scanner.querySelector('#barcodeVideo');
    const status = scanner.querySelector('#barcodeScannerStatus');

    const cleanup = (value = null) => {
      if (scanTimer) {
        cancelAnimationFrame(scanTimer);
        scanTimer = null;
      }

      if (scanStream) {
        scanStream.getTracks().forEach((track) => track.stop());
        scanStream = null;
      }

      scanner.remove();
      document.body.style.overflow = '';

      resolve(value);
    };

    scanner.querySelector('#closeBarcodeScanner')
      .addEventListener('click', () => cleanup(null));

    scanner.querySelector('#barcodeManual')
      .addEventListener('click', () => {
        cleanup(null);

        setTimeout(() => {
          const manual = prompt('กรอกบาร์โค้ด');

          if (manual?.trim()) {
            resolve(manual.trim());
          }
        }, 50);
      });

    try {
      scanStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: {
            ideal: 'environment'
          },
          width: {
            ideal: 1280
          },
          height: {
            ideal: 720
          }
        },
        audio: false
      });

      video.srcObject = scanStream;

      await video.play();

      status.textContent = 'นำบาร์โค้ดมาไว้ในกรอบ';

      const scanFrame = async () => {

        if (scanLocked) return;

        if (
          video.readyState >= 2 &&
          video.videoWidth > 0 &&
          video.videoHeight > 0
        ) {

          try {
            const codes = await detector.detect(video);

            if (codes.length > 0) {

              const code = codes[0]?.rawValue?.trim();

              if (code) {
                scanLocked = true;

                status.textContent = `พบรหัส ${code}`;

                // สั่นมือถือเมื่ออ่านสำเร็จ
                if (navigator.vibrate) {
                  navigator.vibrate(150);
                }

                setTimeout(() => {
                  cleanup(code);
                }, 250);

                return;
              }
            }

          } catch (err) {
            console.warn('Barcode detect:', err);
          }
        }

        scanTimer = requestAnimationFrame(scanFrame);
      };

      scanTimer = requestAnimationFrame(scanFrame);

    } catch (err) {

      console.error('Camera error:', err);

      status.textContent =
        'เปิดกล้องไม่ได้ กรุณาอนุญาตให้เว็บไซต์ใช้กล้อง';

      // ให้ผู้ใช้กดกรอกเองได้
    }
  });
}


/* -------------------------------------------------------------
   เปิดสินค้าโดยใช้ Barcode
------------------------------------------------------------- */

async function scanAndOpen() {

  const code = await scan();

  if (!code) return;

  try {

    const { product } =
      await api(
        `/products/lookup/${encodeURIComponent(code)}`
      );

    openProduct(product.id);

  } catch (err) {

    const create = confirm(
      `ไม่พบสินค้าบาร์โค้ด ${code}\n\n` +
      `ต้องการเพิ่มเป็นสินค้าใหม่หรือไม่?`
    );

    if (!create) return;

    openProductForm();

    setTimeout(() => {

      const input =
        $('#productForm')?.querySelector('[name="barcode"]');

      if (input) {
        input.value = code;
        input.focus();
      }

    }, 100);
  }
}

async function openAdminPage() {
  state.tab = 'admin';

  // ซ่อน Stock App
  $('#app').hidden = true;

  // แสดง Admin App
  const adminApp = $('#adminApp');

  if (!adminApp) {
    console.error('ไม่พบ #adminApp');
    return;
  }

  adminApp.hidden = false;

  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  });

  try {
    await openAdminView();
  } catch (err) {
    console.error('openAdminView ERROR:', err);
  }
}

  
   
/* ----------------------------------------------------------- routing */

function switchTab(tab) {
  if (!['overview', 'products', 'history', 'settings', 'admin'].includes(tab)) {
    return;
  }

  state.tab = tab;

  $$('.view').forEach(
    (v) => (v.hidden = v.dataset.view !== tab)
  );

  $$('.tab[data-tab]').forEach(
    (b) =>
      b.classList.toggle(
        'is-active',
        b.dataset.tab === tab
      )
  );

  $('#topbarSubtitle').textContent = {
    overview: 'ภาพรวมวันนี้',
    products: 'รายการสินค้าทั้งหมด',
    history: 'ประวัติการเคลื่อนไหว',
    settings: 'ตั้งค่าระบบ',
    admin: 'จัดการผู้ใช้',
  }[tab];

  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  });

  if (tab === 'history') {
    renderHistory();
  }

  if (tab === 'admin') {
    openAdminView();
  }
}

/* ---------------------------------------------------------- listeners */

document.addEventListener('click', async (e) => {
  const tab = e.target.closest('.tab[data-tab]');
  if (tab) return switchTab(tab.dataset.tab);

  if (e.target.closest('#fabScan') || e.target.closest('#scanBtn')) return scanAndOpen();
  if (e.target.closest('[data-close]') || e.target.closest('#backdrop')) return closeSheet();

  const goto = e.target.closest('[data-goto]');
  if (goto) {
    if (goto.dataset.status) {
      state.filters.status = goto.dataset.status;
      $$('#statusChips .chip').forEach((c) => c.classList.toggle('is-active', c.dataset.status === goto.dataset.status));
      loadProducts().then(renderProducts);
    }
    return switchTab(goto.dataset.goto);
  }

  const product = e.target.closest('[data-product]');
  if (product) return openProduct(Number(product.dataset.product));

  const move = e.target.closest('[data-move]');
  if (move) return openMovement(Number(move.dataset.id), move.dataset.move);

  const edit = e.target.closest('[data-edit-product]');
  if (edit) {
    const id = Number(edit.dataset.editProduct);
    return api(`/products/${id}`).then(({ product }) => openProductForm(product));
  }

   const adminEdit = e.target.closest('[data-admin-edit-user]');
if (adminEdit) {
  const id = Number(adminEdit.dataset.adminEditUser);

  const user = await api('/admin/users').then(({ users }) =>
    users.find((u) => u.id === id)
  );

  if (!user) {
    alert('ไม่พบผู้ใช้');
    return;
  }

  return openAdminUserEdit(user);
}

  const loc = e.target.closest('[data-location]');
  if (loc) return openLocationForm(state.locations.find((l) => l.id === Number(loc.dataset.location)));

  if (e.target.closest('#addProductBtn')) return openProductForm();
  if (e.target.closest('#addLocationBtn')) return openLocationForm();

  const chip = e.target.closest('#statusChips .chip[data-status]');
  if (chip) {
    state.filters.status = chip.dataset.status;
    $$('#statusChips .chip').forEach((c) => c.classList.toggle('is-active', c === chip));
    return loadProducts().then(renderProducts);
  }

  const hChip = e.target.closest('#historyChips .chip');
  if (hChip) {
    state.historyType = hChip.dataset.type;
    $$('#historyChips .chip').forEach((c) => c.classList.toggle('is-active', c === hChip));
    return renderHistory();
  }
});

let searchTimer;
$('#searchInput').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.filters.q = e.target.value.trim();
    loadProducts().then(renderProducts);
  }, 280);
});

$('#locationFilter').addEventListener('change', (e) => {
  state.filters.locationId = e.target.value;
  loadProducts().then(renderProducts);
});

// ค้นหาประวัติตามช่วงวันที่
$('#historySearchBtn').addEventListener('click', () => {
  const startDate = $('#historyStartDate').value;
  const endDate = $('#historyEndDate').value;

  // ตรวจสอบวันที่
  if (startDate && endDate && startDate > endDate) {
    alert('วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด');
    return;
  }

  // เก็บวันที่ไว้ใน state
  state.historyStartDate = startDate;
  state.historyEndDate = endDate;

  // โหลดประวัติใหม่
  renderHistory();
});
$('#historyPrintBtn').addEventListener('click', () => {
  const startDate = $('#historyStartDate').value;
  const endDate = $('#historyEndDate').value;

  const params = new URLSearchParams();

  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);

  window.open(`/print-history.html?${params.toString()}`, '_blank');
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet();
});
$('#loginBtn').addEventListener('click', async () => {
  const username = $('#loginUsername').value.trim();
  const password = $('#loginPassword').value;

  $('#loginError').hidden = true;
  $('#loginBtn').disabled = true;
  $('#loginBtn').textContent = 'กำลังเข้าสู่ระบบ...';

  try {
    const result = await api('/login', {
      method: 'POST',
      body: JSON.stringify({
        username,
        password,
      }),
    });

    state.me = result.user;
     
alert(JSON.stringify(result.user));

    paintUser();

    $('#loginScreen').hidden = true;
    $('#boot').hidden = true;
    $('#app').hidden = false;

    if (state.me.role === 'admin') {
  // Admin เข้าหน้าจัดการผู้ใช้ทันที
  await openAdminPage();
} else {
       
      // ผู้ใช้ทั่วไปเข้าระบบคลังสินค้าตามปกติ
      await refreshAll();
      applyDeepLink();
    }

  
     
  } catch (err) {
    $('#loginError').textContent =
      err.message || 'เข้าสู่ระบบไม่สำเร็จ';

    $('#loginError').hidden = false;
  } finally {
    $('#loginBtn').disabled = false;
    $('#loginBtn').textContent = 'เข้าสู่ระบบ';
  }
});
$('#logoutBtn').addEventListener('click', async () => {
  if (!confirm('ต้องการออกจากระบบหรือไม่?')) return;

  try {
    await api('/logout', {
      method: 'POST',
    });

    state.me = null;

    $('#app').hidden = true;
    $('#loginScreen').hidden = false;

    $('#loginUsername').value = '';
    $('#loginPassword').value = '';
    $('#loginError').hidden = true;

    $('#loginUsername').focus();
  } catch (err) {
    alert(err.message || 'ออกจากระบบไม่สำเร็จ');
  }
});

$('#saveProfileBtn').addEventListener('click', async () => {
  const username = $('#editUsername').value.trim();
  const displayName = $('#editDisplayName').value.trim();
  const message = $('#profileMessage');
  const btn = $('#saveProfileBtn');

  message.hidden = true;

  if (!username || !displayName) {
    message.textContent =
      'กรุณากรอกชื่อที่แสดงและชื่อผู้ใช้ให้ครบ';
    message.style.color = '#ef4444';
    message.hidden = false;
    return;
  }

  btn.disabled = true;
  btn.textContent = 'กำลังบันทึก...';

  try {
    const result = await api(
      `/users/${state.me.id}/profile`,
      {
        method: 'POST',
        body: JSON.stringify({
          username,
          displayName,
        }),
      },
    );

    state.me = result.user;
    paintUser();

    message.textContent =
      'บันทึกข้อมูลเรียบร้อยแล้ว';
    message.style.color = '#16a34a';
    message.hidden = false;

  } catch (err) {
    message.textContent =
      err.message || 'บันทึกข้อมูลไม่สำเร็จ';
    message.style.color = '#ef4444';
    message.hidden = false;

  } finally {
    btn.disabled = false;
    btn.textContent = '💾 บันทึกข้อมูล';
  }
});

$('#changePasswordBtn').addEventListener('click', async () => {
  const newPassword = $('#newPassword').value;
  const confirmPassword = $('#confirmPassword').value;
  const message = $('#changePasswordMessage');

  message.hidden = true;

  if (!newPassword || !confirmPassword) {
    message.textContent = 'กรุณากรอกรหัสผ่านใหม่ให้ครบ';
    message.style.color = '#ef4444';
    message.hidden = false;
    return;
  }

  if (newPassword !== confirmPassword) {
    message.textContent = 'รหัสผ่านใหม่ไม่ตรงกัน';
    message.style.color = '#ef4444';
    message.hidden = false;
    return;
  }

  if (newPassword.length < 6) {
    message.textContent = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
    message.style.color = '#ef4444';
    message.hidden = false;
    return;
  }

  const btn = $('#changePasswordBtn');
  btn.disabled = true;
  btn.textContent = 'กำลังเปลี่ยนรหัสผ่าน...';

  try {
    await api(`/users/${state.me.id}/password`, {
      method: 'POST',
      body: JSON.stringify({
        newPassword,
      }),
    });

    message.textContent = 'เปลี่ยนรหัสผ่านสำเร็จ';
    message.style.color = '#16a34a';
    message.hidden = false;

    $('#newPassword').value = '';
    $('#confirmPassword').value = '';

  } catch (err) {
    message.textContent =
      err.message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ';
    message.style.color = '#ef4444';
    message.hidden = false;

  } finally {
    btn.disabled = false;
    btn.textContent = '🔐 เปลี่ยนรหัสผ่าน';
  }
});

/* ------------------------------------------------------
   Admin — จัดการบัญชีผู้ใช้
------------------------------------------------------ */

$('#adminCreateUserBtn')?.addEventListener(
  'click',
  async () => {
    const username =
      $('#adminNewUsername').value.trim();

    const displayName =
      $('#adminNewDisplayName').value.trim();

    const password =
      $('#adminNewPassword').value;

    const role =
      $('#adminNewRole').value;

    const message =
      $('#adminCreateUserMessage');

    const btn =
      $('#adminCreateUserBtn');

    message.hidden = true;

    if (!username || !displayName || !password) {
      message.textContent =
        'กรุณากรอกข้อมูลให้ครบ';

      message.style.color = '#ef4444';
      message.hidden = false;
      return;
    }

    if (password.length < 6) {
      message.textContent =
        'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';

      message.style.color = '#ef4444';
      message.hidden = false;
      return;
    }

    btn.disabled = true;
    btn.textContent = 'กำลังสร้างบัญชี...';

    try {
      await api('/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          username,
          displayName,
          password,
          role,
        }),
      });

      message.textContent =
        'สร้างบัญชีผู้ใช้เรียบร้อยแล้ว';

      message.style.color = '#16a34a';
      message.hidden = false;

      $('#adminNewUsername').value = '';
      $('#adminNewDisplayName').value = '';
      $('#adminNewPassword').value = '';
      $('#adminNewRole').value = 'user';

      await refreshAdminUsers();

    } catch (err) {
      message.textContent =
        err.message ||
        'สร้างบัญชีผู้ใช้ไม่สำเร็จ';

      message.style.color = '#ef4444';
      message.hidden = false;

    } finally {
      btn.disabled = false;
      btn.textContent = '+ สร้างบัญชีผู้ใช้';
    }
  }
);


$('#adminRefreshUsersBtn')?.addEventListener(
  'click',
  () => refreshAdminUsers()
);


$('#adminLogoutBtn')?.addEventListener(
  'click',
  async () => {
    if (!confirm('ต้องการออกจากระบบหรือไม่?')) {
      return;
    }

    try {
      await api('/logout', {
        method: 'POST',
      });

      state.me = null;

      $('#app').hidden = true;
      $('#loginScreen').hidden = false;

      $('#loginUsername').value = '';
      $('#loginPassword').value = '';
      $('#loginError').hidden = true;

      $('#loginUsername').focus();

    } catch (err) {
      alert(
        err.message ||
        'ออกจากระบบไม่สำเร็จ'
      );
    }
  }
);

/* ------------------------------------------------------
   แสดง / ซ่อนรหัสผ่าน
------------------------------------------------------ */

$$('.password-toggle').forEach((button) => {
  button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.target);

    if (!input) return;

    if (input.type === 'password') {
      input.type = 'text';
      button.textContent = '🙈';
      button.setAttribute('aria-label', 'ซ่อนรหัสผ่าน');
    } else {
      input.type = 'password';
      button.textContent = '👁️';
      button.setAttribute('aria-label', 'แสดงรหัสผ่าน');
    }
  });
});


boot();
