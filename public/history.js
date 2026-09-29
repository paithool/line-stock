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
  [...root.querySelectorAll(selector)];

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
   DATE
   ============================================================ */

function formatDateTime(value) {

  if (!value) {
    return '-';
  }

  const raw =
    String(value);

  const date =
    new Date(
      raw.includes('T')
        ? raw
        : raw.replace(' ', 'T') + 'Z'
    );

  if (Number.isNaN(date.getTime())) {
    return raw;
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

/* ============================================================
   MOVE TYPE
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
   INITIAL ADD
   ============================================================ */

function isInitialAdd(row) {

  return (
    row.type === 'receive' &&
    row.note === 'จำนวนเริ่มต้นตอนเพิ่มสินค้า'
  );
}

/* ============================================================
   GET TYPE META
   ============================================================ */

function getMoveMeta(row) {

  if (isInitialAdd(row)) {

    return {
      label: 'เพิ่มเข้า',
      icon: '🆕',
      cls: 'receive',
    };
  }

  return (
    MOVE_META[row.type] || {
      label: row.type || '-',
      icon: '•',
      cls: '',
    }
  );
}

/* ============================================================
   MOVEMENT ROW
   ============================================================ */

function movementRow(row) {

  const meta =
    getMoveMeta(row);

  const delta =
    Number(row.delta) || 0;

  const positive =
    delta > 0;

  const amountColor =
    positive
      ? 'var(--receive, #16a34a)'
      : 'var(--issue, #dc2626)';

  return `
    <div class="history-row">

      <div class="history-row__icon">
        ${meta.icon}
      </div>

      <div>

        <div class="history-row__name">
          ${esc(
            row.product_name ||
            row.productName ||
            '-'
          )}
        </div>

        <div class="history-row__meta">

          ${esc(meta.label)}

          ·

          ${esc(
            row.location_name ||
            row.locationName ||
            '-'
          )}

          ·

          ${formatDateTime(
            row.created_at ||
            row.createdAt
          )}

          ${
            row.actor_name
              ? ` · ${esc(row.actor_name)}`
              : ''
          }

          ${
            row.note && !isInitialAdd(row)
              ? ` · ${esc(row.note)}`
              : ''
          }

        </div>

        ${
          row.ref ||
          row.sku
            ? `
              <div class="history-row__meta">

                ${
                  row.ref
                    ? `เลขที่: ${esc(row.ref)}`
                    : ''
                }

                ${
                  row.ref && row.sku
                    ? ' · '
                    : ''
                }

                ${
                  row.sku
                    ? `SKU: ${esc(row.sku)}`
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
          style="color:${amountColor}"
        >
          ${positive ? '+' : ''}
          ${fmt(delta)}
        </div>

        <div class="history-row__balance">

          เหลือ

          ${fmt(
            row.balance_after ??
            row.balanceAfter ??
            0
          )}

          ${
            row.unit
              ? ` ${esc(row.unit)}`
              : ''
          }

        </div>

      </div>

    </div>
  `;
}

/* ============================================================
   DEFAULT DATE
   ============================================================ */

function getDefaultDates() {

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
    (number) =>
      String(number).padStart(2, '0');

  return {

    start:
      `${firstDay.getFullYear()}-` +
      `${pad(firstDay.getMonth() + 1)}-` +
      `${pad(firstDay.getDate())}`,

    end:
      `${lastDay.getFullYear()}-` +
      `${pad(lastDay.getMonth() + 1)}-` +
      `${pad(lastDay.getDate())}`,

  };
}

/* ============================================================
   GET SEARCH VALUES
   ============================================================ */

function getSearchValues() {

  return {

    startDate:
      $('#startDate')?.value || '',

    endDate:
      $('#endDate')?.value || '',

    search:
      $('#searchInput')?.value
        .trim()
        .toLowerCase() || '',

    type:
      $('.history-type-row .chip.is-active')
        ?.dataset.type || 'all',

  };
}

/* ============================================================
   FILTER TYPE
   ============================================================ */

function filterByType(rows, type) {

  if (type === 'all') {
    return rows;
  }

  return rows.filter((row) => {

    const initial =
      isInitialAdd(row);

    if (type === 'initial') {
      return initial;
    }

    if (type === 'receive') {

      return (
        row.type === 'receive' &&
        !initial
      );
    }

    if (type === 'transfer') {

      return (
        row.type === 'transfer_in' ||
        row.type === 'transfer_out'
      );
    }

    return row.type === type;
  });
}

/* ============================================================
   TEXT SEARCH
   ============================================================ */

function filterBySearch(rows, keyword) {

  if (!keyword) {
    return rows;
  }

  return rows.filter((row) => {

    const text = [

      row.product_name,
      row.productName,

      row.sku,

      row.location_name,
      row.locationName,

      row.actor_name,
      row.actorName,

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
   SUMMARY
   ============================================================ */

function updateSummary(rows) {

  const totalCount =
    $('#totalCount');

  const receiveCount =
    $('#receiveCount');

  const issueCount =
    $('#issueCount');

  if (totalCount) {

    totalCount.textContent =
      rows.length.toLocaleString('th-TH');
  }

  let receive =
    0;

  let issue =
    0;

  rows.forEach((row) => {

    const delta =
      Number(row.delta) || 0;

    if (delta > 0) {

      receive +=
        Math.abs(delta);

    } else if (delta < 0) {

      issue +=
        Math.abs(delta);
    }

  });

  if (receiveCount) {

    receiveCount.textContent =
      fmt(receive);
  }

  if (issueCount) {

    issueCount.textContent =
      fmt(issue);
  }
}

/* ============================================================
   UPDATE COUNT
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
   RENDER
   ============================================================ */

function renderHistory(rows) {

  const list =
    $('#historyResults');

  if (!list) {
    return;
  }

  if (!rows.length) {

    list.innerHTML = `
      <div class="history-empty">
        ไม่มีรายการตามเงื่อนไขที่ค้นหา
      </div>
    `;

    updateCount(0);
    updateSummary([]);

    return;
  }

  list.innerHTML =
    rows
      .map(movementRow)
      .join('');

  updateCount(
    rows.length
  );

  updateSummary(
    rows
  );
}

/* ============================================================
   LOAD HISTORY
   ============================================================ */

async function loadHistory() {

  const list =
    $('#historyResults');

  if (!list) {
    return;
  }

  list.innerHTML = `
    <div class="history-empty">
      กำลังโหลดข้อมูล...
    </div>
  `;

  try {

    const values =
      getSearchValues();

    const defaults =
      getDefaultDates();

    const startDate =
      values.startDate ||
      defaults.start;

    const endDate =
      values.endDate ||
      defaults.end;

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
      filterByType(
        rows,
        values.type
      );

    /* --------------------------------------------------------
       ค้นหาข้อความ
    -------------------------------------------------------- */

    filtered =
      filterBySearch(
        filtered,
        values.search
      );

    /* --------------------------------------------------------
       แสดงผล
    -------------------------------------------------------- */

    renderHistory(
      filtered
    );

  } catch (error) {

    console.error(
      'loadHistory error:',
      error
    );

    list.innerHTML = `
      <div
        class="history-empty"
        style="color:#dc2626"
      >

        โหลดประวัติไม่สำเร็จ

        <br>

        <small>
          ${esc(error.message)}
        </small>

      </div>
    `;

    updateCount(0);
    updateSummary([]);
  }
}

/* ============================================================
   SEARCH
   ============================================================ */

function searchHistory() {

  const values =
    getSearchValues();

  const params =
    new URLSearchParams();

  if (values.startDate) {

    params.set(
      'startDate',
      values.startDate
    );
  }

  if (values.endDate) {

    params.set(
      'endDate',
      values.endDate
    );
  }

  if (values.search) {

    params.set(
      'search',
      values.search
    );
  }

  if (values.type !== 'all') {

    params.set(
      'type',
      values.type
    );
  }

  /* ----------------------------------------------------------
     เปลี่ยน URL โดยไม่รีโหลดหน้า
     ---------------------------------------------------------- */

  const query =
    params.toString();

  window.history.replaceState(
    {},
    '',
    query
      ? `${location.pathname}?${query}`
      : location.pathname
  );

  /* ----------------------------------------------------------
     โหลดรายการใหม่
     ---------------------------------------------------------- */

  loadHistory();
}

/* ============================================================
   CLEAR SEARCH
   ============================================================ */

function clearSearch() {

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
    search.value =
      '';
  }

  /* ----------------------------------------------------------
     กลับไป "ทั้งหมด"
     ---------------------------------------------------------- */

  $$('.history-type-row .chip')
    .forEach((chip) => {

      chip.classList.remove(
        'is-active'
      );

      chip.setAttribute(
        'aria-pressed',
        'false'
      );

    });

  const allChip =
    $('.history-type-row .chip[data-type="all"]');

  if (allChip) {

    allChip.classList.add(
      'is-active'
    );

    allChip.setAttribute(
      'aria-pressed',
      'true'
    );
  }

  window.history.replaceState(
    {},
    '',
    location.pathname
  );

  loadHistory();
}

/* ============================================================
   TYPE BUTTON
   ============================================================ */

function setupTypeButtons() {

  const chips =
    $$('.history-type-row .chip');

  chips.forEach((chip) => {

    chip.setAttribute(
      'aria-pressed',
      chip.classList.contains('is-active')
        ? 'true'
        : 'false'
    );

    chip.addEventListener(
      'click',
      () => {

        chips.forEach((item) => {

          item.classList.remove(
            'is-active'
          );

          item.setAttribute(
            'aria-pressed',
            'false'
          );

        });

        chip.classList.add(
          'is-active'
        );

        chip.setAttribute(
          'aria-pressed',
          'true'
        );

        searchHistory();

      }
    );

  });
}

/* ============================================================
   LOAD VALUES FROM URL
   ============================================================ */

function loadValuesFromURL() {

  const params =
    new URLSearchParams(
      window.location.search
    );

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
      params.get('startDate') ||
      defaults.start;
  }

  if (end) {

    end.value =
      params.get('endDate') ||
      defaults.end;
  }

  if (search) {

    search.value =
      params.get('search') ||
      '';
  }

  const type =
    params.get('type') ||
    'all';

  const chips =
    $$('.history-type-row .chip');

  chips.forEach((chip) => {

    const active =
      chip.dataset.type === type;

    chip.classList.toggle(
      'is-active',
      active
    );

    chip.setAttribute(
      'aria-pressed',
      active
        ? 'true'
        : 'false'
    );

  });
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
      location.origin
    )
  ) {

    history.back();

    return;
  }

  window.location.href =
    '/';
}

/* ============================================================
   EVENTS
   ============================================================ */

document.addEventListener(
  'DOMContentLoaded',
  () => {

    /* --------------------------------------------------------
       โหลดค่าจาก URL
    -------------------------------------------------------- */

    loadValuesFromURL();

    /* --------------------------------------------------------
       ประเภท
    -------------------------------------------------------- */

    setupTypeButtons();

    /* --------------------------------------------------------
       ปุ่มพิมพ์
    -------------------------------------------------------- */

    $('#printBtn')
      ?.addEventListener(
        'click',
        printHistory
      );

    /* --------------------------------------------------------
       ปุ่มล้าง
    -------------------------------------------------------- */

    $('#clearBtn')
      ?.addEventListener(
        'click',
        clearSearch
      );

    /* --------------------------------------------------------
       ปุ่มกลับ
    -------------------------------------------------------- */

    $('#backBtn')
      ?.addEventListener(
        'click',
        goBack
      );

    /* --------------------------------------------------------
       วันที่
    -------------------------------------------------------- */

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

    /* --------------------------------------------------------
       ค้นหาข้อความ

       กด Enter เพื่อค้นหา
    -------------------------------------------------------- */

    $('#searchInput')
      ?.addEventListener(
        'keydown',
        (event) => {

          if (
            event.key === 'Enter'
          ) {

            event.preventDefault();

            searchHistory();
          }

        }
      );

    /* --------------------------------------------------------
       ค้นหาแบบพิมพ์

       รอ 400ms แล้วค้นหา
    -------------------------------------------------------- */

    let searchTimer = null;

    $('#searchInput')
      ?.addEventListener(
        'input',
        () => {

          clearTimeout(
            searchTimer
          );

          searchTimer =
            setTimeout(
              searchHistory,
              400
            );

        }
      );

    /* --------------------------------------------------------
       โหลดข้อมูลครั้งแรก
    -------------------------------------------------------- */

    loadHistory();

  }
);
