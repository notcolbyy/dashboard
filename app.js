// ─── My Dashboard — app.js ────────────────────────────────────────
// All config is loaded from localStorage (set via Settings page).
// Nothing sensitive is ever committed to GitHub.

// ═══════════════════════════════════════════════════════════════════
// CONFIG — reads keys you save in Settings
// ═══════════════════════════════════════════════════════════════════
const Config = {
  get googleClientId()  { return localStorage.getItem('cfg_google_client_id') || ''; },
  get openrouterKey()   { return localStorage.getItem('cfg_openrouter_key') || ''; },
  get finnhubKey()      { return localStorage.getItem('cfg_finnhub_key') || ''; },
  get userName()        { return localStorage.getItem('cfg_name') || ''; },
  get holdings()        { try { return JSON.parse(localStorage.getItem('cfg_holdings') || '[]'); } catch { return []; } },
  get googleToken()     { return localStorage.getItem('google_access_token') || ''; },
  set googleToken(v)    { localStorage.setItem('google_access_token', v); },
};

// ═══════════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════════
function initNav() {
  document.querySelectorAll('.nav-item, .link-btn[data-section], a[data-section]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      const sec = el.dataset.section;
      if (sec) navigate(sec);
    });
  });
}

function navigate(sectionId) {
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.section === sectionId);
  });
  document.querySelectorAll('.section').forEach(s => {
    s.classList.toggle('active', s.id === `section-${sectionId}`);
  });
  if (sectionId === 'calendar') renderCalendar();
  if (sectionId === 'markets') loadMarkets();
  if (sectionId === 'grades') renderGradesPage();
}

// ═══════════════════════════════════════════════════════════════════
// CLOCK & DATE
// ═══════════════════════════════════════════════════════════════════
function initClock() {
  const clockEl = document.getElementById('clock');
  const dateEl  = document.getElementById('today-date');

  function tick() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    dateEl.textContent  = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }
  tick();
  setInterval(tick, 1000);
}

// ═══════════════════════════════════════════════════════════════════
// GREETING
// ═══════════════════════════════════════════════════════════════════
function initGreeting() {
  const titleEl = document.querySelector('.section-title');
  const hour = new Date().getHours();
  const name = Config.userName ? `, ${Config.userName}` : '';
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  titleEl.innerHTML = `${greet}${name}<span class="greeting-dot">.</span>`;
}

// ═══════════════════════════════════════════════════════════════════
// GOOGLE OAUTH
// ═══════════════════════════════════════════════════════════════════
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
].join(' ');

function googleAuth() {
  if (!Config.googleClientId) {
    alert('Add your Google Client ID in Settings first.');
    navigate('settings');
    return;
  }
  const params = new URLSearchParams({
    client_id:     Config.googleClientId,
    redirect_uri:  window.location.origin + window.location.pathname,
    response_type: 'token',
    scope:         SCOPES,
    prompt:        'consent',
  });
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

function handleOAuthCallback() {
  const hash = window.location.hash;
  if (!hash) return;
  const params = new URLSearchParams(hash.slice(1));
  const token = params.get('access_token');
  if (token) {
    Config.googleToken = token;
    window.history.replaceState({}, document.title, window.location.pathname);
    loadGoogleData();
  }
}

// ═══════════════════════════════════════════════════════════════════
// GOOGLE CALENDAR
// ═══════════════════════════════════════════════════════════════════
let calendarEvents = [];

async function loadCalendar() {
  if (!Config.googleToken) return;
  const now   = new Date();
  const start = new Date(now); start.setHours(0,0,0,0);
  const end   = new Date(now); end.setHours(23,59,59,999);

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      new URLSearchParams({
        timeMin:      start.toISOString(),
        timeMax:      end.toISOString(),
        singleEvents: true,
        orderBy:      'startTime',
        maxResults:   20,
      }),
      { headers: { Authorization: `Bearer ${Config.googleToken}` } }
    );
    const data = await res.json();
    if (data.error) { handleGoogleError(data.error); return; }
    calendarEvents = data.items || [];
    renderTodayEvents(calendarEvents);
  } catch (e) {
    console.error('Calendar error', e);
  }
}

async function loadFutureEvents() {
  if (!Config.googleToken) return [];
  const now  = new Date();
  const end  = new Date(now); end.setDate(end.getDate() + 30);
  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      new URLSearchParams({
        timeMin:      now.toISOString(),
        timeMax:      end.toISOString(),
        singleEvents: true,
        orderBy:      'startTime',
        maxResults:   50,
      }),
      { headers: { Authorization: `Bearer ${Config.googleToken}` } }
    );
    const data = await res.json();
    return data.items || [];
  } catch { return []; }
}

function renderTodayEvents(events) {
  const el = document.getElementById('today-events');
  const countEl = document.getElementById('event-count');

  if (!events.length) {
    el.innerHTML = '<div class="timeline-empty"><p>No events today — enjoy the free time.</p></div>';
    countEl.textContent = '0 events';
    return;
  }
  countEl.textContent = `${events.length} event${events.length !== 1 ? 's' : ''}`;
  el.innerHTML = events.map(evt => {
    const start = evt.start?.dateTime ? new Date(evt.start.dateTime) : null;
    const timeStr = start ? start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'All day';
    return `
      <div class="timeline-event">
        <span class="evt-time">${timeStr}</span>
        <div class="evt-dot"></div>
        <div class="evt-info">
          <div class="evt-title">${escHtml(evt.summary || 'Untitled')}</div>
          ${evt.location ? `<div class="evt-sub">${escHtml(evt.location)}</div>` : ''}
        </div>
      </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════
// GOOGLE CLASSROOM
// ═══════════════════════════════════════════════════════════════════
let assignments = [];

async function loadClassroom() {
  if (!Config.googleToken) return;
  try {
    // Get courses
    const cRes = await fetch(
      'https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE&pageSize=20',
      { headers: { Authorization: `Bearer ${Config.googleToken}` } }
    );
    const cData = await cRes.json();
    if (cData.error) { handleGoogleError(cData.error); return; }
    const courses = cData.courses || [];

    // Get coursework for each course
    const allWork = [];
    for (const course of courses.slice(0, 8)) {
      try {
        const wRes = await fetch(
          `https://classroom.googleapis.com/v1/courses/${course.id}/courseWork?pageSize=20&orderBy=dueDate+desc`,
          { headers: { Authorization: `Bearer ${Config.googleToken}` } }
        );
        const wData = await wRes.json();
        const work = (wData.courseWork || []).map(w => ({ ...w, courseName: course.name }));
        allWork.push(...work);
      } catch {}
    }

    // Get student submissions to check completion
    assignments = [];
    for (const work of allWork) {
      try {
        const sRes = await fetch(
          `https://classroom.googleapis.com/v1/courses/${work.courseId}/courseWork/${work.id}/studentSubmissions?userId=me`,
          { headers: { Authorization: `Bearer ${Config.googleToken}` } }
        );
        const sData = await sRes.json();
        const sub = (sData.studentSubmissions || [])[0];
        assignments.push({
          id:         work.id,
          title:      work.title,
          course:     work.courseName,
          dueDate:    work.dueDate,
          state:      sub?.state || 'NEW',
          turnedIn:   sub?.state === 'TURNED_IN' || sub?.state === 'RETURNED',
          late:       sub?.late || false,
        });
      } catch {
        assignments.push({
          id: work.id, title: work.title, course: work.courseName,
          dueDate: work.dueDate, state: 'NEW', turnedIn: false, late: false,
        });
      }
    }

    renderDueSoon();
    renderMissing();
    renderAssignmentsPage();
  } catch (e) {
    console.error('Classroom error', e);
  }
}

function dueDateStr(d) {
  if (!d || !d.year) return '';
  return new Date(d.year, (d.month || 1) - 1, d.day || 1)
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isPastDue(d) {
  if (!d || !d.year) return false;
  const due = new Date(d.year, (d.month || 1) - 1, d.day || 1);
  return due < new Date();
}

function renderDueSoon() {
  const el = document.getElementById('due-soon-list');
  const upcoming = assignments
    .filter(a => !a.turnedIn && !isPastDue(a.dueDate))
    .sort((a, b) => {
      const da = a.dueDate ? new Date(a.dueDate.year, (a.dueDate.month||1)-1, a.dueDate.day||1) : new Date('2099');
      const db = b.dueDate ? new Date(b.dueDate.year, (b.dueDate.month||1)-1, b.dueDate.day||1) : new Date('2099');
      return da - db;
    })
    .slice(0, 5);

  if (!upcoming.length) {
    el.innerHTML = '<p class="empty-note">All caught up! No upcoming assignments.</p>';
    return;
  }
  el.innerHTML = upcoming.map(a => `
    <div class="list-item">
      <div class="list-item-left">
        <span class="list-item-title">${escHtml(a.title)}</span>
        <span class="list-item-sub">${escHtml(a.course)}</span>
      </div>
      <span class="list-item-right">${dueDateStr(a.dueDate)}</span>
    </div>`).join('');
}

function renderMissing() {
  const el = document.getElementById('missing-list');
  const countEl = document.getElementById('missing-count');
  const missing = assignments.filter(a => !a.turnedIn && isPastDue(a.dueDate));
  countEl.textContent = missing.length || '0';
  if (!missing.length) {
    el.innerHTML = '<p class="empty-note">No missing assignments. Nice work!</p>';
    document.getElementById('missing-card').style.borderLeftColor = 'var(--green)';
    return;
  }
  el.innerHTML = missing.map(a => `
    <div class="list-item">
      <div class="list-item-left">
        <span class="list-item-title">${escHtml(a.title)}</span>
        <span class="list-item-sub">${escHtml(a.course)}</span>
      </div>
      <span class="pill pill-red">Missing</span>
    </div>`).join('');
}

let assignmentFilter = 'all';
function renderAssignmentsPage() {
  const el = document.getElementById('assignments-list');
  let filtered = [...assignments];
  if (assignmentFilter === 'upcoming') filtered = filtered.filter(a => !a.turnedIn && !isPastDue(a.dueDate));
  if (assignmentFilter === 'missing')  filtered = filtered.filter(a => !a.turnedIn && isPastDue(a.dueDate));
  if (assignmentFilter === 'done')     filtered = filtered.filter(a => a.turnedIn);

  if (!filtered.length) {
    el.innerHTML = '<div style="padding:24px"><p class="empty-note">No assignments in this category.</p></div>';
    return;
  }
  el.innerHTML = filtered.map(a => `
    <div class="assignment-item">
      <div class="asgn-left">
        <div class="asgn-check ${a.turnedIn ? 'done' : ''}" data-id="${a.id}">
          ${a.turnedIn ? '✓' : ''}
        </div>
        <div class="asgn-info">
          <div class="asgn-title">${escHtml(a.title)}</div>
          <div class="asgn-course">${escHtml(a.course)}</div>
        </div>
      </div>
      <div class="asgn-right">
        <div class="asgn-due">${dueDateStr(a.dueDate) || 'No due date'}</div>
        ${isPastDue(a.dueDate) && !a.turnedIn ? '<span class="pill pill-red" style="margin-top:4px">Missing</span>' : ''}
        ${a.turnedIn ? '<span class="pill pill-green" style="margin-top:4px">Turned in</span>' : ''}
      </div>
    </div>`).join('');
}

// ═══════════════════════════════════════════════════════════════════
// GMAIL
// ═══════════════════════════════════════════════════════════════════
async function loadGmail() {
  if (!Config.googleToken) return;
  try {
    const res = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=8&labelIds=INBOX&q=is:unread',
      { headers: { Authorization: `Bearer ${Config.googleToken}` } }
    );
    const data = await res.json();
    if (data.error) { handleGoogleError(data.error); return; }
    const messages = data.messages || [];
    const emails = await Promise.all(
      messages.slice(0, 6).map(m => fetchEmailMeta(m.id))
    );
    renderMailDigest(emails.filter(Boolean));
    renderMailPage(emails.filter(Boolean));
  } catch (e) {
    console.error('Gmail error', e);
  }
}

async function fetchEmailMeta(id) {
  try {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${Config.googleToken}` } }
    );
    const data = await res.json();
    const headers = data.payload?.headers || [];
    const get = name => (headers.find(h => h.name === name) || {}).value || '';
    const from = get('From').replace(/<.*>/, '').trim().replace(/"/g, '') || 'Unknown';
    return {
      id,
      sender:  from,
      subject: get('Subject') || '(no subject)',
      date:    get('Date'),
      snippet: data.snippet || '',
    };
  } catch { return null; }
}

function renderMailDigest(emails) {
  const el = document.getElementById('mail-digest');
  if (!emails.length) {
    el.innerHTML = '<p class="empty-note">No unread emails.</p>';
    return;
  }
  el.innerHTML = emails.slice(0, 4).map(e => `
    <div class="list-item">
      <div class="list-item-left">
        <span class="list-item-title">${escHtml(e.sender)}</span>
        <span class="list-item-sub">${escHtml(e.subject)}</span>
      </div>
    </div>`).join('');
}

function renderMailPage(emails) {
  const el = document.getElementById('mail-list');
  if (!emails.length) {
    el.innerHTML = '<div class="card"><p class="empty-note">No unread emails.</p></div>';
    return;
  }
  el.innerHTML = emails.map(e => `
    <div class="mail-item" data-email-id="${e.id}">
      <div class="mail-meta">
        <span class="mail-sender">${escHtml(e.sender)}</span>
        <span class="mail-date">${formatEmailDate(e.date)}</span>
      </div>
      <div class="mail-subject">${escHtml(e.subject)}</div>
      <div class="mail-summary">${escHtml(e.snippet)}</div>
    </div>`).join('');

  // Click to AI-summarize
  el.querySelectorAll('.mail-item').forEach(item => {
    item.addEventListener('click', () => summarizeEmail(item.dataset.emailId, item));
  });
}

async function summarizeEmail(id, el) {
  if (!Config.openrouterKey) {
    alert('Add your OpenRouter API key in Settings to summarize emails.');
    return;
  }
  const summaryEl = el.querySelector('.mail-summary');
  if (summaryEl.dataset.summarized) return;
  summaryEl.textContent = 'Summarizing…';

  try {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
      { headers: { Authorization: `Bearer ${Config.googleToken}` } }
    );
    const data = await res.json();
    const body = extractEmailBody(data);

    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Config.openrouterKey}`,
      },
      body: JSON.stringify({
        model: 'openrouter/free',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Summarize this email in 1-2 sentences, focusing on what action (if any) is needed:\n\n${body.slice(0, 3000)}`
        }]
      })
    });
    const aiData = await aiRes.json();
    const summary = aiData.choices?.[0]?.message?.content || 'Could not summarize.';
    summaryEl.textContent = summary;
    summaryEl.dataset.summarized = '1';
  } catch (e) {
    summaryEl.textContent = 'Error summarizing email.';
  }
}

function extractEmailBody(message) {
  const parts = message.payload?.parts || [message.payload];
  for (const part of parts) {
    if (part?.mimeType === 'text/plain' && part.body?.data) {
      return atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    }
  }
  return message.snippet || '';
}

function formatEmailDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

// ═══════════════════════════════════════════════════════════════════
// MARKETS — Finnhub
// ═══════════════════════════════════════════════════════════════════
const INDICES = [
  { label: 'S&P 500',   symbol: 'SPY',  id: 'spy'  },
  { label: 'NASDAQ',    symbol: 'QQQ',  id: 'qqq'  },
  { label: 'Dow Jones', symbol: 'DIA',  id: 'dia'  },
];

async function loadMarkets() {
  if (!Config.finnhubKey) return;

  document.getElementById('market-status').textContent = 'Live';

  for (const idx of INDICES) {
    fetchQuote(idx.symbol).then(q => {
      if (!q) return;
      updateMarketRow(idx.label, q);
      updateMarketCard(idx.id, idx.label, idx.symbol, q);
    });
  }

  // Portfolio
  const holdings = Config.holdings;
  if (holdings.length) {
    let totalValue = 0, totalCost = 0;
    await Promise.all(holdings.map(async h => {
      const q = await fetchQuote(h.ticker);
      if (!q) return;
      const shares = parseFloat(h.shares) || 0;
      const cost   = parseFloat(h.cost)   || 0;
      totalValue += q.c * shares;
      totalCost  += cost * shares;
    }));
    const change  = totalValue - totalCost;
    const changePct = totalCost ? (change / totalCost) * 100 : 0;
    const up = change >= 0;

    // Overview row
    const items = document.querySelectorAll('.market-item');
    if (items[3]) {
      items[3].classList.remove('loading');
      items[3].querySelector('.market-value').textContent = '$' + totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const chEl = items[3].querySelector('.market-change');
      chEl.textContent = (up ? '+' : '') + changePct.toFixed(2) + '%';
      chEl.className = `market-change ${up ? 'up' : 'down'}`;
    }
    // Portfolio card
    document.getElementById('portfolio-total').textContent = '$' + totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const pChEl = document.getElementById('portfolio-change');
    pChEl.textContent = (up ? '+' : '') + changePct.toFixed(2) + '%';
    pChEl.className = `mcf-change ${up ? 'up' : 'down'}`;
  }
}

async function fetchQuote(symbol) {
  if (!Config.finnhubKey) return null;
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${Config.finnhubKey}`
    );
    return await res.json();
  } catch { return null; }
}

function updateMarketRow(label, q) {
  const items = document.querySelectorAll('.market-item');
  const labels = ['S&P 500', 'NASDAQ', 'Dow Jones'];
  const idx = labels.indexOf(label);
  if (idx < 0 || !items[idx]) return;
  const item = items[idx];
  item.classList.remove('loading');
  const up = q.d >= 0;
  item.querySelector('.market-value').textContent = q.c?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const chEl = item.querySelector('.market-change');
  chEl.textContent = (up ? '+' : '') + (q.dp?.toFixed(2) || '0.00') + '%';
  chEl.className = `market-change ${up ? 'up' : 'down'}`;
  document.getElementById('market-time').textContent = 'Live prices';
}

function updateMarketCard(id, label, symbol, q) {
  const cards = document.querySelectorAll('.market-card-full');
  const idMap = { spy: 0, qqq: 1, dia: 2 };
  const card = cards[idMap[id]];
  if (!card) return;
  const up = q.d >= 0;
  card.querySelector('.mcf-value').textContent = q.c?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const chEl = card.querySelector('.mcf-change');
  chEl.textContent = (q.d >= 0 ? '+' : '') + (q.d?.toFixed(2) || '0.00') + ' (' + (q.dp?.toFixed(2) || '0.00') + '%)';
  chEl.className = `mcf-change ${up ? 'up' : 'down'}`;
}

// ═══════════════════════════════════════════════════════════════════
// CALENDAR UI
// ═══════════════════════════════════════════════════════════════════
let calViewDate = new Date();
let selectedDate = new Date();
let futureEvents = [];

async function renderCalendar() {
  if (Config.googleToken && !futureEvents.length) {
    futureEvents = await loadFutureEvents();
  }

  const grid = document.getElementById('cal-grid');
  const label = document.getElementById('cal-month');
  const year  = calViewDate.getFullYear();
  const month = calViewDate.getMonth();

  label.textContent = calViewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  let html = days.map(d => `<div class="cal-day-header">${d}</div>`).join('');

  // Blank cells before month start
  for (let i = 0; i < firstDay; i++) {
    const prevDate = new Date(year, month, -firstDay + i + 1);
    html += `<div class="cal-day other-month">${prevDate.getDate()}</div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const isToday    = date.toDateString() === today.toDateString();
    const isSelected = date.toDateString() === selectedDate.toDateString();
    const hasEvents  = futureEvents.some(e => {
      const eDate = e.start?.dateTime ? new Date(e.start.dateTime) : e.start?.date ? new Date(e.start.date) : null;
      return eDate && eDate.toDateString() === date.toDateString();
    });
    const localManual = getLocalEvents(date);
    const hasLocal = localManual.length > 0;

    const cls = ['cal-day', isToday && 'today', isSelected && 'selected', (hasEvents || hasLocal) && 'has-events'].filter(Boolean).join(' ');
    html += `<div class="${cls}" data-date="${date.toISOString()}">${d}</div>`;
  }

  grid.innerHTML = html;

  grid.querySelectorAll('.cal-day:not(.other-month)').forEach(el => {
    el.addEventListener('click', () => {
      selectedDate = new Date(el.dataset.date);
      renderCalendar();
      renderSelectedDayEvents();
    });
  });

  renderSelectedDayEvents();
}

function renderSelectedDayEvents() {
  const el = document.getElementById('selected-day-events');
  const label = document.getElementById('selected-day-label');
  label.textContent = selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const google = futureEvents.filter(e => {
    const eDate = e.start?.dateTime ? new Date(e.start.dateTime) : e.start?.date ? new Date(e.start.date) : null;
    return eDate && eDate.toDateString() === selectedDate.toDateString();
  });
  const local = getLocalEvents(selectedDate);
  const all = [
    ...google.map(e => ({
      title: e.summary || 'Untitled',
      time: e.start?.dateTime ? new Date(e.start.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'All day',
      sub: e.location || '',
    })),
    ...local.map(e => ({ title: e.title, time: e.start || 'All day', sub: e.desc || '' })),
  ];

  if (!all.length) {
    el.innerHTML = '<p class="empty-note">No events on this day.</p>';
    return;
  }
  el.innerHTML = all.map(e => `
    <div class="timeline-event">
      <span class="evt-time">${escHtml(e.time)}</span>
      <div class="evt-dot"></div>
      <div class="evt-info">
        <div class="evt-title">${escHtml(e.title)}</div>
        ${e.sub ? `<div class="evt-sub">${escHtml(e.sub)}</div>` : ''}
      </div>
    </div>`).join('');
}

// Local events (stored in localStorage when not using Google)
function getLocalEvents(date) {
  try {
    const all = JSON.parse(localStorage.getItem('local_events') || '[]');
    return all.filter(e => e.date === date.toISOString().split('T')[0]);
  } catch { return []; }
}

function saveLocalEvent(evt) {
  try {
    const all = JSON.parse(localStorage.getItem('local_events') || '[]');
    all.push(evt);
    localStorage.setItem('local_events', JSON.stringify(all));
  } catch {}
}

// Add Event modal
function initAddEvent() {
  document.getElementById('btn-add-event').addEventListener('click', () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('evt-date').value = today;
    document.getElementById('modal-event').classList.remove('hidden');
  });
  document.getElementById('modal-cancel').addEventListener('click', () => {
    document.getElementById('modal-event').classList.add('hidden');
  });
  document.getElementById('modal-save').addEventListener('click', () => {
    const title = document.getElementById('evt-title').value.trim();
    const date  = document.getElementById('evt-date').value;
    const start = document.getElementById('evt-start').value;
    const end   = document.getElementById('evt-end').value;
    const desc  = document.getElementById('evt-desc').value.trim();
    if (!title || !date) { alert('Please add a title and date.'); return; }

    if (Config.googleToken) {
      addGoogleCalendarEvent({ title, date, start, end, desc });
    } else {
      saveLocalEvent({ title, date, start, end, desc });
      futureEvents = [];
      renderCalendar();
    }
    document.getElementById('modal-event').classList.add('hidden');
    document.getElementById('evt-title').value = '';
  });
}

async function addGoogleCalendarEvent({ title, date, start, end, desc }) {
  const startDt = start ? `${date}T${start}:00` : date;
  const endDt   = end   ? `${date}T${end}:00`   : date;
  const body = start
    ? { summary: title, description: desc, start: { dateTime: startDt, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }, end: { dateTime: endDt, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone } }
    : { summary: title, description: desc, start: { date }, end: { date } };

  try {
    await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${Config.googleToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    futureEvents = [];
    renderCalendar();
  } catch (e) {
    alert('Error adding event. Make sure your Google account is connected.');
  }
}

// ═══════════════════════════════════════════════════════════════════
// GRADES
// ═══════════════════════════════════════════════════════════════════
const DEFAULT_CLASSES = ['English Language Arts', 'Mathematics', 'Science', 'World History', 'PE / Health'];

function getGrades() {
  try { return JSON.parse(localStorage.getItem('grades') || '{}'); } catch { return {}; }
}
function saveGrades(g) { localStorage.setItem('grades', JSON.stringify(g)); }

function renderGradesPage() {
  const grades = getGrades();
  const container = document.getElementById('grades-full');
  const classes = Object.keys(grades).length ? Object.keys(grades) : DEFAULT_CLASSES;

  container.innerHTML = classes.map(cls => {
    const g = grades[cls] || {};
    const score = g.score || '—';
    const letter = g.letter || scoreLetter(g.score);
    const placeholder = !g.score;
    const color = gradeColor(letter);
    return `
      <div class="grade-card-full ${placeholder ? 'placeholder' : ''}" style="${color ? `border-left: 3px solid ${color}` : ''}">
        <div class="gcf-left">
          <span class="gcf-subject">${escHtml(cls)}</span>
          <span class="gcf-teacher">${escHtml(g.teacher || 'Teacher —')}</span>
        </div>
        <div class="gcf-right">
          <span class="gcf-score">${placeholder ? '—' : score + '%'}</span>
          <span class="gcf-letter" ${color ? `style="background:${color}22;color:${color}"` : ''}>${letter}</span>
        </div>
      </div>`;
  }).join('');

  // Overview snapshot
  const snap = document.getElementById('grades-snapshot');
  snap.innerHTML = classes.slice(0, 4).map(cls => {
    const g = grades[cls] || {};
    const letter = g.letter || scoreLetter(g.score);
    return `
      <div class="grade-card ${!g.score ? 'placeholder' : ''}">
        <span class="grade-subject">${escHtml(cls.split(' ')[0])}</span>
        <span class="grade-score">${g.score ? letter : '—'}</span>
      </div>`;
  }).join('');
}

function scoreLetter(score) {
  if (!score) return '—';
  const n = parseFloat(score);
  if (n >= 90) return 'A';
  if (n >= 80) return 'B';
  if (n >= 70) return 'C';
  if (n >= 60) return 'D';
  return 'F';
}
function gradeColor(letter) {
  if (letter === 'A') return '#2d7a4f';
  if (letter === 'B') return '#2563eb';
  if (letter === 'C') return '#b07d2a';
  if (letter === 'D' || letter === 'F') return '#c0392b';
  return null;
}

function initGradeEditor() {
  document.getElementById('btn-edit-grades').addEventListener('click', () => {
    const grades = getGrades();
    const classes = Object.keys(grades).length ? Object.keys(grades) : DEFAULT_CLASSES;
    const container = document.getElementById('grade-inputs');
    container.innerHTML = classes.map(cls => {
      const g = grades[cls] || {};
      return `
        <div class="portfolio-holding" style="grid-template-columns: 1fr 80px 80px 80px">
          <input type="text" placeholder="Class name" value="${escHtml(cls)}" class="grade-cls-name" data-orig="${escHtml(cls)}" />
          <input type="number" placeholder="Score" min="0" max="100" value="${g.score || ''}" class="grade-score-val" />
          <input type="text" placeholder="Letter" maxlength="2" value="${g.letter || ''}" class="grade-letter-val" />
          <input type="text" placeholder="Teacher" value="${g.teacher || ''}" class="grade-teacher-val" />
        </div>`;
    }).join('') + `
      <div class="portfolio-holding" style="grid-template-columns: 1fr 80px 80px 80px;margin-top:8px">
        <input type="text" placeholder="Add new class…" class="grade-cls-name" data-orig="" />
        <input type="number" placeholder="Score" min="0" max="100" class="grade-score-val" />
        <input type="text" placeholder="Letter" maxlength="2" class="grade-letter-val" />
        <input type="text" placeholder="Teacher" class="grade-teacher-val" />
      </div>`;
    document.getElementById('modal-grades').classList.remove('hidden');
  });

  document.getElementById('grades-cancel').addEventListener('click', () => {
    document.getElementById('modal-grades').classList.add('hidden');
  });

  document.getElementById('grades-save').addEventListener('click', () => {
    const rows = document.querySelectorAll('#grade-inputs .portfolio-holding');
    const grades = {};
    rows.forEach(row => {
      const cls    = row.querySelector('.grade-cls-name').value.trim();
      const score  = row.querySelector('.grade-score-val').value.trim();
      const letter = row.querySelector('.grade-letter-val').value.trim();
      const teacher= row.querySelector('.grade-teacher-val').value.trim();
      if (cls) grades[cls] = { score, letter: letter || scoreLetter(score), teacher };
    });
    saveGrades(grades);
    document.getElementById('modal-grades').classList.add('hidden');
    renderGradesPage();
  });
}

// ═══════════════════════════════════════════════════════════════════
// AI CHAT
// ═══════════════════════════════════════════════════════════════════
let chatHistory = [];

function initAIChat() {
  const input = document.getElementById('ai-input');
  const send  = document.getElementById('ai-send');

  send.addEventListener('click', sendAIMessage);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAIMessage(); }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });
}

async function sendAIMessage() {
  const input = document.getElementById('ai-input');
  const text  = input.value.trim();
  if (!text) return;

  if (!Config.openrouterKey) {
    alert('Add your OpenRouter API key in Settings to use the AI assistant.');
    navigate('settings');
    return;
  }

  input.value = '';
  input.style.height = 'auto';
  appendMessage('user', text);

  // Build context from dashboard
  const grades = getGrades();
  const context = [
    `Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.`,
    assignments.length ? `The student has ${assignments.filter(a => !a.turnedIn && isPastDue(a.dueDate)).length} missing assignments and ${assignments.filter(a => !a.turnedIn && !isPastDue(a.dueDate)).length} upcoming assignments.` : '',
    Object.keys(grades).length ? `Current grades: ${Object.entries(grades).map(([cls, g]) => `${cls}: ${g.score ? g.score + '%' : '—'}`).join(', ')}.` : '',
  ].filter(Boolean).join(' ');

  chatHistory.push({ role: 'user', content: text });

  const typingId = appendTyping();

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Config.openrouterKey}`,
      },
      body: JSON.stringify({
        model: 'openrouter/free',
        max_tokens: 1000,
        messages: [
          { role: 'system', content: `You are a helpful AI assistant embedded in a student dashboard. Be concise, friendly, and direct. ${context}` },
          ...chatHistory,
        ],
      })
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || 'Sorry, I had trouble with that.';
    chatHistory.push({ role: 'assistant', content: reply });
    removeTyping(typingId);
    appendMessage('assistant', reply);
  } catch (e) {
    removeTyping(typingId);
    appendMessage('assistant', 'Connection error. Check your API key in Settings.');
  }
}

function appendMessage(role, text) {
  const el = document.getElementById('ai-messages');
  const div = document.createElement('div');
  div.className = `ai-msg ai-msg--${role}`;
  div.innerHTML = `
    <div class="ai-avatar">${role === 'assistant' ? '◆' : 'Me'}</div>
    <div class="ai-bubble">${escHtml(text).replace(/\n/g, '<br>')}</div>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function appendTyping() {
  const el = document.getElementById('ai-messages');
  const id = 'typing-' + Date.now();
  const div = document.createElement('div');
  div.className = 'ai-msg ai-msg--assistant';
  div.id = id;
  div.innerHTML = `<div class="ai-avatar">◆</div><div class="ai-bubble"><div class="ai-typing"><span></span><span></span><span></span></div></div>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  return id;
}

function removeTyping(id) {
  document.getElementById(id)?.remove();
}

// ═══════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════
function initSettings() {
  // Load saved values
  document.getElementById('setting-google-client-id').value = Config.googleClientId;
  document.getElementById('setting-openrouter-key').value   = Config.openrouterKey;
  document.getElementById('setting-finnhub-key').value      = Config.finnhubKey;
  document.getElementById('setting-name').value             = Config.userName;

  // Update status badges
  if (Config.googleToken)   setStatus('google', true);
  if (Config.openrouterKey) setStatus('openrouter', true);
  if (Config.finnhubKey)    setStatus('finnhub', true);

  document.getElementById('save-google').addEventListener('click', () => {
    const val = document.getElementById('setting-google-client-id').value.trim();
    localStorage.setItem('cfg_google_client_id', val);
    setStatus('google', false, 'Saved. Click Connect Google to authenticate.');
    googleAuth();
  });

  document.getElementById('save-openrouter').addEventListener('click', () => {
    const val = document.getElementById('setting-openrouter-key').value.trim();
    localStorage.setItem('cfg_openrouter_key', val);
    setStatus('openrouter', !!val, val ? 'API key saved.' : 'Cleared.');
  });

  document.getElementById('save-finnhub').addEventListener('click', () => {
    const val = document.getElementById('setting-finnhub-key').value.trim();
    localStorage.setItem('cfg_finnhub_key', val);
    setStatus('finnhub', !!val, val ? 'API key saved.' : 'Cleared.');
  });

  document.getElementById('save-name').addEventListener('click', () => {
    const val = document.getElementById('setting-name').value.trim();
    localStorage.setItem('cfg_name', val);
    initGreeting();
  });

  // Portfolio holdings
  renderHoldings();
  document.getElementById('add-holding').addEventListener('click', addHoldingRow);
  document.getElementById('save-holdings').addEventListener('click', saveHoldingsFromForm);
}

function setStatus(key, ok, msg) {
  const el = document.getElementById(`status-${key}`);
  el.textContent = msg || (ok ? '✓ Connected' : 'Not connected');
  el.className = `settings-status ${ok ? 'ok' : ''}`;
}

function renderHoldings() {
  const container = document.getElementById('portfolio-holdings');
  const holdings  = Config.holdings;
  container.innerHTML = holdings.map((h, i) => `
    <div class="portfolio-holding">
      <input type="text"   placeholder="Ticker (AAPL)" value="${escHtml(h.ticker || '')}" class="h-ticker" />
      <input type="number" placeholder="Shares"        value="${h.shares || ''}"           class="h-shares" />
      <input type="number" placeholder="Avg cost"      value="${h.cost || ''}"             class="h-cost"   />
      <button class="remove-holding" data-idx="${i}">×</button>
    </div>`).join('');
  container.querySelectorAll('.remove-holding').forEach(btn => {
    btn.addEventListener('click', () => {
      const holdings = Config.holdings;
      holdings.splice(parseInt(btn.dataset.idx), 1);
      localStorage.setItem('cfg_holdings', JSON.stringify(holdings));
      renderHoldings();
    });
  });
}

function addHoldingRow() {
  const holdings = Config.holdings;
  holdings.push({ ticker: '', shares: '', cost: '' });
  localStorage.setItem('cfg_holdings', JSON.stringify(holdings));
  renderHoldings();
}

function saveHoldingsFromForm() {
  const rows = document.querySelectorAll('#portfolio-holdings .portfolio-holding');
  const holdings = Array.from(rows).map(row => ({
    ticker: row.querySelector('.h-ticker').value.trim().toUpperCase(),
    shares: row.querySelector('.h-shares').value.trim(),
    cost:   row.querySelector('.h-cost').value.trim(),
  })).filter(h => h.ticker);
  localStorage.setItem('cfg_holdings', JSON.stringify(holdings));
  alert('Holdings saved!');
}

// ═══════════════════════════════════════════════════════════════════
// GOOGLE ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════
function handleGoogleError(error) {
  if (error.code === 401) {
    Config.googleToken = '';
    console.warn('Google token expired. Please reconnect.');
  }
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loadGoogleData() {
  loadCalendar();
  loadClassroom();
  loadGmail();
}

// ═══════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  handleOAuthCallback();
  initNav();
  initClock();
  initGreeting();
  initAddEvent();
  initGradeEditor();
  initAIChat();
  initSettings();
  renderCalendar();
  renderGradesPage();
  loadMarkets();

  // Google auth buttons
  document.getElementById('btn-google-auth')?.addEventListener('click', googleAuth);
  document.getElementById('btn-auth-inline')?.addEventListener('click', googleAuth);
  document.getElementById('btn-classroom-auth')?.addEventListener('click', googleAuth);
  document.getElementById('btn-gmail-auth')?.addEventListener('click', googleAuth);

  // Assignment filters
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      assignmentFilter = tab.dataset.filter;
      renderAssignmentsPage();
    });
  });

  // If already have Google token, load data
  if (Config.googleToken) loadGoogleData();
});
