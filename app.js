const STORAGE_KEY = 'hanmonth.entries.v1';
const BUDGET_KEY = 'hanmonth.budget.v1';

const CATS = [
  // 기록 시트에서 5칸씩 한 줄: 먹고 마시기 / 사람·이동·물건 / 고정·가끔.
  { id: 'coffee', label: '커피', emoji: '☕️' },
  // 담배는 릴 하이브리드 기준: 담배 4,500 + 카트리지 500.
  { id: 'smoke', label: '담배', emoji: '🚬', presets: [5000, 4500, 500] },
  { id: 'store', label: '편의점', emoji: '🏪' },
  { id: 'solo', label: '혼밥', emoji: '🍙' },
  { id: 'delivery', label: '배달', emoji: '🛵' },
  { id: 'gf', label: '여자친구랑', emoji: '🍽️' },
  { id: 'friends', label: '친구들이랑', emoji: '🍻' },
  { id: 'transit', label: '교통', emoji: '🚌' },
  { id: 'coupay', label: '쿠페이', emoji: '🛒', presets: [100000] },
  { id: 'shopping', label: '쇼핑', emoji: '🛍️' },
  { id: 'study', label: '스터디카페', emoji: '📚' },
  { id: 'gym', label: '헬스장', emoji: '🏋️' },
  { id: 'hair', label: '미용실', emoji: '💈' },
  { id: 'health', label: '병원·약국', emoji: '💊' },
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
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateStr(d);
}
const todayStr = () => daysAgoStr(0);
const parseDate = (date) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
};
function addDays(date, n) {
  const d = parseDate(date);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}
// 달력과 같이 일요일을 한 주의 시작으로 본다.
const weekStartOf = (date) => addDays(date, -parseDate(date).getDay());
const lastDayOf = (ym) => addDays(`${addMonths(ym, 1)}-01`, -1);
const shortDate = (date) => `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`;
const rangeLabel = (from, to) => (from === to ? shortDate(from) : `${shortDate(from)} – ${shortDate(to)}`);

// ---- 시간 ----
function nowTime() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
// 시간 칸이 생기기 전 기록은 기록한 시각이 같은 날일 때만 그 시각을 쓴다.
function entryTime(e) {
  if (typeof e.time === 'string') return /^\d{2}:\d{2}$/.test(e.time) ? e.time : '';
  if (!e.createdAt) return '';
  const d = new Date(e.createdAt);
  return toDateStr(d) === e.date ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '';
}
function timeLabel(time) {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${pad(m)}`;
}
const byNewest = (a, b) => b.date.localeCompare(a.date)
  || entryTime(b).localeCompare(entryTime(a))
  || (b.createdAt || 0) - (a.createdAt || 0);
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

// 예산은 { total, cats: { 항목id: 금액 } } 하나로 매달 똑같이 쓴다.
function normalizeBudget(raw) {
  const cats = {};
  if (raw && raw.cats && typeof raw.cats === 'object') {
    for (const [cat, amount] of Object.entries(raw.cats)) {
      if (CAT_BY_ID[cat] && Number.isInteger(amount) && amount > 0) cats[cat] = amount;
    }
  }
  const total = raw && Number.isInteger(raw.total) && raw.total > 0 ? raw.total : 0;
  return { total, cats };
}
function loadBudget() {
  try {
    return normalizeBudget(JSON.parse(localStorage.getItem(BUDGET_KEY)));
  } catch {
    return normalizeBudget(null);
  }
}
function persistBudget() {
  try {
    localStorage.setItem(BUDGET_KEY, JSON.stringify(budget));
  } catch {
    toast('저장하지 못했어요. 저장 공간을 확인해주세요.');
  }
}
const hasBudget = () => budget.total > 0 || Object.keys(budget.cats).length > 0;

// ---- 화면 이동 ----
const VIEWS = { home: '가계부', budget: '예산', stats: '분석', search: '검색' };
const MONTH_VIEWS = ['home', 'budget', 'stats'];
const viewFromHash = () => {
  const id = location.hash.slice(1);
  return Object.hasOwn(VIEWS, id) ? id : 'home';
};

let entries = load();
let budget = loadBudget();
let view = viewFromHash();
let viewMonth = monthOf(todayStr());
let filterCat = null;
let picked = null; // 달력에서 고른 범위 { from, to }
let statsCat = null;

const snapshot = () => entries.map((e) => ({ ...e }));
function setMonth(ym) {
  viewMonth = ym;
  filterCat = null;
  picked = null;
  render();
}
function showMonthOf(date) {
  if (monthOf(date) === viewMonth) return;
  viewMonth = monthOf(date);
  picked = null;
}
function togglePicked(from, to) {
  picked = picked && picked.from === from && picked.to === to ? null : { from, to };
  render();
}
function setView(next) {
  closeNav();
  if (next === view) return;
  view = next;
  render();
  window.scrollTo(0, 0);
  if (view === 'search') $('search').focus();
}
function openNav() {
  $('sidebar').classList.add('open');
  $('nav-backdrop').hidden = false;
  $('open-nav').setAttribute('aria-expanded', 'true');
}
function closeNav() {
  $('sidebar').classList.remove('open');
  $('nav-backdrop').hidden = true;
  $('open-nav').setAttribute('aria-expanded', 'false');
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

// 여러 달짜리 이용권은 달 합계에만 나눠 넣고, 하루·한 주 합계에는 넣지 않는다.
const isPass = (e) => (e.months || 1) > 1;
const entriesBetween = (from, to) => entries.filter((e) => !isPass(e) && e.date >= from && e.date <= to);
const sumOf = (list) => list.reduce((sum, e) => sum + e.amount, 0);
const rangeTotal = (from, to) => sumOf(entriesBetween(from, to));
const catSpent = (cat, ym) => entries.reduce((sum, e) => sum + (e.cat === cat ? shareIn(e, ym) : 0), 0);
const percent = (part, whole) => Math.round((part / whole) * 100);
const daysIn = (ym) => Number(lastDayOf(ym).slice(8));
// 이번 달은 오늘까지, 지난 달은 그 달 전체 날수.
const daysElapsed = (ym) => (ym === monthOf(todayStr()) ? Number(todayStr().slice(8)) : daysIn(ym));
const dayDiff = (from, to) => Math.round((parseDate(to) - parseDate(from)) / 86400000);

function compactWon(n) {
  if (n < 10000) return n.toLocaleString('ko-KR');
  return `${Math.round(n / 1000) / 10}만`;
}

function render() {
  const [y, m] = viewMonth.split('-').map(Number);
  const monthView = MONTH_VIEWS.includes(view);
  $('month-nav').hidden = !monthView;
  $('view-title').hidden = monthView;
  $('view-title').textContent = VIEWS[view];
  $('month-title').textContent = `${y}년 ${m}월`;
  $('next-month').disabled = viewMonth >= monthOf(todayStr());
  for (const id of Object.keys(VIEWS)) $(`view-${id}`).hidden = id !== view;
  $('add-bar').hidden = view !== 'home';

  renderSidebar();
  if (view === 'home') renderHome();
  else if (view === 'budget') renderBudget();
  else if (view === 'stats') renderStats();
  else renderSearch();
}

function renderSidebar() {
  const spent = monthTotal(monthOf(todayStr()));
  $('side-sub').textContent = `이번 달 ${won(spent)}`;
  $('side-budget').textContent = budget.total ? `${percent(spent, budget.total)}%` : '';
  $('side-note').textContent = `기록 ${entries.length.toLocaleString('ko-KR')}건 · 이 폰에만 저장돼요`;
  document.querySelectorAll('.side-nav [data-view]').forEach((a) => {
    if (a.dataset.view === view) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

// ---- 가계부 ----
function renderHome() {
  if (filterCat && !entries.some((e) => e.cat === filterCat && shareIn(e, viewMonth))) filterCat = null;
  const total = monthTotal(viewMonth);
  $('total').textContent = won(total);
  $('delta').textContent = deltaText(total, monthTotal(addMonths(viewMonth, -1)));
  renderNowStats();
  renderBudgetLine(total);

  renderCalendar();
  renderPicked();
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

function renderNowStats() {
  const today = todayStr();
  if (viewMonth !== monthOf(today)) {
    $('now-stats').textContent = '';
    return;
  }
  const start = weekStartOf(today);
  $('now-stats').textContent = `오늘 ${won(rangeTotal(today, today))} · 이번 주 ${won(rangeTotal(start, addDays(start, 6)))}`;
}

function renderBudgetLine(total) {
  const el = $('budget-line');
  el.hidden = !budget.total;
  if (!budget.total) return;
  const left = budget.total - total;
  el.textContent = `예산의 ${percent(total, budget.total)}% · ${won(Math.abs(left))} ${left < 0 ? '넘음' : '남음'}`;
  el.classList.toggle('over', left < 0);
}

function renderCalendar() {
  const today = todayStr();
  const first = `${viewMonth}-01`;
  const last = lastDayOf(viewMonth);
  const lastShown = addDays(weekStartOf(last), 6);

  const totals = new Map();
  for (const e of entries) {
    if (!isPass(e)) totals.set(e.date, (totals.get(e.date) || 0) + e.amount);
  }
  let max = 1;
  for (const [date, amount] of totals) {
    if (date >= first && date <= last && amount > max) max = amount;
  }

  const head = [...'일월화수목금토', '주'].map((d) => `<div class="cal-head">${d}</div>`).join('');
  let cells = '';
  for (let week = weekStartOf(first); week <= lastShown; week = addDays(week, 7)) {
    for (let i = 0; i < 7; i += 1) {
      const date = addDays(week, i);
      const amount = totals.get(date) || 0;
      const classes = ['cal-day'];
      if (monthOf(date) !== viewMonth) classes.push('other');
      if (date === today) classes.push('today');
      if (picked && picked.from === date && picked.to === date) classes.push('picked');
      // 많이 쓴 날일수록 보라색이 진해진다.
      const tint = amount ? `background:rgba(168,130,255,${(0.1 + 0.4 * Math.sqrt(amount / max)).toFixed(2)})` : '';
      cells += `<button class="${classes.join(' ')}" style="${tint}" data-day="${date}" ${date > today ? 'disabled' : ''} aria-label="${shortDate(date)} ${won(amount)}">
        <span class="cal-num">${Number(date.slice(8))}</span>
        <span class="cal-amount">${amount ? compactWon(amount) : ''}</span>
      </button>`;
    }
    const end = addDays(week, 6);
    const weekSum = rangeTotal(week, end);
    const isPicked = picked && picked.from === week && picked.to === end;
    cells += `<button class="cal-week${isPicked ? ' picked' : ''}" data-week="${week}" aria-label="${rangeLabel(week, end)} 주간 합계 ${won(weekSum)}">
      <span class="cal-amount${weekSum ? '' : ' none'}">${weekSum ? compactWon(weekSum) : '–'}</span>
    </button>`;
  }
  $('calendar').innerHTML = head + cells;

  const hasPass = entries.some((e) => isPass(e) && shareIn(e, viewMonth));
  $('cal-note').hidden = !hasPass;
  $('cal-note').textContent = hasPass ? '여러 달짜리 이용권은 하루·주 합계에서 빼고 달 합계에만 나눠 넣었어요.' : '';
}

function dayGroupHtml(date, list) {
  return `<div class="day">
    <div class="day-head"><span>${dayLabel(date)}</span><span>${won(sumOf(list))}</span></div>
    ${list.map((e) => rowHtml(e, monthOf(e.date))).join('')}
  </div>`;
}

function groupByDay(list) {
  const days = new Map();
  for (const e of [...list].sort(byNewest)) {
    if (!days.has(e.date)) days.set(e.date, []);
    days.get(e.date).push(e);
  }
  return days;
}

function renderPicked() {
  const el = $('picked');
  el.hidden = !picked;
  if (!picked) {
    el.innerHTML = '';
    return;
  }
  const { from, to } = picked;
  const list = entriesBetween(from, to);
  const single = from === to;
  const start = weekStartOf(from);
  const sub = single ? `이 주(${rangeLabel(start, addDays(start, 6))}) 합계 ${won(rangeTotal(start, addDays(start, 6)))}` : '';
  const days = [...groupByDay(list).entries()];
  el.innerHTML = `<div class="picked-head">
      <span class="picked-title">${single ? dayLabel(from) : `${rangeLabel(from, to)} 한 주`}</span>
      <span class="picked-sum">${won(sumOf(list))}</span>
    </div>
    ${sub ? `<p class="picked-sub">${sub}</p>` : ''}
    ${list.length ? '' : `<p class="picked-empty">기록이 없어요.${single ? ' 이 상태로 기록하면 이 날짜로 들어가요.' : ''}</p>`}
    ${single
    ? list.sort(byNewest).map((e) => rowHtml(e, monthOf(e.date))).join('')
    : days.map(([date, rows]) => dayGroupHtml(date, rows)).join('')}`;
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
  entries.push({ id: crypto.randomUUID(), createdAt: Date.now(), date, time: nowTime(), amount, cat, memo: '', months: 1 });
  persist();
  showMonthOf(date);
  render();
  toast(`${CAT_BY_ID[cat].label} ${won(amount)} 기록했어요`, before);
}

// ym 없이 부르면 날짜를 붙이고 이용권도 전체 금액으로 보여준다.
function rowHtml(e, ym = null) {
  const c = CAT_BY_ID[e.cat] || CAT_BY_ID.etc;
  const months = e.months || 1;
  const notes = [];
  if (!ym) {
    const time = entryTime(e);
    notes.push(months > 1 ? `${months}개월권 · ${shortDate(e.date)} 결제` : `${shortDate(e.date)}${time ? ` ${timeLabel(time)}` : ''}`);
  } else if (months > 1) {
    const nth = monthDiff(monthOf(e.date), ym) + 1;
    notes.push(`${months}개월권 ${nth}/${months} · 총 ${won(e.amount)} · ${shortDate(e.date)} 결제`);
  } else if (entryTime(e)) {
    notes.push(timeLabel(entryTime(e)));
  }
  if (e.memo) notes.push(e.memo);
  return `<button class="row" data-edit="${esc(e.id)}">
    <span class="row-emoji" aria-hidden="true">${c.emoji}</span>
    <span class="row-text">
      <span class="row-title">${c.label}</span>
      ${notes.length ? `<span class="row-sub">${esc(notes.join(' · '))}</span>` : ''}
    </span>
    <span class="row-amount">${won(ym ? shareIn(e, ym) : e.amount)}</span>
  </button>`;
}

function renderList() {
  $('list-title').textContent = filterCat ? `${(CAT_BY_ID[filterCat] || CAT_BY_ID.etc).label} 기록` : '기록';
  $('clear-filter').hidden = !filterCat;
  const visible = entries.filter((e) => shareIn(e, viewMonth) > 0 && (!filterCat || e.cat === filterCat));
  const passes = visible.filter(isPass);
  const first = `${viewMonth}-01`;
  const last = lastDayOf(viewMonth);

  const weeks = new Map();
  for (const e of visible.filter((x) => !isPass(x)).sort(byNewest)) {
    const key = weekStartOf(e.date);
    if (!weeks.has(key)) weeks.set(key, []);
    weeks.get(key).push(e);
  }

  // 달이 걸친 주는 이 달에 속한 날짜만 보여준다.
  const weekHtml = [...weeks.entries()].map(([start, list]) => {
    const from = start < first ? first : start;
    const end = addDays(start, 6);
    const to = end > last ? last : end;
    return `<div class="week-block">
      <div class="week-head"><span>${rangeLabel(from, to)}</span><span>${won(sumOf(list))}</span></div>
      ${[...groupByDay(list).entries()].map(([date, rows]) => dayGroupHtml(date, rows)).join('')}
    </div>`;
  }).join('');

  const passSum = passes.reduce((s, e) => s + shareIn(e, viewMonth), 0);
  const passHtml = passes.length
    ? `<div class="day">
        <div class="day-head"><span>이 달에 나눠 넣은 이용권</span><span>${won(passSum)}</span></div>
        ${passes.map((e) => rowHtml(e, viewMonth)).join('')}
      </div>`
    : '';

  $('list').innerHTML = weekHtml + passHtml;
}

// ---- 예산 ----
// pace는 이번 달에서 오늘이 어디쯤인지(0~1). 막대 위에 세로선으로 그린다.
function meterHtml(value, max, pace = null) {
  return `<span class="meter${value > max ? ' over' : ''}">
    <span class="meter-fill" style="width:${Math.min(100, (value / max) * 100)}%"></span>
    ${pace === null ? '' : `<span class="meter-pace" style="left:${pace * 100}%"></span>`}
  </span>`;
}

function renderBudget() {
  const total = monthTotal(viewMonth);
  const hero = $('budget-hero');
  if (!budget.total) {
    hero.innerHTML = `<p class="budget-left">예산을 정해보세요</p>
      <p class="budget-sub">한 달에 얼마까지 쓸지 정해두면 남은 돈과 하루에 쓸 수 있는 돈을 알려드려요.</p>
      <button class="primary budget-start" data-budget="total">예산 정하기</button>`;
  } else {
    const left = budget.total - total;
    const isNow = viewMonth === monthOf(todayStr());
    const elapsed = daysElapsed(viewMonth);
    const days = daysIn(viewMonth);
    const lines = [`${won(budget.total)} 중 ${won(total)} 썼어요 (${percent(total, budget.total)}%)`];
    if (isNow) {
      const daysLeft = days - elapsed + 1;
      if (left > 0) lines.push(`남은 ${daysLeft}일 동안 하루 ${won(Math.floor(left / daysLeft))}씩 쓸 수 있어요`);
      lines.push(`오늘까지 적당한 건 ${won(Math.round((budget.total * elapsed) / days))}이에요 (흰 선)`);
      if (elapsed >= 3) lines.push(`이 속도면 말일까지 약 ${won(Math.round((total / elapsed) * days / 1000) * 1000)}`);
    }
    const verb = left < 0 ? '넘었어요' : isNow ? '남았어요' : '남겼어요';
    hero.innerHTML = `<p class="budget-left${left < 0 ? ' over' : ''}">${won(Math.abs(left))} ${verb}</p>
      ${meterHtml(total, budget.total, isNow ? elapsed / days : null)}
      ${lines.map((l) => `<p class="budget-sub">${l}</p>`).join('')}`;
  }

  $('budget-total-btn').innerHTML = `<span>한 달 예산</span><span class="budget-val">${budget.total ? won(budget.total) : '정하기'} ›</span>`;
  $('budget-list').innerHTML = CATS.map((c) => {
    const spent = catSpent(c.id, viewMonth);
    const limit = budget.cats[c.id] || 0;
    return `<li><button class="budget-row" data-budget="${c.id}">
      <span class="bd-row">
        <span><span class="bd-emoji" aria-hidden="true">${c.emoji}</span>${c.label}</span>
        <span class="bd-amount">${won(spent)}<span class="bd-share">${limit ? `/ ${won(limit)}` : '예산 없음 ›'}</span></span>
      </span>
      ${limit ? meterHtml(spent, limit) : ''}
    </button></li>`;
  }).join('');
}

const budgetForm = { key: null, amount: '', replaceOnType: false };

// 지난 3달 평균을 만 원 단위로 올려서 제안한다. 기록이 없던 달은 뺀다.
function budgetSuggestion(key) {
  const months = [1, 2, 3].map((i) => addMonths(monthOf(todayStr()), -i));
  const totals = months.map((ym) => (key === 'total' ? monthTotal(ym) : catSpent(key, ym))).filter(Boolean);
  if (!totals.length) return 0;
  return Math.ceil(totals.reduce((a, b) => a + b, 0) / totals.length / 10000) * 10000;
}

function openBudget(key) {
  const current = key === 'total' ? budget.total : budget.cats[key] || 0;
  budgetForm.key = key;
  budgetForm.amount = current ? String(current) : '';
  budgetForm.replaceOnType = Boolean(current);
  const c = CAT_BY_ID[key];
  $('b-title').textContent = c ? `${c.emoji} ${c.label} 예산` : '한 달 예산';
  $('b-clear').hidden = !current;
  renderBudgetForm();
  openSheet('budget-sheet');
}

function renderBudgetForm() {
  const amount = Number(budgetForm.amount) || 0;
  $('b-amount').textContent = won(amount);
  $('b-amount').classList.toggle('placeholder', !amount);
  const suggest = budgetSuggestion(budgetForm.key);
  $('b-suggest').innerHTML = suggest
    ? `<button class="chip" data-amount="${suggest}">최근 3달 평균 ${suggest.toLocaleString('ko-KR')}</button>`
    : '';
  $('b-save').disabled = !amount;
}

function saveBudget(amount) {
  if (budgetForm.key === 'total') budget.total = amount;
  else if (amount) budget.cats[budgetForm.key] = amount;
  else delete budget.cats[budgetForm.key];
  persistBudget();
  closeSheets();
  render();
  toast(amount ? `예산을 ${won(amount)}으로 정했어요` : '예산을 없앴어요');
}

// ---- 분석 ----
function renderStats() {
  const ym = viewMonth;
  const first = `${ym}-01`;
  const total = monthTotal(ym);
  const elapsed = daysElapsed(ym);
  const daily = entriesBetween(first, lastDayOf(ym));

  const byDay = new Map();
  for (const e of daily) byDay.set(e.date, (byDay.get(e.date) || 0) + e.amount);
  let topDay = null;
  for (const [date, amount] of byDay) if (!topDay || amount > topDay[1]) topDay = [date, amount];
  let noSpend = 0;
  for (let i = 0; i < elapsed; i += 1) if (!byDay.has(addDays(first, i))) noSpend += 1;
  const paid = entries.filter((e) => monthOf(e.date) === ym);

  const cards = [
    { label: '하루 평균', value: won(Math.round(total / elapsed)), sub: `${elapsed}일 기준` },
    { label: '가장 많이 쓴 날', value: topDay ? won(topDay[1]) : '–', sub: topDay ? dayLabel(topDay[0]) : '기록 없음', day: topDay && topDay[0] },
    { label: '무지출', value: `${noSpend}일`, sub: `${elapsed}일 중` },
    { label: '기록', value: `${paid.length}건`, sub: paid.length ? `건당 ${won(Math.round(sumOf(paid) / paid.length))}` : '' },
  ];
  $('stat-grid').innerHTML = cards.map((c) => {
    const inner = `<span class="stat-label">${c.label}</span><span class="stat-value">${c.value}</span><span class="stat-sub">${c.sub}</span>`;
    return c.day ? `<button class="stat-card" data-goto-day="${c.day}">${inner}</button>` : `<div class="stat-card">${inner}</div>`;
  }).join('');

  const weekday = Array(7).fill(0);
  for (const e of daily) weekday[parseDate(e.date).getDay()] += e.amount;
  const wdMax = Math.max(...weekday, 1);
  $('weekday').innerHTML = weekday.map((amount, i) => {
    const height = amount ? Math.max(4, Math.round((amount / wdMax) * 72)) : 0;
    return `<div class="trend-col${amount && amount === wdMax ? ' current' : ''}">
      <span class="trend-plot"><span class="trend-bar" style="height:${height}px"></span></span>
      <span class="trend-label">${'일월화수목금토'[i]}</span>
      <span class="trend-value">${amount ? compactWon(amount) : ''}</span>
    </div>`;
  }).join('');

  renderCatTrend();
  renderCycle();
}

function renderCatTrend() {
  const used = CATS.filter((c) => entries.some((e) => e.cat === c.id));
  $('cat-trend-section').hidden = !used.length;
  if (!used.length) return;
  if (!used.some((c) => c.id === statsCat)) {
    statsCat = [...used].sort((a, b) => catSpent(b.id, viewMonth) - catSpent(a.id, viewMonth))[0].id;
  }
  const chips = $('stat-cats');
  const keepScroll = chips.scrollLeft;
  chips.innerHTML = used.map((c) => `<button class="chip" data-stat-cat="${c.id}" aria-pressed="${c.id === statsCat}">${c.emoji} ${c.label}</button>`).join('');
  // 고른 칩이 가로 스크롤 밖에 있으면 보이게 당겨온다.
  const on = chips.querySelector('[aria-pressed="true"]');
  chips.scrollLeft = keepScroll;
  if (on.offsetLeft < chips.scrollLeft || on.offsetLeft + on.offsetWidth > chips.scrollLeft + chips.clientWidth) {
    chips.scrollLeft = on.offsetLeft - 20;
  }

  const months = Array.from({ length: 6 }, (_, i) => addMonths(viewMonth, i - 5));
  const totals = months.map((ym) => catSpent(statsCat, ym));
  const max = Math.max(...totals, 1);
  $('cat-trend').innerHTML = months.map((ym, i) => {
    const label = `${Number(ym.slice(5))}월`;
    const height = totals[i] ? Math.max(4, Math.round((totals[i] / max) * 72)) : 0;
    return `<button class="trend-col${ym === viewMonth ? ' current' : ''}" data-month="${ym}" aria-label="${label} ${won(totals[i])}">
      <span class="trend-plot"><span class="trend-bar" style="height:${height}px"></span></span>
      <span class="trend-label">${label}</span>
      <span class="trend-value">${totals[i] ? compactWon(totals[i]) : ''}</span>
    </button>`;
  }).join('');
  // 기록을 시작하기 전 달은 평균에서 뺀다.
  const firstMonth = entries.reduce((min, e) => (monthOf(e.date) < min ? monthOf(e.date) : min), viewMonth);
  const counted = totals.filter((_, i) => months[i] >= firstMonth);
  const avg = Math.round(counted.reduce((a, b) => a + b, 0) / counted.length);
  $('cat-trend-note').textContent = `최근 ${counted.length}개월 한 달 평균 ${won(avg)}`;
}

// 항목마다 마지막으로 쓴 날과, 최근 6번 기준 평소 주기. 미용실처럼 가끔 가는 곳에 쓸모 있다.
function cycleItems() {
  const today = todayStr();
  return CATS.map((c) => {
    const dates = [...new Set(entries.filter((e) => e.cat === c.id && e.date <= today).map((e) => e.date))].sort().slice(-6);
    if (!dates.length) return null;
    const last = dates[dates.length - 1];
    const every = dates.length > 1 ? Math.round(dayDiff(dates[0], last) / (dates.length - 1)) : 0;
    return { cat: c, last, since: dayDiff(last, today), every };
  }).filter(Boolean).sort((a, b) => b.since - a.since);
}

function renderCycle() {
  const items = cycleItems();
  $('cycle-section').hidden = !items.length;
  $('cycle').innerHTML = items.map(({ cat, last, since, every }) => {
    const sinceText = since === 0 ? '오늘' : since === 1 ? '어제' : `${since}일 전`;
    const due = every >= 7 && since > every;
    return `<li class="cycle-row">
      <span class="row-emoji" aria-hidden="true">${cat.emoji}</span>
      <span class="row-text">
        <span class="row-title">${cat.label}</span>
        <span class="row-sub">${every ? `보통 ${every}일마다` : '아직 한 번'} · ${shortDate(last)}</span>
      </span>
      <span class="cycle-since">${sinceText}${due ? '<span class="cycle-tag">때 됐어요</span>' : ''}</span>
    </li>`;
  }).join('');
}

// ---- 검색 ----
const SEARCH_LIMIT = 200;

// 띄어쓰기로 나눈 단어가 모두 항목 이름·메모·금액 중 하나에 들어 있어야 한다.
function searchMatches(query) {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter((e) => {
    const c = CAT_BY_ID[e.cat] || CAT_BY_ID.etc;
    const text = `${c.label} ${e.memo || ''}`.toLowerCase();
    return tokens.every((t) => {
      const digits = t.replace(/[,원]/g, '');
      return text.includes(t) || (/^\d+$/.test(digits) && String(e.amount).includes(digits));
    });
  }).sort(byNewest);
}

function renderSearch() {
  const query = $('search').value.trim();
  $('search-cats').hidden = Boolean(query);
  $('search-cats').innerHTML = CATS.map((c) => `<button class="chip" data-search="${c.label}">${c.emoji} ${c.label}</button>`).join('');
  if (!query) {
    $('search-summary').textContent = `전체 기록 ${entries.length.toLocaleString('ko-KR')}건에서 찾아요.`;
    $('search-results').innerHTML = '';
    return;
  }
  const found = searchMatches(query);
  $('search-summary').textContent = found.length
    ? `${found.length.toLocaleString('ko-KR')}건 · 합계 ${won(sumOf(found))}${found.length > SEARCH_LIMIT ? ` · 최근 ${SEARCH_LIMIT}건만 보여요` : ''}`
    : '찾는 기록이 없어요';
  const months = new Map();
  for (const e of found.slice(0, SEARCH_LIMIT)) {
    const ym = monthOf(e.date);
    if (!months.has(ym)) months.set(ym, []);
    months.get(ym).push(e);
  }
  $('search-results').innerHTML = [...months.entries()].map(([ym, list]) => {
    const [y, m] = ym.split('-').map(Number);
    return `<div class="day">
      <div class="day-head"><span>${y}년 ${m}월</span><span>${won(sumOf(list))}</span></div>
      ${list.map((e) => rowHtml(e)).join('')}
    </div>`;
  }).join('');
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
  for (const preset of CAT_BY_ID[cat].presets || []) {
    if (!seen.includes(preset) && seen.length < 3) seen.push(preset);
  }
  return seen;
}

function openEntry(entry) {
  form.id = entry ? entry.id : null;
  form.amount = entry ? String(entry.amount) : '';
  form.cat = entry ? entry.cat : null;
  form.months = entry && entry.months ? entry.months : lastGymMonths();
  form.replaceOnType = Boolean(entry);
  const pickedDay = picked && picked.from === picked.to ? picked.from : null;
  $('f-date').value = entry ? entry.date : pickedDay || todayStr();
  $('f-date').max = todayStr();
  $('f-time').value = entry ? entryTime(entry) : nowTime();
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

// 기록 시트와 예산 시트가 같은 키패드를 쓴다.
function typeKey(state, key) {
  if (key === 'back') {
    state.amount = state.amount.slice(0, -1);
  } else {
    if (state.replaceOnType) state.amount = '';
    const next = (state.amount + key).replace(/^0+/, '');
    if (next.length <= MAX_DIGITS) state.amount = next;
  }
  state.replaceOnType = false;
}

function saveEntry() {
  const amount = Number(form.amount) || 0;
  if (!form.cat || !amount) return;
  const before = snapshot();
  const data = {
    date: $('f-date').value || todayStr(),
    time: $('f-time').value,
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
  showMonthOf(data.date);
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
  closeNav();
  $('toast').hidden = true;
  $('backdrop').hidden = false;
  $(id).hidden = false;
}
function closeSheets() {
  $('backdrop').hidden = true;
  document.querySelectorAll('.sheet').forEach((s) => { s.hidden = true; });
}

// ---- 백업 ----
function openBackup() {
  $('backup-count').textContent = `지금 기록 ${entries.length.toLocaleString('ko-KR')}건`;
  openSheet('backup-sheet');
}

async function exportBackup() {
  const name = `한달얼마-백업-${todayStr()}.json`;
  const file = new File([JSON.stringify({ version: 2, entries, budget }, null, 2)], name, { type: 'application/json' });
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

// 지금 기록은 지우지 않고, 파일에만 있는 기록을 더한다. 예산은 아직 없을 때만 가져온다.
async function importBackup(file) {
  try {
    const parsed = JSON.parse(await file.text());
    const incoming = parsed.entries;
    if (!Array.isArray(incoming)) throw new Error('bad format');
    const known = new Set(entries.map((e) => e.id));
    const fresh = incoming.filter((e) => isValidEntry(e) && !known.has(e.id));
    entries.push(...fresh);
    persist();
    if (!hasBudget() && parsed.budget) {
      budget = normalizeBudget(parsed.budget);
      persistBudget();
    }
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
    if (!start || !MONTH_VIEWS.includes(view)) return;
    const dx = ev.changedTouches[0].clientX - start.x;
    const dy = ev.changedTouches[0].clientY - start.y;
    start = null;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2) return;
    if (dx > 0) setMonth(addMonths(viewMonth, -1));
    else if (viewMonth < monthOf(todayStr())) setMonth(addMonths(viewMonth, 1));
  }, { passive: true });
}

// 메뉴를 왼쪽으로 밀면 닫힌다.
function enableNavSwipe(nav) {
  let startX = null;
  nav.addEventListener('touchstart', (ev) => { startX = ev.touches[0].clientX; }, { passive: true });
  nav.addEventListener('touchend', (ev) => {
    if (startX !== null && ev.changedTouches[0].clientX - startX < -60) closeNav();
    startX = null;
  }, { passive: true });
}

// ---- 이벤트 ----
const keypadHtml = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0']
  .map((k) => `<button data-key="${k}">${k}</button>`).join('')
  + '<button data-key="back" aria-label="지우기">⌫</button>';
$('f-keypad').innerHTML = keypadHtml;
$('b-keypad').innerHTML = keypadHtml;

$('open-add').addEventListener('click', () => openEntry(null));
$('open-backup').addEventListener('click', openBackup);
$('open-nav').addEventListener('click', openNav);
$('nav-backdrop').addEventListener('click', closeNav);
enableNavSwipe($('sidebar'));
// 지금 화면을 또 누르면 hashchange가 안 생기니 메뉴만 닫는다.
document.querySelectorAll('.side-nav [data-view]').forEach((a) => a.addEventListener('click', closeNav));
window.addEventListener('hashchange', () => setView(viewFromHash()));
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Escape') return;
  closeNav();
  closeSheets();
});
$('backdrop').addEventListener('click', closeSheets);
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeSheets));
$('prev-month').addEventListener('click', () => setMonth(addMonths(viewMonth, -1)));
$('next-month').addEventListener('click', () => setMonth(addMonths(viewMonth, 1)));
$('month-title').addEventListener('click', () => setMonth(monthOf(todayStr())));
$('toast-undo').addEventListener('click', undoLast);
document.querySelectorAll('[data-drag]').forEach(enableSheetDrag);
enableMonthSwipe($('app'));

$('calendar').addEventListener('click', (ev) => {
  const day = ev.target.closest('[data-day]');
  if (day) { togglePicked(day.dataset.day, day.dataset.day); return; }
  const week = ev.target.closest('[data-week]');
  if (week) togglePicked(week.dataset.week, addDays(week.dataset.week, 6));
});
// 어느 화면에서든 기록 줄을 누르면 고칠 수 있다.
$('app').addEventListener('click', (ev) => {
  const row = ev.target.closest('[data-edit]');
  if (row) openEntry(entries.find((e) => e.id === row.dataset.edit));
});
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
$('f-keypad').addEventListener('click', (ev) => {
  const btn = ev.target.closest('[data-key]');
  if (!btn) return;
  typeKey(form, btn.dataset.key);
  renderForm();
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
$('view-budget').addEventListener('click', (ev) => {
  const btn = ev.target.closest('[data-budget]');
  if (btn) openBudget(btn.dataset.budget);
});
$('b-keypad').addEventListener('click', (ev) => {
  const btn = ev.target.closest('[data-key]');
  if (!btn) return;
  typeKey(budgetForm, btn.dataset.key);
  renderBudgetForm();
});
$('b-suggest').addEventListener('click', (ev) => {
  const btn = ev.target.closest('[data-amount]');
  if (!btn) return;
  budgetForm.amount = btn.dataset.amount;
  budgetForm.replaceOnType = true;
  renderBudgetForm();
});
$('b-save').addEventListener('click', () => saveBudget(Number(budgetForm.amount) || 0));
$('b-clear').addEventListener('click', () => saveBudget(0));

$('stat-grid').addEventListener('click', (ev) => {
  const card = ev.target.closest('[data-goto-day]');
  if (!card) return;
  picked = { from: card.dataset.gotoDay, to: card.dataset.gotoDay };
  location.hash = 'home';
});
$('stat-cats').addEventListener('click', (ev) => {
  const btn = ev.target.closest('[data-stat-cat]');
  if (!btn) return;
  statsCat = btn.dataset.statCat;
  renderCatTrend();
});
$('cat-trend').addEventListener('click', (ev) => {
  const col = ev.target.closest('[data-month]');
  if (col) setMonth(col.dataset.month);
});

$('search').addEventListener('input', renderSearch);
$('search-cats').addEventListener('click', (ev) => {
  const btn = ev.target.closest('[data-search]');
  if (!btn) return;
  $('search').value = btn.dataset.search;
  renderSearch();
});

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
if ('serviceWorker' in navigator) {
  // 새 버전 서비스워커가 이 화면을 넘겨받으면 한 번 새로고침해서 새 파일로 다시 그린다.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
