/* ============================================================
   Stock — History Page
   ตรงกับ history.html เวอร์ชันปัจจุบัน
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

  const text =
    String(sqlDate).replace(' ', 'T');

  const date =
    new Date(
      text.endsWith('Z')
        ? text
        : `${text}Z`
    );

  if (Number.isNaN(date.getTime())) {
    return sqlDate;
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
   ตรวจว่าเป็นรายการ "เพิ่มเข้า" ตอนสร้างสินค้า
   ============================================================ */

function isInitialAdd(movement) {
  return (
    movement.type === 'receive' &&
    movement.note ===
      'จำนวนเริ่มต้นตอนเพิ่มสินค้า'
  );
}

/* ============================================================
   สร้าง HTML รายการประวัติ
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
          movement.ref || movement.sku
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
          style="
            color: ${
              positive
                ? 'var(--receive, #16a34a)'
                : 'var(--issue, #dc2626)'
            };
          "
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
   อัปเดตตัวเลขสรุป
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
      receiveTotal += Math.abs(delta);
    }

    if (
      row.type === 'issue' ||
      row.type === 'transfer_out'
    ) {
      issueTotal += Math.abs(delta);
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
   แสดงสถานะกำลังโหลด
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
   แสดงว่าไม่มีรายการ
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
   แสดงข้อผิดพลาด
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
     ต้องมีวันที่ทั้งสองช่องก่อนค้นหา
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

  /* ----------------------------------------------------------
     ตรวจวันที่
     ---------------------------------------------------------- */

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
       เรียก API
    -------------------------------------------------------- */

    const rows =
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
      rows
    );

    /* --------------------------------------------------------
       ตรวจว่าข้อมูลเป็น Array หรือไม่
    -------------------------------------------------------- */

    if (!Array.isArray(rows)) {
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
        new Date(
          String(
            a.created_at || ''
          ).replace(' ', 'T') + 'Z'
        ).getTime();

      const dateB =
        new Date(
          String(
            b.created_at || ''
          ).replace(' ', 'T') + 'Z'
        ).getTime();

      return dateB - dateA;
    });

    /* --------------------------------------------------------
       อัปเดตสรุป
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
       แสดงรายการด้านล่าง
       ส่วนค้นหาด้านบนยังอยู่เหมือนเดิม
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
   ค้นหาอัตโนมัติเมื่อเลือกวันที่ครบ
   ============================================================ */

function autoSearchByDate() {
  const start = $('#startDate')?.value;
  const end = $('#endDate')?.value;

  console.log('วันที่เปลี่ยน:', start, end);

  // ต้องเลือกครบทั้ง 2 วัน
  if (!start || !end) {
    return;
  }

  // วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด
  if (start > end) {
    alert('วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด');
    return;
  }

  loadHistory().then(() => {
  alert('โหลดเสร็จแล้ว กำลังพิมพ์');
  window.print();
});


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

  /* ค้นหาใหม่ทันที */
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
    setTimeout(
      () => {
        loadHistory();
      },
      300
    );
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

  /* โหลดใหม่ */
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

  window.location.href =
    '/';
}

/* ============================================================
   เริ่มต้นหน้า
   ============================================================ */

document.addEventListener(
  'DOMContentLoaded',
  () => {

    console.log(
      'History page เริ่มทำงาน'
    );

    /* --------------------------------------------------------
       ตั้งวันที่เริ่มต้น / สิ้นสุด
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

    if (
      end &&
      !end.value
    ) {
      end.value =
        getDefaultEndDate();
    }

    /* --------------------------------------------------------
       เลือกวันที่เริ่มต้น
    -------------------------------------------------------- */

    start?.addEventListener(
      'change',
      autoSearchByDate
    );

    /* --------------------------------------------------------
       เลือกวันที่สิ้นสุด
    -------------------------------------------------------- */

    end?.addEventListener(
      'change',
      autoSearchByDate
    );

    /* --------------------------------------------------------
       ค้นหาชื่อ / SKU / คลัง / ผู้ทำรายการ
       ค้นหาอัตโนมัติหลังหยุดพิมพ์ 300ms
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
       โหลดข้อมูลครั้งแรก
       ใช้วันที่เดือนปัจจุบัน
    -------------------------------------------------------- */

    loadHistory();

  }
);
