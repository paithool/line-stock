/* ============================================================
   Stock — History Page
   history.html เวอร์ชันปัจจุบัน
   ============================================================ */

const API_BASE = '/api';

/* ============================================================
   Helpers
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
    ...(options.body
      ? { 'content-type': 'application/json' }
      : {}),
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
      data.message ||
      `เกิดข้อผิดพลาด (${response.status})`
    );

    error.status = response.status;

    throw error;
  }

  return data;
}

/* ============================================================
   วันที่
   ============================================================ */

function pad(number) {
  return String(number).padStart(2, '0');
}

function getDefaultStartDate() {
  const now = new Date();

  return (
    `${now.getFullYear()}-` +
    `${pad(now.getMonth() + 1)}-01`
  );
}

function getDefaultEndDate() {
  const now = new Date();

  const lastDay =
    new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0
    );

  return (
    `${lastDay.getFullYear()}-` +
    `${pad(lastDay.getMonth() + 1)}-` +
    `${pad(lastDay.getDate())}`
  );
}

function formatDateTime(sqlDate) {
  if (!sqlDate) return '-';

  const raw = String(sqlDate);

  /*
   * SQLite มักส่ง:
   * 2026-09-29 10:30:00
   */

  const normalized =
    raw.includes('T')
      ? raw
      : raw.replace(' ', 'T');

  let date =
    new Date(normalized);

  /*
   * ถ้าไม่มี timezone ให้ถือว่าเป็นเวลาไทย
   */
  if (
    Number.isNaN(date.getTime()) &&
    !normalized.endsWith('Z')
  ) {
    date =
      new Date(
        `${normalized}+07:00`
      );
  }

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

function getMovementTime(value) {
  if (!value) return 0;

  const raw =
    String(value);

  const normalized =
    raw.includes('T')
      ? raw
      : raw.replace(' ', 'T');

  let time =
    new Date(normalized).getTime();

  if (
    Number.isNaN(time) &&
    !normalized.endsWith('Z')
  ) {
    time =
      new Date(
        `${normalized}+07:00`
      ).getTime();
  }

  return Number.isNaN(time)
    ? 0
    : time;
}

/* ============================================================
   ประเภทการเคลื่อนไหว
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
   ตรวจรายการเพิ่มสินค้า
   ============================================================ */

function isInitialAdd(movement) {
  return (
    movement.type === 'receive' &&
    movement.note ===
      'จำนวนเริ่มต้นตอนเพิ่มสินค้า'
  );
}

/* ============================================================
   สร้าง HTML รายการ
   ============================================================ */

function movementRow(movement) {
  const initial =
    isInitialAdd(movement);

  const meta =
    initial
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

  const deltaColor =
    positive
      ? 'var(--receive, #16a34a)'
      : delta < 0
        ? 'var(--issue, #dc2626)'
        : 'var(--muted, #64748b)';

  return `
    <div class="history-row">

      <div class="history-row__icon">
        ${meta.icon}
      </div>

      <div>

        <div class="history-row__name">
          ${esc(
            movement.product_name || '-'
          )}
        </div>

        <div class="history-row__meta">

          ${esc(meta.label)}

          ·

          ${esc(
            movement.location_name || '-'
          )}

          ·

          ${formatDateTime(
            movement.created_at
          )}

          ${
            movement.actor_name
              ? ` · ${esc(
                  movement.actor_name
                )}`
              : ''
          }

          ${
            movement.note && !initial
              ? ` · ${esc(
                  movement.note
                )}`
              : ''
          }

        </div>

        ${
          movement.ref ||
          movement.sku
            ? `
              <div class="history-row__meta">

                ${
                  movement.ref
                    ? `เลขที่: ${esc(
                        movement.ref
                      )}`
                    : ''
                }

                ${
                  movement.ref &&
                  movement.sku
                    ? ' · '
                    : ''
                }

                ${
                  movement.sku
                    ? `SKU: ${esc(
                        movement.sku
                      )}`
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
          style="color:${deltaColor};"
        >
          ${
            positive
              ? '+'
              : ''
          }${fmt(delta)}
        </div>

        <div class="history-row__balance">

          เหลือ
          ${fmt(
            movement.balance_after
          )}

          ${
            movement.unit
              ? ` ${esc(
                  movement.unit
                )}`
              : ''
          }

        </div>

      </div>

    </div>
  `;
}

/* ============================================================
   กรองประเภท
   ============================================================ */

function filterByType(rows, type) {
  if (!type || type === 'all') {
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
   ค้นหาข้อความ
   ============================================================ */

function filterBySearch(rows, keyword) {
  const text =
    String(keyword || '')
      .trim()
      .toLowerCase();

  if (!text) {
    return rows;
  }

  return rows.filter((row) => {

    const searchable = [
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

    return searchable.includes(text);
  });
}

/* ============================================================
   สรุป
   ============================================================ */

function updateSummary(rows) {
  const total =
    $('#totalCount');

  const receive =
    $('#receiveCount');

  const issue =
    $('#issueCount');

  const historyCount =
    $('#historyCount');

  if (total) {
    total.textContent =
      rows.length.toLocaleString('th-TH');
  }

  if (historyCount) {
    historyCount.textContent =
      `${rows.length.toLocaleString(
        'th-TH'
      )} รายการ`;
  }

  let receiveTotal = 0;
  let issueTotal = 0;

  rows.forEach((row) => {

    const delta =
      Number(row.delta) || 0;

    if (
      row.type === 'receive' ||
      row.type === 'transfer_in'
    ) {
      receiveTotal +=
        Math.abs(delta);
    }

    if (
      row.type === 'issue' ||
      row.type === 'transfer_out'
    ) {
      issueTotal +=
        Math.abs(delta);
    }

  });

  if (receive) {
    receive.textContent =
      fmt(receiveTotal);
  }

  if (issue) {
    issue.textContent =
      fmt(issueTotal);
  }
}

/* ============================================================
   Loading
   ============================================================ */

function showLoading() {
  const results =
    $('#historyResults');

  if (!results) return;

  results.innerHTML = `
    <div class="history-empty">
      กำลังค้นหาประวัติ...
    </div>
  `;
}

/* ============================================================
   Empty
   ============================================================ */

function showEmpty() {
  const results =
    $('#historyResults');

  if (!results) return;

  results.innerHTML = `
    <div class="history-empty">
      ไม่มีรายการในช่วงวันที่ที่เลือก
    </div>
  `;
}

/* ============================================================
   Error
   ============================================================ */

function showError(error) {
  const results =
    $('#historyResults');

  if (!results) return;

  results.innerHTML = `
    <div
      class="history-empty"
      style="color:var(--danger,#dc2626)"
    >
      โหลดประวัติไม่สำเร็จ
      <br>
      <small>
        ${esc(
          error?.message ||
          'เกิดข้อผิดพลาด'
        )}
      </small>
    </div>
  `;
}

/* ============================================================
   โหลดประวัติ
   ============================================================ */

async function loadHistory() {

  const results =
    $('#historyResults');

  if (!results) {
    console.error(
      'ไม่พบ #historyResults ใน history.html'
    );
    return;
  }

  const startDate =
    $('#startDate')?.value;

  const endDate =
    $('#endDate')?.value;

  const search =
    $('#searchInput')?.value || '';

  const activeChip =
    $('#historyTypes .chip.is-active');

  const type =
    activeChip?.dataset.type ||
    'all';

  /* ----------------------------------------------------------
     ตรวจวันที่
     ---------------------------------------------------------- */

  if (!startDate || !endDate) {

    results.innerHTML = `
      <div class="history-empty">
        กรุณาเลือกวันที่เริ่มต้นและวันที่สิ้นสุด
      </div>
    `;

    updateSummary([]);

    return;
  }

  if (startDate > endDate) {

    results.innerHTML = `
      <div
        class="history-empty"
        style="color:var(--danger,#dc2626)"
      >
        วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด
      </div>
    `;

    updateSummary([]);

    return;
  }

  showLoading();

  try {

    console.log(
      'ค้นหาประวัติ',
      {
        startDate,
        endDate,
        type,
        search,
      }
    );

    /* --------------------------------------------------------
       API
       -------------------------------------------------------- */

    const response =
      await api(
        `/movements?` +
        `startDate=${encodeURIComponent(
          startDate
        )}` +
        `&endDate=${encodeURIComponent(
          endDate
        )}` +
        `&limit=100`
      );

    console.log(
      'API movements:',
      response
    );

    /*
     * รองรับทั้ง:
     *
     * [
     *   {...}
     * ]
     *
     * หรือ
     *
     * {
     *   data: [...]
     * }
     *
     * หรือ
     *
     * {
     *   movements: [...]
     * }
     */

    let rows;

    if (Array.isArray(response)) {

      rows = response;

    } else if (
      Array.isArray(response.data)
    ) {

      rows = response.data;

    } else if (
      Array.isArray(response.movements)
    ) {

      rows = response.movements;

    } else {

      throw new Error(
        'API ไม่ได้ส่งข้อมูลรายการกลับมาเป็น Array'
      );
    }

    /* --------------------------------------------------------
       กรองประเภท
       -------------------------------------------------------- */

    let filtered =
      filterByType(
        rows,
        type
      );

    /* --------------------------------------------------------
       กรองคำค้น
       -------------------------------------------------------- */

    filtered =
      filterBySearch(
        filtered,
        search
      );

    /* --------------------------------------------------------
       เรียงใหม่ล่าสุดก่อน
       -------------------------------------------------------- */

    filtered.sort((a, b) => {

      const dateA =
        getMovementTime(
          a.created_at
        );

      const dateB =
        getMovementTime(
          b.created_at
        );

      return dateB - dateA;
    });

    /* --------------------------------------------------------
       สรุป
       -------------------------------------------------------- */

    updateSummary(
      filtered
    );

    /* --------------------------------------------------------
       ไม่มีรายการ
       -------------------------------------------------------- */

    if (!filtered.length) {
      showEmpty();
      return;
    }

    /* --------------------------------------------------------
       แสดงรายการ
       -------------------------------------------------------- */

    results.innerHTML =
      filtered
        .map(movementRow)
        .join('');

    console.log(
      `แสดงประวัติ ${filtered.length} รายการ`
    );

  } catch (error) {

    console.error(
      'loadHistory error:',
      error
    );

    updateSummary([]);

    showError(error);
  }
}

/* ============================================================
   ค้นหาเมื่อเปลี่ยนวันที่
   ============================================================ */

function autoSearchByDate() {

  const start =
    $('#startDate')?.value;

  const end =
    $('#endDate')?.value;

  console.log(
    'วันที่เปลี่ยน:',
    start,
    end
  );

  /*
   * ยังเลือกไม่ครบ 2 ช่อง
   * ไม่ต้องค้นหา
   */

  if (!start || !end) {
    return;
  }

  /*
   * วันที่ผิด
   */

  if (start > end) {

    const results =
      $('#historyResults');

    if (results) {
      results.innerHTML = `
        <div
          class="history-empty"
          style="color:var(--danger,#dc2626)"
        >
          วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด
        </div>
      `;
    }

    updateSummary([]);

    return;
  }

  /*
   * ค้นหาอัตโนมัติ
   */

  loadHistory();
}

/* ============================================================
   เลือกประเภท
   ============================================================ */

function selectHistoryType(button) {

  $$('#historyTypes .chip')
    .forEach((chip) => {
      chip.classList.remove(
        'is-active'
      );
    });

  button.classList.add(
    'is-active'
  );

  loadHistory();
}

/* ============================================================
   ค้นหาข้อความ
   ============================================================ */

let searchTimer = null;

function searchByText() {

  clearTimeout(
    searchTimer
  );

  searchTimer =
    setTimeout(() => {
      loadHistory();
    }, 300);
}

/* ============================================================
   ล้างการค้นหา
   ============================================================ */

function clearHistorySearch() {

  const start =
    $('#startDate');

  const end =
    $('#endDate');

  const search =
    $('#searchInput');

  if (search) {
    search.value = '';
  }

  if (start) {
    start.value =
      getDefaultStartDate();
  }

  if (end) {
    end.value =
      getDefaultEndDate();
  }

  $$('#historyTypes .chip')
    .forEach((chip) => {
      chip.classList.remove(
        'is-active'
      );
    });

  const allChip =
    $('#historyTypes .chip[data-type="all"]');

  if (allChip) {
    allChip.classList.add(
      'is-active'
    );
  }

  loadHistory();
}

/* ============================================================
   พิมพ์
   ============================================================ */

function printHistory() {
  window.print();
}

/* ============================================================
   กลับ
   ============================================================ */

function goBack() {

  if (
    document.referrer &&
    document.referrer.includes(
      window.location.host
    )
  ) {
    history.back();
    return;
  }

  window.location.href = '/';
}

/* ============================================================
   เริ่มต้น
   ============================================================ */

document.addEventListener(
  'DOMContentLoaded',
  () => {

    console.log(
      'History page เริ่มทำงาน'
    );

    /* --------------------------------------------------------
       ตั้งวันที่เริ่มต้น
       -------------------------------------------------------- */

    const start =
      $('#startDate');

    const end =
      $('#endDate');

    if (
      start &&
      !start.value
    ) {
      start.value =
        getDefaultStartDate();
    }

    /* --------------------------------------------------------
       ตั้งวันที่สิ้นสุด
       -------------------------------------------------------- */

    if (
      end &&
      !end.value
    ) {
      end.value =
        getDefaultEndDate();
    }

    /* --------------------------------------------------------
       เปลี่ยนวันที่
       ค้นหาอัตโนมัติ
       -------------------------------------------------------- */

    start?.addEventListener(
      'change',
      autoSearchByDate
    );

    end?.addEventListener(
      'change',
      autoSearchByDate
    );

    /* --------------------------------------------------------
       ค้นหาสินค้า / SKU / คลัง / ผู้ทำรายการ
       -------------------------------------------------------- */

    $('#searchInput')
      ?.addEventListener(
        'input',
        searchByText
      );

    /* --------------------------------------------------------
       ปุ่มประเภท
       -------------------------------------------------------- */

    $$('#historyTypes .chip')
      .forEach((button) => {

        button.addEventListener(
          'click',
          () => {
            selectHistoryType(
              button
            );
          }
        );

      });

    /* --------------------------------------------------------
       ล้างการค้นหา
       -------------------------------------------------------- */

    $('#clearBtn')
      ?.addEventListener(
        'click',
        clearHistorySearch
      );

    /* --------------------------------------------------------
       พิมพ์
       -------------------------------------------------------- */

    $('#printBtn')
      ?.addEventListener(
        'click',
        printHistory
      );

    /* --------------------------------------------------------
       กลับ
       -------------------------------------------------------- */

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
