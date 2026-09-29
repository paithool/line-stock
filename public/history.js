/* ============================================================
   Stock — History Page
   history.html compatible version
   ============================================================ */

const API_BASE = '/api';

/* ============================================================
   HELPERS
   ============================================================ */

const $ = (selector, root = document) =>
  root.querySelector(selector);

const $$ = (selector, root = document) =>
  Array.from(root.querySelectorAll(selector));

function esc(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[char]
  );
}

function fmt(value) {
  const number =
    Math.round((Number(value) || 0) * 1000) / 1000;

  return number.toLocaleString('th-TH', {
    maximumFractionDigits: 3,
  });
}

/* ============================================================
   API
   ============================================================ */

async function api(path, options = {}) {

  const headers = {
    'content-type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(
    `${API_BASE}${path}`,
    {
      ...options,
      headers,
      credentials: 'same-origin',
    }
  );

  const data =
    await response.json().catch(() => ({}));

  if (!response.ok) {

    const error = new Error(
      data.error ||
      `เกิดข้อผิดพลาด (${response.status})`
    );

    error.status = response.status;

    throw error;
  }

  return data;
}

/* ============================================================
   DATE / TIME
   ============================================================ */

function formatDateTime(value) {

  if (!value) {
    return '-';
  }

  const date = new Date(
    String(value).replace(' ', 'T') + 'Z'
  );

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(
    'th-TH',
    {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }
  );
}

function getCurrentMonthDates() {

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

  const pad = (number) =>
    String(number).padStart(2, '0');

  const start =
    `${firstDay.getFullYear()}-` +
    `${pad(firstDay.getMonth() + 1)}-` +
    `${pad(firstDay.getDate())}`;

  const end =
    `${lastDay.getFullYear()}-` +
    `${pad(lastDay.getMonth() + 1)}-` +
    `${pad(lastDay.getDate())}`;

  return {
    start,
    end,
  };
}

/* ============================================================
   MOVEMENT META
   ============================================================ */

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

/* ============================================================
   CHECK INITIAL ADD
   ============================================================ */

function isInitialAdd(movement) {

  return (
    movement.type === 'receive' &&
    movement.note === 'จำนวนเริ่มต้นตอนเพิ่มสินค้า'
  );
}

/* ============================================================
   MOVEMENT ROW
   ============================================================ */

function movementRow(movement) {

  const initialAdd =
    isInitialAdd(movement);

  const meta =
    initialAdd
      ? {
          label: 'เพิ่มเข้า',
          icon: '🆕',
          cls: 'receive',
        }
      : (
          MOVE_META[movement.type] || {
            label: movement.type || '-',
            icon: '•',
            cls: '',
          }
        );

  const delta =
    Number(movement.delta) || 0;

  const positive =
    delta > 0;

  return `
    <div class="history-row">

      <div class="history-row__icon badge--${esc(meta.cls)}">
        ${meta.icon}
      </div>

      <div>

        <div class="history-row__name">
          ${esc(movement.product_name || '-')}
        </div>

        <div class="history-row__meta">

          ${esc(meta.label)}

          · ${esc(movement.location_name || '-')}

          · ${formatDateTime(movement.created_at)}

          ${
            movement.actor_name
              ? ` · ${esc(movement.actor_name)}`
              : ''
          }

          ${
            movement.note && !initialAdd
              ? ` · ${esc(movement.note)}`
              : ''
          }

        </div>

        ${
          movement.ref || movement.sku
            ? `
              <div class="history-row__meta">

                ${
                  movement.ref
                    ? `เลขที่: ${esc(movement.ref)}`
                    : ''
                }

                ${
                  movement.ref && movement.sku
                    ? ' · '
                    : ''
                }

                ${
                  movement.sku
                    ? `SKU: ${esc(movement.sku)}`
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
          style="
            color: ${
              positive
                ? 'var(--receive, #16a34a)'
                : 'var(--issue, #dc2626)'
            };
          "
        >
          ${positive ? '+' : ''}
          ${fmt(delta)}
        </div>

        <div class="history-row__balance">

          เหลือ ${fmt(movement.balance_after)}

          ${
            movement.unit
              ? ` ${esc(movement.unit)}`
              : ''
          }

        </div>

      </div>

    </div>
  `;
}

/* ============================================================
   CURRENT FILTER
   ============================================================ */

function getSelectedType() {

  const active =
    $('#historyTypes .chip.is-active');

  return active?.dataset.type || 'all';
}

/* ============================================================
   FILTER BY TYPE
   ============================================================ */

function filterByType(rows, type) {

  if (type === 'all') {
    return rows;
  }

  return rows.filter((row) => {

    const initialAdd =
      isInitialAdd(row);

    /* เพิ่มเข้า */
    if (type === 'initial') {
      return initialAdd;
    }

    /* รับเข้า */
    if (type === 'receive') {
      return (
        row.type === 'receive' &&
        !initialAdd
      );
    }

    /* ย้ายคลัง */
    if (type === 'transfer') {
      return (
        row.type === 'transfer_in' ||
        row.type === 'transfer_out'
      );
    }

    /* ประเภทอื่น */
    return row.type === type;
  });
}

/* ============================================================
   SEARCH TEXT
   ============================================================ */

function filterBySearch(rows) {

  const input =
    $('#searchInput');

  const keyword =
    input?.value
      ?.trim()
      .toLowerCase() || '';

  if (!keyword) {
    return rows;
  }

  return rows.filter((row) => {

    const text = [

      row.product_name,
      row.sku,
      row.location_name,
      row.actor_name,
      row.note,
      row.ref,
      row.type,

    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return text.includes(keyword);
  });
}

/* ============================================================
   RENDER SUMMARY
   ============================================================ */

function updateSummary(rows) {

  const total =
    $('#totalCount');

  const receive =
    $('#receiveCount');

  const issue =
    $('#issueCount');

  if (total) {
    total.textContent =
      rows.length.toLocaleString('th-TH');
  }

  if (receive) {

    const receiveTotal =
      rows.filter((row) => {

        return (
          row.type === 'receive' ||
          row.type === 'transfer_in' ||
          isInitialAdd(row)
        );

      }).length;

    receive.textContent =
      receiveTotal.toLocaleString('th-TH');
  }

  if (issue) {

    const issueTotal =
      rows.filter((row) => {

        return (
          row.type === 'issue' ||
          row.type === 'transfer_out'
        );

      }).length;

    issue.textContent =
      issueTotal.toLocaleString('th-TH');
  }
}

/* ============================================================
   UPDATE LIST COUNT
   ============================================================ */

function updateCount(count) {

  const element =
    $('#historyCount');

  if (!element) {
    return;
  }

  element.textContent =
    `${count.toLocaleString('th-TH')} รายการ`;
}

/* ============================================================
   RENDER HISTORY
   ============================================================ */

function renderHistory(rows) {

  const list =
    $('#historyResults');

  if (!list) {

    console.error(
      'ไม่พบ #historyResults ใน history.html'
    );

    return;
  }

  /* ----------------------------------------------------------
     กรองประเภท
     ---------------------------------------------------------- */

  let filtered =
    filterByType(
      rows,
      getSelectedType()
    );

  /* ----------------------------------------------------------
     กรองคำค้นหา
     ---------------------------------------------------------- */

  filtered =
    filterBySearch(filtered);

  /* ----------------------------------------------------------
     อัปเดตสรุป
     ---------------------------------------------------------- */

  updateSummary(filtered);

  updateCount(filtered.length);

  /* ----------------------------------------------------------
     ไม่มีรายการ
     ---------------------------------------------------------- */

  if (!filtered.length) {

    list.innerHTML = `
      <div class="history-empty">
        ไม่พบรายการที่ค้นหา
      </div>
    `;

    return;
  }

  /* ----------------------------------------------------------
     แสดงรายการ
     ---------------------------------------------------------- */

  list.innerHTML =
    filtered
      .map(movementRow)
      .join('');
}

/* ============================================================
   LOAD HISTORY
   ============================================================ */

async function loadHistory() {

  const list =
    $('#historyResults');

  if (!list) {

    console.error(
      'ไม่พบ #historyResults ใน history.html'
    );

    return;
  }

  /* ----------------------------------------------------------
     Loading
     ---------------------------------------------------------- */

  list.innerHTML = `
    <div class="history-empty">
      กำลังโหลดข้อมูล...
    </div>
  `;

  try {

    /* --------------------------------------------------------
       วันที่
       -------------------------------------------------------- */

    const dates =
      getCurrentMonthDates();

    const startInput =
      $('#startDate');

    const endInput =
      $('#endDate');

    if (startInput && !startInput.value) {
      startInput.value =
        dates.start;
    }

    if (endInput && !endInput.value) {
      endInput.value =
        dates.end;
    }

    const startDate =
      startInput?.value ||
      dates.start;

    const endDate =
      endInput?.value ||
      dates.end;

    /* --------------------------------------------------------
       API
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
      'ข้อมูลประวัติจาก API:',
      rows
    );

    /* --------------------------------------------------------
       ตรวจรูปแบบข้อมูล
       -------------------------------------------------------- */

    const historyRows =
      Array.isArray(rows)
        ? rows
        : (
            Array.isArray(rows?.rows)
              ? rows.rows
              : (
                  Array.isArray(rows?.data)
                    ? rows.data
                    : []
                )
          );

    console.log(
      'รายการที่นำมาแสดง:',
      historyRows
    );

    /* --------------------------------------------------------
       เก็บข้อมูลไว้
       -------------------------------------------------------- */

    window.historyRows =
      historyRows;

    /* --------------------------------------------------------
       แสดงผล
       -------------------------------------------------------- */

    renderHistory(historyRows);

  } catch (error) {

    console.error(
      'loadHistory error:',
      error
    );

    updateSummary([]);
    updateCount(0);

    list.innerHTML = `
      <div
        class="history-empty"
        style="color:var(--danger,#dc2626)"
      >

        โหลดประวัติไม่สำเร็จ

        <br>

        <small>
          ${esc(error.message)}
        </small>

      </div>
    `;
  }
}

/* ============================================================
   APPLY FILTER
   ============================================================ */

function applyFilter() {

  const rows =
    window.historyRows || [];

  renderHistory(rows);
}

/* ============================================================
   CLEAR SEARCH
   ============================================================ */

function clearSearch() {

  const search =
    $('#searchInput');

  if (search) {
    search.value = '';
  }

  /* กลับเป็นทั้งหมด */

  $$('#historyTypes .chip')
    .forEach((chip) => {

      chip.classList.toggle(
        'is-active',
        chip.dataset.type === 'all'
      );

    });

  /* โหลดข้อมูลใหม่ตามวันที่ */

  loadHistory();
}

/* ============================================================
   PRINT
   ============================================================ */

function printHistory() {

  window.print();
}

/* ============================================================
   BACK
   ============================================================ */

function goBack() {

  if (
    document.referrer &&
    document.referrer.includes(
      window.location.host
    )
  ) {

    window.history.back();

    return;
  }

  window.location.href =
    '/';
}

/* ============================================================
   INIT
   ============================================================ */

document.addEventListener(
  'DOMContentLoaded',
  () => {

    console.log(
      'History page started'
    );

    /* --------------------------------------------------------
       ปุ่มย้อนกลับ
       -------------------------------------------------------- */

    $('#backBtn')
      ?.addEventListener(
        'click',
        goBack
      );

    /* --------------------------------------------------------
       ปุ่มล้างการค้นหา
       -------------------------------------------------------- */

    $('#clearBtn')
      ?.addEventListener(
        'click',
        clearSearch
      );

    /* --------------------------------------------------------
       ปุ่มพิมพ์
       -------------------------------------------------------- */

    $('#printBtn')
      ?.addEventListener(
        'click',
        printHistory
      );

    /* --------------------------------------------------------
       ค้นหาข้อความ
       -------------------------------------------------------- */

    $('#searchInput')
      ?.addEventListener(
        'input',
        applyFilter
      );

    /* --------------------------------------------------------
       เปลี่ยนวันที่
       -------------------------------------------------------- */

    $('#startDate')
      ?.addEventListener(
        'change',
        loadHistory
      );

    $('#endDate')
      ?.addEventListener(
        'change',
        loadHistory
      );

    /* --------------------------------------------------------
       ปุ่มประเภท
       -------------------------------------------------------- */

    $$('#historyTypes .chip')
      .forEach((chip) => {

        chip.addEventListener(
          'click',
          () => {

            /* เปลี่ยนปุ่ม active */

            $$('#historyTypes .chip')
              .forEach((item) => {

                item.classList.remove(
                  'is-active'
                );

              });

            chip.classList.add(
              'is-active'
            );

            /* แสดงรายการทันที */

            applyFilter();
          }
        );

      });

    /* --------------------------------------------------------
       โหลดข้อมูลครั้งแรก
       -------------------------------------------------------- */

    loadHistory();

  }
);
