const STORAGE_KEY = 'hanmonth.entries.v1';

const CATS = [
  { id: 'coffee', label: '커피', emoji: '☕️' },
  { id: 'coupay', label: '쿠페이', emoji: '🛒', defaultAmount: 100000 },
  { id: 'gf', label: '여자친구랑', emoji: '🍽️' },
  { id: 'friends', label: '친구들이랑', emoji: '🍻' },
  { id: 'solo', label: '혼밥', emoji: '🍙' },
  { id: 'study', label: '스터디카페', emoji: '📚' },
  { id: 'gym', label: '헬스장', emoji: '🏋️' },
  { id: 'etc', label: '기타', emoji: '🧾' },
];
const CAT_BY_ID = Object.fromEntries(CATS.map((c) => [c.id, c]));
const GYM_PLANS = [
  { months: 1, label: '이번 달만' },
  { months: 3, label: '3개월' },
  { months: 6, label: '6개월' },
];
const MAX_DIGITS = 9;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const won = (n) => `${n.toLocaleString('ko-KR')}원`;

// ---- 날짜 ----
const pad = (n) => String(n).padStart(2, '0');
function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const todayStr = () => daysAgoStr(0);
const monthOf = (date) => date.slice(0, 7);
function addMonths(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
function monthDiff(from, to) {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
}
function dayLabel(date) {
  const [y, m, d] = date.split('-').map(Number);
  const w = '일월화수목금토'[new Date(y, m - 1, d).getDay()];
  return date === todayStr() ? `오늘 · ${m}월 ${d}일` : `${m}월 ${d}일 ${w}요일`;
}

// ---- 저장 ----
function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    toast('저장하지 못했어요. 저장 공간을 확인해주세요.');
  }
}

let entries = load();
let viewMonth = monthOf(todayStr());
let filterCat = null;

const snapshot = () => entries.map((e) => ({ ...e }));
function setMonth(ym) {
  viewMonth = ym;
  filterCat = null;
  render();
}

// ---- 월별 계산 ----
// 이용권은 결제한 달부터 개월 수만큼 나눠서 잡고, 나머지 원 단위는 첫 달에 몰아준다.
function shareIn(entry, ym) {
  const months = entry.months || 1;
  const offset = monthDiff(monthOf(entry.date), ym);
  if (offset < 0 || offset >= months) return 0;
  const base = Math.floor(entry.amount / months);
  return offset === 0 ? entry.amount - base * (months - 1) : base;
}
const monthTotal = (ym) => entries.reduce((sum, e) => sum + shareIn(e, ym), 0);

// ---- 메인 화면 ----
function render() {
  if (filterCat && !entries.some((e) => e.cat === filterCat && shareIn(e, viewMonth))) filterCat = null;
  const [y, m] = viewMonth.split('-').map(Number);
  $('month-title').textContent = `${y}년 ${m}월`;
  $('next-month').disabled = viewMonth >= monthOf(todayStr());

  const total = monthTotal(viewMonth);
  $('total').textContent = won(total);
  $('delta').textContent = deltaText(total, monthTotal(addMonths(viewMonth, -1)));

  renderTrend();
  renderBreakdown(total);
  renderList();
  renderQuick();

  const hasAny = total > 0;
  $('breakdown-section').hidden = !hasAny;
  $('list-section').hidden = !hasAny;
  $('empty').hidden = hasAny;
}

function deltaText(total, previous) {
  if (!previous) return '';
  const diff = total - previous;
  if (diff === 0) return '지난달이랑 똑같아요';
  return `지난달보다 ${won(Math.abs(diff))} ${diff > 0 ? '더' : '덜'} 썼어요`;
}

function renderTrend() {
  const months = Array.from({ length: 6 }, (_, i) => addMonths(viewMonth, i - 5));
  const totals = months.map(monthTotal);
  const max = Math.max(...totals, 1);
  $('trend').innerHTML = months.map((ym, i) => {
    const label = `${Number(ym.slice(5))}월`;
    const height = totals[i] ? Math.max(4, Math.round((totals[i] / max) * 72)) : 0;
    return `<button class="trend-col${ym === viewMonth ? ' current' : ''}" data-month="${ym}" aria-label="${label} ${won(totals[i])}">
      <span class="trend-plot"><span class="trend-bar" style="height:${height}px"></span></span>
      <span class="trend-label">${label}</span>
    </button>`;
  }).join('');
}

function renderBreakdown(total) {
  const byCat = new Map();
  for (const e of entries) {
    const share = shareIn(e, viewMonth);
    if (share) byCat.set(e.cat, (byCat.get(e.cat) || 0) + share);
  }
  const rows = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  const top = rows.length ? rows[0][1] : 1;
  $('breakdown').classList.toggle('filtering', Boolean(filterCat));
  $('breakdown').innerHTML = rows.map(([cat, amount]) => {
    const c = CAT_BY_ID[cat] || CAT_BY_ID.etc;
    return `<li><button class="bd-btn" data-filter="${esc(cat)}" aria-pressed="${filterCat === cat}">
      <span class="bd-row">
        <span><span class="bd-emoji" aria-hidden="true">${c.emoji}</span>${c.label}</span>
        <span class="bd-amount">${won(amount)}<span class="bd-share">${Math.round((amount / total) * 100)}%</span></span>
      </span>
      <span class="bd-track" style="display:block"><span class="bd-fill" style="display:block;width:${(amount / top) * 100}%"></span></span>
    </button></li>`;
  }).join('');
}

// 최근 90일에 자주 쓴 항목+금액 조합. 이용권은 매번 달라서 뺀다.
function quickItems() {
  const since = daysAgoStr(90);
  const counts = new Map();
  for (const e of entries) {
    if (e.date < since || e.cat === 'gym' || !CAT_BY_ID[e.cat]) continue;
    const key = `${e.cat}|${e.amount}`;
    const item = counts.get(key) || { cat: e.cat, amount: e.amount, count: 0, last: '' };
    item.count += 1;
    if (e.date > item.last) item.last = e.date;
    counts.set(key, item);
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || b.last.localeCompare(a.last))
    .slice(0, 5);
}

function renderQuick() {
  $('quick').innerHTML = quickItems().map(({ cat, amount }) => {
    const c = CAT_BY_ID[cat];
    return `<button class="quick-chip" data-quick-cat="${cat}" data-quick-amount="${amount}" aria-label="오늘 ${c.label} ${won(amount)} 기록">${c.emoji} ${amount.toLocaleString('ko-KR')}</button>`;
  }).join('');
}

function quickRecord(cat, amount) {
  const before = snapshot();
  const date = todayStr();
  entries.push({ id: crypto.randomUUID(), createdAt: Date.now(), date, amount, cat, memo: '', months: 1 });
  persist();
  viewMonth = monthOf(date);
  render();
  toast(`${CAT_BY_ID[cat].label} ${won(amount)} 기록했어요`, before);
}

function rowHtml(e, ym) {
  const c = CAT_BY_ID[e.cat] || CAT_BY_ID.etc;
  const months = e.months || 1;
  const notes = [];
  if (months > 1) {
    const nth = monthDiff(monthOf(e.date), ym) + 1;
    notes.push(`${months}개월권 ${nth}/${months} · 총 ${won(e.amount)}`);
  }
  if (e.memo) notes.push(e.memo);
  return `<button class="row" data-edit="${esc(e.id)}">
    <span class="row-emoji" aria-hidden="true">${c.emoji}</span>
    <span class="row-text">
      <span class="row-title">${c.label}</span>
      ${notes.length ? `<span class="row-sub">${esc(notes.join(' · '))}</span>` : ''}
    </span>
    <span class="row-amount">${won(shareIn(e, ym))}</span>
  </button>`;
}

function renderList() {
  $('list-title').textContent = filterCat ? `${(CAT_BY_ID[filterCat] || CAT_BY_ID.etc).label} 기록` : '기록';
  $('clear-filter').hidden = !filterCat;
  const visible = entries.filter((e) => shareIn(e, viewMonth) > 0 && (!filterCat || e.cat === filterCat));
  const carried = visible.filter((e) => monthOf(e.date) !== viewMonth);
  const days = new Map();
  for (const e of visible) {
    if (monthOf(e.date) !== viewMonth) continue;
    if (!days.has(e.date)) days.set(e.date, []);
    days.get(e.date).push(e);
  }
  const groupHtml = (title, list) => {
    const sum = list.reduce((s, e) => s + shareIn(e, viewMonth), 0);
    return `<div class="day">
      <div class="day-head"><span>${title}</span><span>${won(sum)}</span></div>
      ${list.map((e) => rowHtml(e, viewMonth)).join('')}
    </div>`;
  };
  const sortedDays = [...days.keys()].sort().reverse();
  $('list').innerHTML = sortedDays.map((d) => groupHtml(dayLabel(d), days.get(d))).join('')
    + (carried.length ? groupHtml('이어지는 이용권', carried) : '');
}

// ---- 기록 시트 ----
const form = { id: null, amount: '', cat: null, months: 3, replaceOnType: false };

function recentAmounts(cat) {
  const seen = [];
  const sorted = entries.filter((e) => e.cat === cat).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  for (const e of sorted) {
    if (!seen.includes(e.amount)) seen.push(e.amount);
    if (seen.length === 3) break;
  }
  const fallback = CAT_BY_ID[cat].defaultAmount;
  if (fallback && !seen.includes(fallback) && seen.length < 3) seen.push(fallback);
  return seen;
}

function openEntry(entry) {
  form.id = entry ? entry.id : null;
  form.amount = entry ? String(entry.amount) : '';
  form.cat = entry ? entry.cat : null;
  form.months = entry && entry.months ? entry.months : lastGymMonths();
  form.replaceOnType = Boolean(entry);
  $('f-date').value = entry ? entry.date : todayStr();
  $('f-date').max = todayStr();
  $('f-memo').value = entry ? entry.memo || '' : '';
  $('f-delete').hidden = !entry;
  renderForm();
  openSheet('entry-sheet');
}

function lastGymMonths() {
  const gym = entries.filter((e) => e.cat === 'gym').sort((a, b) => b.date.localeCompare(a.date))[0];
  return gym ? gym.months || 1 : 3;
}

function renderDatePicks() {
  const date = $('f-date').value;
  let matched = false;
  document.querySelectorAll('[data-days-ago]').forEach((b) => {
    const on = date === daysAgoStr(Number(b.dataset.daysAgo));
    b.setAttribute('aria-pressed', on);
    matched = matched || on;
  });
  $('f-date').classList.toggle('custom', !matched);
}

function renderForm() {
  renderDatePicks();
  const amount = Number(form.amount) || 0;
  const amountEl = $('f-amount');
  amountEl.textContent = won(amount);
  amountEl.classList.toggle('placeholder', !amount);

  $('f-recent').innerHTML = form.cat
    ? recentAmounts(form.cat).map((a) => `<button class="chip" data-amount="${a}">${a.toLocaleString('ko-KR')}</button>`).join('')
    : '';

  $('f-cats').innerHTML = CATS.map((c) => `<button class="cat" data-cat="${c.id}" aria-pressed="${form.cat === c.id}">
    <span class="cat-emoji" aria-hidden="true">${c.emoji}</span>${c.label}
  </button>`).join('');

  const isGym = form.cat === 'gym';
  $('f-plan').hidden = !isGym;
  if (isGym) {
    $('f-plan-buttons').innerHTML = GYM_PLANS.map((p) => `<button data-months="${p.months}" aria-pressed="${form.months === p.months}">${p.label}</button>`).join('');
    $('f-plan-hint').textContent = form.months > 1 && amount
      ? `한 달에 약 ${won(Math.round(amount / form.months))}씩 나눠서 잡아요`
      : '';
  }

  const save = $('f-save');
  save.disabled = !(form.cat && amount > 0);
  if (!form.cat) save.textContent = '어디에 썼는지 골라주세요';
  else if (!amount) save.textContent = '금액을 넣어주세요';
  else save.textContent = form.id ? '수정' : '저장';
}

function pressKey(key) {
  if (key === 'back') {
    form.amount = form.amount.slice(0, -1);
  } else {
    if (form.replaceOnType) form.amount = '';
    const next = (form.amount + key).replace(/^0+/, '');
    if (next.length <= MAX_DIGITS) form.amount = next;
  }
  form.replaceOnType = false;
  renderForm();
}

function saveEntry() {
  const amount = Number(form.amount) || 0;
  if (!form.cat || !amount) return;
  const before = snapshot();
  const data = {
    date: $('f-date').value || todayStr(),
    amount,
    cat: form.cat,
    memo: $('f-memo').value.trim(),
    months: form.cat === 'gym' ? form.months : 1,
  };
  if (form.id) {
    Object.assign(entries.find((e) => e.id === form.id), data);
  } else {
    entries.push({ id: crypto.randomUUID(), createdAt: Date.now(), ...data });
  }
  persist();
  viewMonth = monthOf(data.date);
  closeSheets();
  render();
  toast(`${CAT_BY_ID[data.cat].label} ${won(amount)} ${form.id ? '수정' : '기록'}했어요`, before);
}

function deleteEntry() {
  const before = snapshot();
  entries = entries.filter((e) => e.id !== form.id);
  persist();
  closeSheets();
  render();
  toast('삭제했어요', before);
}

// ---- 시트 열고 닫기 ----
function openSheet(id) {
  $('toast').hidden = true;
  $('backdrop').hidden = false;
  $(id).hidden = false;
}
function closeSheets() {
  $('backdrop').hidden = true;
  $('entry-sheet').hidden = true;
  $('backup-sheet').hidden = true;
}

// ---- 백업 ----
function openBackup() {
  $('backup-count').textContent = `지금 기록 ${entries.length.toLocaleString('ko-KR')}건`;
  openSheet('backup-sheet');
}

async function exportBackup() {
  const name = `한달얼마-백업-${todayStr()}.json`;
  const file = new File([JSON.stringify({ version: 1, entries }, null, 2)], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
    } catch (err) {
      if (err.name !== 'AbortError') toast('내보내지 못했어요.');
    }
    return;
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const isValidEntry = (e) => e && typeof e.id === 'string'
  && /^\d{4}-\d{2}-\d{2}$/.test(e.date)
  && Number.isInteger(e.amount) && e.amount > 0
  && typeof e.cat === 'string';

// 지금 기록은 지우지 않고, 파일에만 있는 기록을 더한다.
async function importBackup(file) {
  try {
    const parsed = JSON.parse(await file.text());
    const incoming = parsed.entries;
    if (!Array.isArray(incoming)) throw new Error('bad format');
    const known = new Set(entries.map((e) => e.id));
    const fresh = incoming.filter((e) => isValidEntry(e) && !known.has(e.id));
    entries.push(...fresh);
    persist();
    closeSheets();
    render();
    toast(`${fresh.length.toLocaleString('ko-KR')}건을 가져왔어요`);
  } catch {
    toast('이 파일은 읽을 수 없어요');
  }
}

let toastTimer;
let undoState = null;
function toast(message, undo = null) {
  undoState = undo;
  $('toast-text').textContent = message;
  $('toast-undo').hidden = !undo;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    $('toast').hidden = true;
    undoState = null;
  }, undo ? 5000 : 2400);
}
function undoLast() {
  if (!undoState) return;
  entries = undoState;
  undoState = null;
  persist();
  render();
  toast('되돌렸어요');
}

// 시트 윗부분을 아래로 끌면 닫힌다.
function enableSheetDrag(handle) {
  const sheet = handle.closest('.sheet');
  let startY = null;
  let dragged = 0;
  handle.addEventListener('touchstart', (ev) => {
    if (ev.target.closest('button, input')) return;
    startY = ev.touches[0].clientY;
    dragged = 0;
  }, { passive: true });
  handle.addEventListener('touchmove', (ev) => {
    if (startY === null) return;
    dragged = Math.max(0, ev.touches[0].clientY - startY);
    sheet.style.transform = `translateY(${dragged}px)`;
  }, { passive: true });
  handle.addEventListener('touchend', () => {
    if (startY === null) return;
    startY = null;
    sheet.style.transform = '';
    if (dragged > 80) closeSheets();
  });
}

// 메인 화면을 좌우로 밀면 달이 바뀐다.
function enableMonthSwipe(area) {
  let start = null;
  area.addEventListener('touchstart', (ev) => {
    start = ev.touches.length === 1 ? { x: ev.touches[0].clientX, y: ev.touches[0].clientY } : null;
  }, { passive: true });
  area.addEventListener('touchend', (ev) => {
    if (!start) return;
    const dx = ev.changedTouches[0].clientX - start.x;
    const dy = ev.changedTouches[0].clientY - start.y;
    start = null;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2) return;
    if (dx > 0) setMonth(addMonths(viewMonth, -1));
    else if (viewMonth < monthOf(todayStr())) setMonth(addMonths(viewMonth, 1));
  }, { passive: true });
}

// ---- 이벤트 ----
$('f-keypad').innerHTML = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0']
  .map((k) => `<button data-key="${k}">${k}</button>`).join('')
  + '<button data-key="back" aria-label="지우기">⌫</button>';

$('open-add').addEventListener('click', () => openEntry(null));
$('open-backup').addEventListener('click', openBackup);
$('backdrop').addEventListener('click', closeSheets);
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeSheets));
$('prev-month').addEventListener('click', () => setMonth(addMonths(viewMonth, -1)));
$('next-month').addEventListener('click', () => setMonth(addMonths(viewMonth, 1)));
$('month-title').addEventListener('click', () => setMonth(monthOf(todayStr())));
$('toast-undo').addEventListener('click', undoLast);
document.querySelectorAll('[data-drag]').forEach(enableSheetDrag);
enableMonthSwipe($('app'));

$('trend').addEventListener('click', (ev) => {
  const col = ev.target.closest('[data-month]');
  if (col) setMonth(col.dataset.month);
});
$('quick').addEventListener('click', (ev) => {
  const btn = ev.target.closest('[data-quick-cat]');
  if (btn) quickRecord(btn.dataset.quickCat, Number(btn.dataset.quickAmount));
});
$('breakdown').addEventListener('click', (ev) => {
  const btn = ev.target.closest('[data-filter]');
  if (!btn) return;
  filterCat = filterCat === btn.dataset.filter ? null : btn.dataset.filter;
  render();
});
$('clear-filter').addEventListener('click', () => { filterCat = null; render(); });
document.querySelectorAll('[data-days-ago]').forEach((b) => b.addEventListener('click', () => {
  $('f-date').value = daysAgoStr(Number(b.dataset.daysAgo));
  renderDatePicks();
}));
$('f-date').addEventListener('change', renderDatePicks);
$('list').addEventListener('click', (ev) => {
  const row = ev.target.closest('[data-edit]');
  if (row) openEntry(entries.find((e) => e.id === row.dataset.edit));
});
$('f-keypad').addEventListener('click', (ev) => {
  const btn = ev.target.closest('[data-key]');
  if (btn) pressKey(btn.dataset.key);
});
$('f-cats').addEventListener('click', (ev) => {
  const btn = ev.target.closest('[data-cat]');
  if (!btn) return;
  form.cat = btn.dataset.cat;
  // 금액을 아직 안 넣었으면 그 항목의 가장 최근 금액을 채워둔다.
  if (!form.amount) {
    const recent = recentAmounts(form.cat)[0];
    if (recent) { form.amount = String(recent); form.replaceOnType = true; }
  }
  renderForm();
});
$('f-recent').addEventListener('click', (ev) => {
  const btn = ev.target.closest('[data-amount]');
  if (!btn) return;
  form.amount = btn.dataset.amount;
  form.replaceOnType = true;
  renderForm();
});
$('f-plan-buttons').addEventListener('click', (ev) => {
  const btn = ev.target.closest('[data-months]');
  if (!btn) return;
  form.months = Number(btn.dataset.months);
  renderForm();
});
$('f-memo').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') ev.target.blur(); });
$('f-save').addEventListener('click', saveEntry);
$('f-delete').addEventListener('click', deleteEntry);
$('export').addEventListener('click', exportBackup);
$('import').addEventListener('change', (ev) => {
  const file = ev.target.files[0];
  ev.target.value = '';
  if (file) importBackup(file);
});

// 달이 바뀐 채로 앱을 다시 열었을 때 이번 달로 돌아온다.
let lastSeenToday = todayStr();
document.addEventListener('visibilitychange', () => {
  if (document.hidden || todayStr() === lastSeenToday) return;
  lastSeenToday = todayStr();
  viewMonth = monthOf(lastSeenToday);
  render();
});

render();

if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
