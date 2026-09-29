/* ============================================================
   Stock — History Page
   ============================================================ */

const API_BASE = '/api';

/* ------------------------------------------------------------
   Helpers
------------------------------------------------------------ */

const $ = (sel, root = document) =>
  root.querySelector(sel);

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
   เวลา
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
    second: '2-digit',
  });
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
   แสดงรายการ
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
          label: m.type,
          icon: '•',
          cls: '',
        }
      );

  const delta =
    Number(m.delta) || 0;

  const positive = delta > 0;

  return `
    <div class="tl">

      <div class="tl__icon badge--${meta.cls}">
        ${meta.icon}
      </div>

      <div class="tl__main">

        <div class="tl__name">
          ${esc(m.product_name)}
        </div>

        <div class="tl__meta">

          ${meta.label}

          · ${esc(m.location_name || '-')}

          · ${formatDateTime(m.created_at)}

          ${m.actor_name
            ? ` · ${esc(m.actor_name)}`
            : ''
          }

          ${m.note && !isInitialAdd
            ? ` · ${esc(m.note)}`
            : ''
          }

        </div>

        <div class="history-extra">

          ${m.ref
            ? `<span>เลขที่: ${esc(m.ref)}</span>`
            : ''
          }

          ${m.sku
            ? `<span>SKU: ${esc(m.sku)}</span>`
            : ''
          }

        </div>

      </div>

      <div class="tl__amount">

        <div
          class="tl__delta"
          style="
            color: var(
              --${positive
                ? 'receive'
                : 'issue'}
            );
          "
        >
          ${positive ? '+' : ''}
          ${fmt(delta)}
        </div>

        <div class="tl__balance">
          เหลือ ${fmt(m.balance_after)}
          ${m.unit
            ? ` ${esc(m.unit)}`
            : ''
          }
        </div>

      </div>

    </div>
  `;
}

/* ------------------------------------------------------------
   โหลดประวัติ
------------------------------------------------------------ */

async function loadHistory() {

  const list =
    $('#historyList');

  if (!list) {
    console.error(
      'ไม่พบ #historyList ใน history.html'
    );
    return;
  }

  list.innerHTML = `
    <div class="skeleton"></div>
  `;

  try {

    /* --------------------------------------------------------
       รับวันที่จาก URL
       ตัวอย่าง:
       history.html?startDate=2026-09-01&endDate=2026-09-28
    -------------------------------------------------------- */

    const params =
      new URLSearchParams(
        window.location.search
      );

    const now =
      new Date();

    const firstDay =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      );

    const lastDay =
      new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0
      );

    const pad =
      (n) =>
        String(n).padStart(2, '0');

    const defaultStart =
      `${firstDay.getFullYear()}-` +
      `${pad(firstDay.getMonth() + 1)}-` +
      `${pad(firstDay.getDate())}`;

    const defaultEnd =
      `${lastDay.getFullYear()}-` +
      `${pad(lastDay.getMonth() + 1)}-` +
      `${pad(lastDay.getDate())}`;

    const startDate =
      params.get('startDate') ||
      defaultStart;

    const endDate =
      params.get('endDate') ||
      defaultEnd;

    /* --------------------------------------------------------
       แสดงวันที่บนหน้า
    -------------------------------------------------------- */

    const startInput =
      $('#startDate');

    const endInput =
      $('#endDate');

    if (startInput) {
      startInput.value =
        startDate;
    }

    if (endInput) {
      endInput.value =
        endDate;
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

    const type =
      params.get('type') || 'all';

    let filtered =
      rows;

    if (type !== 'all') {

      filtered =
        rows.filter((r) => {

          const isInitialAdd =
            r.type === 'receive' &&
            r.note ===
              'จำนวนเริ่มต้นตอนเพิ่มสินค้า';

          if (type === 'initial') {
            return isInitialAdd;
          }

          if (type === 'receive') {
            return (
              r.type === 'receive' &&
              !isInitialAdd
            );
          }

          if (type === 'transfer') {
            return (
              r.type === 'transfer_in' ||
              r.type === 'transfer_out'
            );
          }

          return (
            r.type === type
          );
        });
    }

    /* --------------------------------------------------------
       แสดงผล
    -------------------------------------------------------- */

    if (!filtered.length) {

      list.innerHTML = `
        <div class="empty">
          ไม่มีรายการในช่วงวันที่นี้
        </div>
      `;

      updateCount(0);

      return;
    }

    list.innerHTML =
      filtered
        .map(movementRow)
        .join('');

    updateCount(
      filtered.length
    );

  } catch (err) {

    console.error(
      'loadHistory error:',
      err
    );

    list.innerHTML = `
      <div
        class="empty"
        style="color:var(--danger)"
      >
        โหลดประวัติไม่สำเร็จ
        <br>
        <small>
          ${esc(err.message)}
        </small>
      </div>
    `;

    updateCount(0);
  }
}

/* ------------------------------------------------------------
   จำนวนรายการ
------------------------------------------------------------ */

function updateCount(count) {

  const el =
    $('#historyCount');

  if (!el) return;

  el.textContent =
    `ทั้งหมด ${count.toLocaleString('th-TH')} รายการ`;
}

/* ------------------------------------------------------------
   ค้นหาตามวันที่
------------------------------------------------------------ */

function searchHistory() {

  const start =
    $('#startDate')?.value;

  const end =
    $('#endDate')?.value;

  const type =
    $('#historyType')?.value ||
    'all';

  const params =
    new URLSearchParams();

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

  params.set(
    'type',
    type
  );

  window.history.replaceState(
    {},
    '',
    `${location.pathname}?${params.toString()}`
  );

  loadHistory();
}

/* ------------------------------------------------------------
   พิมพ์
------------------------------------------------------------ */

function printHistory() {

  window.print();

}

/* ------------------------------------------------------------
   ปุ่ม
------------------------------------------------------------ */

document.addEventListener(
  'DOMContentLoaded',
  () => {

    $('#searchHistoryBtn')
      ?.addEventListener(
        'click',
        searchHistory
      );

    $('#printHistoryBtn')
      ?.addEventListener(
        'click',
        printHistory
      );

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

    $('#historyType')
      ?.addEventListener(
        'change',
        searchHistory
      );

    $('#reloadHistoryBtn')
      ?.addEventListener(
        'click',
        loadHistory
      );

    /* --------------------------------------------------------
       โหลดครั้งแรก
    -------------------------------------------------------- */

    loadHistory();

  }
);
