/* ============================================================
   Stock — History Page
   ============================================================ */

const API_BASE = '/api';

/* ------------------------------------------------------------
   Helpers
------------------------------------------------------------ */

const $ = (sel, root = document) =>
  root.querySelector(sel);

const $$ = (sel, root = document) =>
  [...root.querySelectorAll(sel)];

const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[c]
  );

const fmt = (n) => {
  const v =
    Math.round((Number(n) || 0) * 1000) / 1000;

  return v.toLocaleString('th-TH', {
    maximumFractionDigits: 3,
  });
};

/* ------------------------------------------------------------
   API
------------------------------------------------------------ */

async function api(path, options = {}) {
  const headers = {
    'content-type': 'application/json',
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'same-origin',
  });

  const data =
    await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(
      data.error ||
      `เกิดข้อผิดพลาด (${res.status})`
    );

    error.status = res.status;

    throw error;
  }

  return data;
}

/* ------------------------------------------------------------
   วันที่ / เวลา
------------------------------------------------------------ */

function formatDateTime(sqlDate) {
  if (!sqlDate) return '-';

  const d = new Date(
    String(sqlDate).replace(' ', 'T') + 'Z'
  );

  if (Number.isNaN(d.getTime())) {
    return sqlDate;
  }

  return d.toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDefaultDates() {
  const now = new Date();

  const firstDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );

  const lastDay = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0
  );

  const pad = (n) =>
    String(n).padStart(2, '0');

  const start =
    `${firstDay.getFullYear()}-` +
    `${pad(firstDay.getMonth() + 1)}-` +
    `${pad(firstDay.getDate())}`;

  const end =
    `${lastDay.getFullYear()}-` +
    `${pad(lastDay.getMonth() + 1)}-` +
    `${pad(lastDay.getDate())}`;

  return { start, end };
}

/* ------------------------------------------------------------
   ประเภทการเคลื่อนไหว
------------------------------------------------------------ */

const MOVE_META = {
  issue: {
    label: 'เบิกออก',
    icon: '📤',
    cls: 'issue',
  },

  receive: {
    label: 'รับเข้า',
    icon: '📥',
    cls: 'receive',
  },

  adjust: {
    label: 'ปรับยอด',
    icon: '⚖️',
    cls: 'adjust',
  },

  transfer_out: {
    label: 'ย้ายออก',
    icon: '🔁',
    cls: 'transfer',
  },

  transfer_in: {
    label: 'ย้ายเข้า',
    icon: '🔁',
    cls: 'transfer',
  },

  archive: {
    label: 'สินค้าออกจากระบบ',
    icon: '🗑️',
    cls: 'archive',
  },
};

/* ------------------------------------------------------------
   แสดงรายการ 1 รายการ
------------------------------------------------------------ */

function movementRow(m) {

  const isInitialAdd =
    m.type === 'receive' &&
    m.note === 'จำนวนเริ่มต้นตอนเพิ่มสินค้า';

  const meta = isInitialAdd
    ? {
        label: 'เพิ่มเข้า',
        icon: '🆕',
        cls: 'receive',
      }
    : (
        MOVE_META[m.type] || {
          label: m.type || '-',
          icon: '•',
          cls: '',
        }
      );

  const delta =
    Number(m.delta) || 0;

  const positive = delta > 0;

  const deltaColor =
    positive
      ? 'var(--receive)'
      : 'var(--issue)';

  return `
    <div class="history-row">

      <div class="history-row__icon">
        ${meta.icon}
      </div>

      <div>

        <div class="history-row__name">
          ${esc(m.product_name || '-')}
        </div>

        <div class="history-row__meta">

          ${esc(meta.label)}

          · ${esc(m.location_name || '-')}

          · ${formatDateTime(m.created_at)}

          ${
            m.actor_name
              ? ` · ${esc(m.actor_name)}`
              : ''
          }

          ${
            m.note && !isInitialAdd
              ? ` · ${esc(m.note)}`
              : ''
          }

        </div>

        ${
          m.ref || m.sku
            ? `
              <div class="history-row__meta">

                ${
                  m.ref
                    ? `เลขที่: ${esc(m.ref)}`
                    : ''
                }

                ${
                  m.ref && m.sku
                    ? ' · '
                    : ''
                }

                ${
                  m.sku
                    ? `SKU: ${esc(m.sku)}`
                    : ''
                }

              </div>
            `
            : ''
        }

      </div>

      <div class="history-row__right">

        <div
          class="history-row__delta"
          style="color:${deltaColor}"
        >
          ${positive ? '+' : ''}
          ${fmt(delta)}
        </div>

        <div class="history-row__balance">

          เหลือ ${fmt(m.balance_after)}

          ${
            m.unit
              ? ` ${esc(m.unit)}`
              : ''
          }

        </div>

      </div>

    </div>
  `;
}

/* ------------------------------------------------------------
   ตรวจประเภท
------------------------------------------------------------ */

function isInitialAdd(row) {
  return (
    row.type === 'receive' &&
    row.note === 'จำนวนเริ่มต้นตอนเพิ่มสินค้า'
  );
}

function filterByType(rows, type) {

  if (type === 'all') {
    return rows;
  }

  if (type === 'initial') {
    return rows.filter(isInitialAdd);
  }

  if (type === 'receive') {
    return rows.filter(
      (r) =>
        r.type === 'receive' &&
        !isInitialAdd(r)
    );
  }

  if (type === 'transfer') {
    return rows.filter(
      (r) =>
        r.type === 'transfer_in' ||
        r.type === 'transfer_out'
    );
  }

  return rows.filter(
    (r) => r.type === type
  );
}

/* ------------------------------------------------------------
   ค้นหาข้อความ
------------------------------------------------------------ */

function filterBySearch(rows, keyword) {

  const q =
    String(keyword || '')
      .trim()
      .toLowerCase();

  if (!q) {
    return rows;
  }

  return rows.filter((r) => {

    const text = [
      r.product_name,
      r.sku,
      r.location_name,
      r.actor_name,
      r.note,
      r.ref,
      r.type,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return text.includes(q);
  });
}

/* ------------------------------------------------------------
   สรุปผล
------------------------------------------------------------ */

function updateSummary(rows) {

  const totalEl =
    $('#totalCount');

  const receiveEl =
    $('#receiveCount');

  const issueEl =
    $('#issueCount');

  const countEl =
    $('#historyCount');

  if (totalEl) {
    totalEl.textContent =
      rows.length.toLocaleString('th-TH');
  }

  let receiveCount = 0;
  let issueCount = 0;

  rows.forEach((r) => {

    const delta =
      Number(r.delta) || 0;

    if (
      r.type === 'receive' ||
      r.type === 'transfer_in' ||
      (r.type === 'receive' && isInitialAdd(r))
    ) {
      receiveCount += Math.abs(delta);
    }

    if (
      r.type === 'issue' ||
      r.type === 'transfer_out'
    ) {
      issueCount += Math.abs(delta);
    }

  });

  if (receiveEl) {
    receiveEl.textContent =
      fmt(receiveCount);
  }

  if (issueEl) {
    issueEl.textContent =
      fmt(issueCount);
  }

  if (countEl) {
    countEl.textContent =
      `${rows.length.toLocaleString('th-TH')} รายการ`;
  }
}

/* ------------------------------------------------------------
   โหลดประวัติ
------------------------------------------------------------ */

async function loadHistory() {

  const list =
    $('#historyResults');

  if (!list) {
    console.error(
      'ไม่พบ #historyResults ใน history.html'
    );
    return;
  }

  list.innerHTML = `
    <div class="history-empty">
      กำลังโหลดข้อมูล...
    </div>
  `;

  try {

    const defaults =
      getDefaultDates();

    const startInput =
      $('#startDate');

    const endInput =
      $('#endDate');

    const searchInput =
      $('#searchInput');

    const params =
      new URLSearchParams(
        window.location.search
      );

    const startDate =
      startInput?.value ||
      params.get('startDate') ||
      defaults.start;

    const endDate =
      endInput?.value ||
      params.get('endDate') ||
      defaults.end;

    const keyword =
      searchInput?.value ||
      params.get('q') ||
      '';

    const activeChip =
      $('#historyTypes .chip.is-active');

    const type =
      activeChip?.dataset.type ||
      params.get('type') ||
      'all';

    if (startInput) {
      startInput.value =
        startDate;
    }

    if (endInput) {
      endInput.value =
        endDate;
    }

    if (searchInput) {
      searchInput.value =
        keyword;
    }

    /* --------------------------------------------------------
       เรียก API
    -------------------------------------------------------- */

    console.log(
      'โหลดประวัติ:',
      startDate,
      endDate
    );

    const rows =
      await api(
        `/movements?` +
        `startDate=${encodeURIComponent(startDate)}` +
        `&endDate=${encodeURIComponent(endDate)}` +
        `&limit=100`
      );

    console.log(
      'ข้อมูลประวัติ:',
      rows
    );

    /* --------------------------------------------------------
       กรองประเภท
    -------------------------------------------------------- */

    let filtered =
      filterByType(rows, type);

    /* --------------------------------------------------------
       ค้นหาข้อความ
    -------------------------------------------------------- */

    filtered =
      filterBySearch(
        filtered,
        keyword
      );

    /* --------------------------------------------------------
       สรุป
    -------------------------------------------------------- */

    updateSummary(filtered);

    /* --------------------------------------------------------
       แสดงรายการ
    -------------------------------------------------------- */

    if (!filtered.length) {

      list.innerHTML = `
        <div class="history-empty">
          ไม่มีรายการที่ตรงกับเงื่อนไข
        </div>
      `;

      return;
    }

    list.innerHTML =
      filtered
        .map(movementRow)
        .join('');

  } catch (err) {

    console.error(
      'loadHistory error:',
      err
    );

    list.innerHTML = `
      <div
        class="history-empty"
        style="color:var(--danger)"
      >
        โหลดประวัติไม่สำเร็จ
        <br>
        <small>
          ${esc(err.message)}
        </small>
      </div>
    `;

    updateSummary([]);
  }
}

/* ------------------------------------------------------------
   อัปเดต URL
------------------------------------------------------------ */

function updateUrl() {

  const params =
    new URLSearchParams();

  const start =
    $('#startDate')?.value;

  const end =
    $('#endDate')?.value;

  const keyword =
    $('#searchInput')?.value.trim();

  const chip =
    $('#historyTypes .chip.is-active');

  const type =
    chip?.dataset.type || 'all';

  if (start) {
    params.set(
      'startDate',
      start
    );
  }

  if (end) {
    params.set(
      'endDate',
      end
    );
  }

  if (keyword) {
    params.set(
      'q',
      keyword
    );
  }

  if (type !== 'all') {
    params.set(
      'type',
      type
    );
  }

  const query =
    params.toString();

  window.history.replaceState(
    {},
    '',
    query
      ? `${location.pathname}?${query}`
      : location.pathname
  );
}

/* ------------------------------------------------------------
   ค้นหา
------------------------------------------------------------ */

function searchHistory() {

  updateUrl();

  loadHistory();
}

/* ------------------------------------------------------------
   ล้างการค้นหา
------------------------------------------------------------ */

function clearHistorySearch() {

  const defaults =
    getDefaultDates();

  const start =
    $('#startDate');

  const end =
    $('#endDate');

  const search =
    $('#searchInput');

  if (start) {
    start.value =
      defaults.start;
  }

  if (end) {
    end.value =
      defaults.end;
  }

  if (search) {
    search.value = '';
  }

  $$('#historyTypes .chip')
    .forEach((chip) => {

      chip.classList.toggle(
        'is-active',
        chip.dataset.type === 'all'
      );

    });

  updateUrl();

  loadHistory();
}

/* ------------------------------------------------------------
   เลือกประเภท
------------------------------------------------------------ */

function selectHistoryType(button) {

  $$('#historyTypes .chip')
    .forEach((chip) => {

      chip.classList.toggle(
        'is-active',
        chip === button
      );

    });

  updateUrl();

  loadHistory();
}

/* ------------------------------------------------------------
   พิมพ์รายงาน
------------------------------------------------------------ */

function printHistory() {

  window.print();

}

/* ------------------------------------------------------------
   กลับ Dashboard
------------------------------------------------------------ */

function goBack() {

  if (document.referrer) {
    history.back();
    return;
  }

  window.location.href = '/';
}

/* ------------------------------------------------------------
   Event
------------------------------------------------------------ */

document.addEventListener(
  'DOMContentLoaded',
  () => {

    /* วันที่ */

    $('#startDate')
      ?.addEventListener(
        'change',
        searchHistory
      );

    $('#endDate')
      ?.addEventListener(
        'change',
        searchHistory
      );

    /* ค้นหา */

    $('#searchInput')
      ?.addEventListener(
        'input',
        () => {

          clearTimeout(
            window.historySearchTimer
          );

          window.historySearchTimer =
            setTimeout(
              searchHistory,
              350
            );

        }
      );

    /* ประเภท */

    $$('#historyTypes .chip')
      .forEach((button) => {

        button.addEventListener(
          'click',
          () => {
            selectHistoryType(button);
          }
        );

      });

    /* ล้าง */

    $('#clearBtn')
      ?.addEventListener(
        'click',
        clearHistorySearch
      );

    /* พิมพ์ */

    $('#printBtn')
      ?.addEventListener(
        'click',
        printHistory
      );

    /* กลับ */

    $('#backBtn')
      ?.addEventListener(
        'click',
        goBack
      );

    /* --------------------------------------------------------
       โหลดครั้งแรก
    -------------------------------------------------------- */

    loadHistory();

  }
);
