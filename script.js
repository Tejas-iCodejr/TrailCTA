/* iCodeJr free-trial page: booking flow, personalisation and learning plan. */

const CONFIG = {
  // Where booking requests are sent as JSON (a CRM webhook, Zapier, HubSpot form endpoint, etc.).
  // Left empty, the page runs in demo mode: it logs the booking to the console and shows the confirmation.
  bookingEndpoint: '',
  whatsappDisplay: '+971 50 694 2633',
  timeZone: 'Asia/Dubai',
  bookableDays: 14, // parents can book from tomorrow up to this many days ahead
  // Google reviews: a Maps JavaScript API key with "Places API (New)" enabled, restricted to your domain,
  // and your Google Business Place ID (find it at developers.google.com/maps/documentation/places/web-service/place-id).
  // While either is empty the reviews section stays hidden.
  googleMapsApiKey: '',
  googlePlaceId: '',
};

/* Demo availability. Replace with real mentor availability from your scheduling system.
   Times are GST (24h). The UAE weekend is Saturday and Sunday. */
const SLOT_TEMPLATE = {
  weekday: [
    { group: 'After school', times: ['15:00', '16:00', '17:00'] },
    { group: 'Evening', times: ['18:00', '19:00', '20:00'] },
  ],
  weekend: [
    { group: 'Morning', times: ['09:00', '10:00', '11:00'] },
    { group: 'Afternoon', times: ['14:00', '15:00', '16:00'] },
  ],
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const smooth = reduceMotion ? 'auto' : 'smooth';

const state = {
  step: 1, name: '', age: '', interest: '', day: null, time: null, weekStart: 0, done: false,
  planAge: '7-8', planTrack: 'combined',
};

const poss = n => (/s$/i.test(n) ? `${n}'` : `${n}'s`);
const displayName = () => state.name.trim();

/* ---------- Personalisation ---------- */

$$('.nm-or, .nm-or-cap, .nm-poss').forEach(el => { el.dataset.def = el.textContent; });

function personalize() {
  const n = displayName();
  $$('.nm-or, .nm-or-cap').forEach(el => { el.textContent = n || el.dataset.def; });
  $$('.nm-poss').forEach(el => { el.textContent = n ? poss(n) : el.dataset.def; });
  $('#peek-title').textContent = $('#pv-title').textContent;
  $('#build-line').textContent = ICJ.builds[Preview.scene || 'game'].line.replace('{N}', n || 'Your child');
  $('#closer-cta').textContent = n ? `Book ${poss(n)} free class` : 'Book the free class';
  $$('.rp-initial').forEach(el => { el.textContent = n ? n.charAt(0).toUpperCase() : '?'; });
  $('#dock-btn').textContent = n && state.step > 1 ? `Continue ${poss(n)} booking` : 'Book free class';
  renderPlan();
}

/* ---------- Booking steps ---------- */

const form = $('#booking');
const card = $('#book-card');

function showStep(n, { focus = true } = {}) {
  state.step = n;
  $$('.step', form).forEach(fs => { fs.hidden = +fs.dataset.step !== n; });
  $$('.progress li').forEach(li => {
    const p = +li.dataset.p;
    li.classList.toggle('done', p < n);
    if (p === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
  });
  hideErrors();
  if (n === 3 && !state.day) selectFirstDay();
  if (n === 4) renderChosen();
  if (focus) {
    const q = $(`.step[data-step="${n}"] .step-q`, form);
    q.focus({ preventScroll: true });
    const r = card.getBoundingClientRect();
    if (r.top < 0 || r.top > innerHeight * 0.6) card.scrollIntoView({ behavior: smooth, block: 'start' });
  }
  personalize();
}

function stepError(msg, focusEl) {
  const err = $(`.step[data-step="${state.step}"] .step-error`, form);
  err.textContent = msg;
  err.hidden = false;
  if (focusEl) focusEl.focus();
  return false;
}
function hideErrors() { $$('.step-error', form).forEach(e => { e.hidden = true; }); }

function validateStep(n) {
  if (n === 1) {
    if (!displayName()) return stepError('Add your child’s first name.', $('#child-name'));
    if (!state.age) return stepError('Pick your child’s age.', $('.age-row input'));
  }
  if (n === 2 && !state.interest) return stepError('Pick one, or choose “Not sure yet”.', $('.interest-grid input'));
  if (n === 3) {
    if (!state.day) return stepError('Pick a day for the class.', $('#days input:not(:disabled)'));
    if (!state.time) return stepError('Pick a time for the class.', $('#slots input:not(:disabled)'));
  }
  return true;
}

function next() {
  if (!validateStep(state.step)) return;
  showStep(Math.min(4, state.step + 1));
}

$$('[data-next]', form).forEach(b => b.addEventListener('click', next));
$$('[data-back]', form).forEach(b => b.addEventListener('click', () => showStep(Math.max(1, state.step - 1))));

$('#child-name').addEventListener('input', e => {
  const cleaned = e.target.value.replace(/[^\p{L}\p{M}' -]/gu, '');
  if (cleaned !== e.target.value) e.target.value = cleaned;
  const n = cleaned.replace(/\s+/g, ' ').trim();
  state.name = n ? n.charAt(0).toUpperCase() + n.slice(1) : '';
  $('#hint').classList.toggle('gone', !!state.name);
  Preview.update({ name: state.name });
  personalize();
  hideErrors();
});

$('.age-row').addEventListener('change', e => {
  state.age = e.target.value;
  Preview.update({ age: state.age });
  setPlanAge(state.age);
  setFaqAge(state.age);
  personalize();
  hideErrors();
});

$('.interest-grid').addEventListener('change', e => {
  state.interest = e.target.value;
  Preview.update({ interest: state.interest });
  setPlanTrack({ coding: 'coding', robotics: 'robotics' }[state.interest] || 'combined');
  personalize();
  hideErrors();
  setTimeout(() => { if (state.step === 2) showStep(3); }, 380);
});

/* ---------- Days and slots ---------- */

function dubaiToday() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: CONFIG.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date()).reduce((o, p) => (o[p.type] = p.value, o), {});
  return new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day, 12));
}

const DAY = 86400000;
const firstDay = new Date(dubaiToday().getTime() + DAY);
const lastDay = new Date(firstDay.getTime() + (CONFIG.bookableDays - 1) * DAY);
const fmt = (d, opts) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opts }).format(d);
const dateOf = iso => new Date(`${iso}T12:00:00Z`);
const isWeekend = d => d.getUTCDay() === 0 || d.getUTCDay() === 6;

function to12h(t) {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

// Demo only: marks roughly a quarter of slots as taken, the same way on every visit.
function isTaken(day, time) {
  let h = 0;
  for (const ch of day + time) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 4 === 0;
}

function renderDays() {
  const start = new Date(firstDay.getTime() + state.weekStart * 7 * DAY);
  const days = Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * DAY));
  $('#week-label').textContent = `${fmt(days[0], { day: 'numeric', month: 'short' })} – ${fmt(days[6], { day: 'numeric', month: 'short' })}`;
  $('#days').innerHTML = days.map(d => {
    const iso = d.toISOString().slice(0, 10);
    const off = d > lastDay;
    return `<label${isWeekend(d) ? ' class="wknd"' : ''}>
      <input type="radio" name="day" value="${iso}" ${off ? 'disabled' : ''} ${state.day === iso ? 'checked' : ''}
        aria-label="${fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })}">
      <span><small>${fmt(d, { weekday: 'short' })}</small><b>${fmt(d, { day: 'numeric' })}</b></span>
    </label>`;
  }).join('');
  $('#week-prev').disabled = state.weekStart === 0;
  $('#week-next').disabled = new Date(start.getTime() + 7 * DAY) > lastDay;
}

function renderSlots() {
  const box = $('#slots');
  if (!state.day) {
    box.innerHTML = '<p class="slots-empty">Choose a day to see open times.</p>';
    return;
  }
  const groups = isWeekend(dateOf(state.day)) ? SLOT_TEMPLATE.weekend : SLOT_TEMPLATE.weekday;
  box.innerHTML = groups.map(g => `
    <div class="slot-group" role="radiogroup" aria-label="${g.group}">
      <p>${g.group}</p>
      <div>${g.times.map(t => {
        const taken = isTaken(state.day, t);
        return `<label><input type="radio" name="time" value="${t}" ${taken ? 'disabled' : ''} ${state.time === t ? 'checked' : ''}
          aria-label="${to12h(t)}${taken ? ', booked' : ''}"><span>${to12h(t)}</span></label>`;
      }).join('')}</div>
    </div>`).join('');
}

const slotShort = () => `${fmt(dateOf(state.day), { weekday: 'short', day: 'numeric', month: 'short' })} · ${to12h(state.time)}`;
const slotLong = () => `${fmt(dateOf(state.day), { weekday: 'long', day: 'numeric', month: 'long' })} · ${to12h(state.time)}`;

// Start step 3 on the soonest bookable day so open times are visible straight away.
function selectFirstDay() {
  const first = $('#days input:not(:disabled)');
  if (!first) return;
  first.checked = true;
  state.day = first.value;
  renderSlots();
}

$('#days').addEventListener('change', e => {
  state.day = e.target.value;
  state.time = null;
  Preview.update({ slot: '' });
  renderSlots();
  hideErrors();
});

$('#slots').addEventListener('change', e => {
  state.time = e.target.value;
  Preview.update({ slot: `${slotShort()} GST` });
  hideErrors();
});

$('#week-prev').addEventListener('click', () => { state.weekStart = Math.max(0, state.weekStart - 1); renderDays(); });
$('#week-next').addEventListener('click', () => { state.weekStart += 1; renderDays(); });

function renderChosen() {
  const n = displayName();
  $('#chosen').innerHTML = `<span><b></b><span></span></span><button type="button" class="link-btn">Change</button>`;
  $('#chosen b').textContent = `${poss(n)} free class`;
  $('#chosen span span').textContent = `${slotLong()} GST`;
  $('#chosen button').addEventListener('click', () => showStep(3));
}

/* ---------- Submit ---------- */

function normaliseMobile(raw) {
  const v = raw.trim();
  const digits = v.replace(/\D/g, '');
  if (v.startsWith('+') || digits.startsWith('00')) {
    const intl = digits.replace(/^00/, '');
    return intl.length >= 8 && intl.length <= 15 ? `+${intl}` : null;
  }
  const local = digits.replace(/^971/, '').replace(/^0/, '');
  return /^5\d{8}$/.test(local) ? `+971${local}` : null;
}

const prettyMobile = m => (m.startsWith('+971') ? `+971 ${m.slice(4, 6)} ${m.slice(6, 9)} ${m.slice(9)}` : m);

function utcStamp(iso, time, addMin = 0) {
  const [y, mo, d] = iso.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d, h - 4, mi + addMin)); // GST is UTC+4 all year
  return t.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function calendarLinks(n) {
  const start = utcStamp(state.day, state.time);
  const end = utcStamp(state.day, state.time, 50);
  const title = `iCodeJr free class for ${n}`;
  const details = `Live 1-on-1 trial class with an iCodeJr mentor. Questions? WhatsApp ${CONFIG.whatsappDisplay}`;
  const g = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start}/${end}&details=${encodeURIComponent(details)}`;
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//iCodeJr//Free class//EN', 'BEGIN:VEVENT',
    `UID:${start}-${Math.random().toString(36).slice(2)}@icodejr.com`, `DTSTAMP:${utcStamp(new Date().toISOString().slice(0, 10), '04:00')}`,
    `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${title}`, `DESCRIPTION:${details}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  return { g, ics: `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}` };
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  if (state.done) return;
  if (state.step < 4) { next(); return; }

  const parent = $('#parent-name');
  const mobileInput = $('#mobile');
  const email = $('#email');
  $$('#parent-name, #mobile, #email').forEach(i => i.removeAttribute('aria-invalid'));
  if (!parent.value.trim()) { parent.setAttribute('aria-invalid', 'true'); return stepError('Add your name so the mentor knows who to expect.', parent); }
  const mobile = normaliseMobile(mobileInput.value);
  if (!mobile) { mobileInput.setAttribute('aria-invalid', 'true'); return stepError('Enter a UAE mobile number, like 50 123 4567.', mobileInput); }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) { email.setAttribute('aria-invalid', 'true'); return stepError('Enter a valid email address, like name@example.com.', email); }

  const n = displayName();
  const params = new URLSearchParams(location.search);
  const booking = {
    childName: n,
    childAge: state.age,
    interest: state.interest,
    slotDate: state.day,
    slotTime: state.time,
    timeZone: CONFIG.timeZone,
    slotLabel: `${slotLong()} GST`,
    parentName: parent.value.trim(),
    mobile,
    email: email.value.trim(),
    source: 'trial-landing-page',
    utm: Object.fromEntries([...params].filter(([k]) => k.startsWith('utm_'))),
    submittedAt: new Date().toISOString(),
  };

  const btn = $('#submit');
  const label = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = 'Booking…';
  try {
    if (CONFIG.bookingEndpoint) {
      const res = await fetch(CONFIG.bookingEndpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(booking),
      });
      if (!res.ok) throw new Error(`Booking endpoint returned ${res.status}`);
    } else {
      console.info('[demo mode] booking request', booking);
    }
    showDone(n, mobile);
  } catch (err) {
    console.error(err);
    stepError(`We couldn’t send your booking. Check your connection and try again, or WhatsApp us on ${CONFIG.whatsappDisplay}.`);
    btn.disabled = false;
    btn.innerHTML = label;
  }
});

function showDone(n, mobile) {
  state.done = true;
  const [h] = state.time.split(':').map(Number);
  const endTime = `${String(h).padStart(2, '0')}:50`;
  $('#done-title').textContent = `${poss(n)} free class`;
  $('#done-when').textContent = `${fmt(dateOf(state.day), { weekday: 'long', day: 'numeric', month: 'long' })}, ${to12h(state.time).replace(/ (am|pm)$/, '')}–${to12h(endTime)} GST`;
  $('#done-mobile').textContent = `${prettyMobile(mobile)} on WhatsApp`;
  const links = calendarLinks(n);
  $('#gcal').href = links.g;
  $('#ics').href = links.ics;
  form.hidden = true;
  $('.progress').hidden = true;
  $('.bc-title').textContent = 'All set';
  const done = $('#done');
  done.hidden = false;
  done.focus({ preventScroll: true });
  card.scrollIntoView({ behavior: smooth, block: 'start' });
  updateDock();
}

/* ---------- Learning plan ---------- */

function setPlanAge(age) {
  state.planAge = age;
  const r = $(`input[name="plan-age"][value="${age}"]`);
  if (r) r.checked = true;
  renderPlan();
}

function setPlanTrack(track) {
  state.planTrack = track;
  const r = $(`input[name="plan-track"][value="${track}"]`);
  if (r) r.checked = true;
  renderPlan();
}

function renderPlan() {
  const paths = ICJ.paths[state.planAge];
  const kg = !!paths.package;
  const track = kg ? 'package' : state.planTrack;
  const courses = paths[track];
  const n = displayName();
  $('#track-ctl').hidden = kg;
  $('#doc-title').textContent = n ? `Learning path for ${n}` : 'Learning path for your child';
  $('#doc-age').textContent = `${ICJ.ages[state.planAge].label} · ${ICJ.ages[state.planAge].grades}`;
  $('#doc-track').textContent = ICJ.tracks[track];
  const list = $('#doc-path');
  const twoCol = courses.length > 7;
  list.classList.toggle('two-col', twoCol);
  // Fill the two columns top to bottom so the path reads in order.
  list.style.gridTemplateRows = twoCol ? `repeat(${Math.ceil(courses.length / 2)}, auto)` : '';
  list.innerHTML = courses.map((c, i) => `<li${i === 0 ? ' class="first"' : ''}><span class="n">${i + 1}</span><span class="c"></span>${i === 0 ? '<em>Starts here</em>' : ''}</li>`).join('');
  $$('.c', list).forEach((el, i) => { el.textContent = courses[i]; });
  const note = ICJ.notes[state.interest || 'unsure'].replace('{C}', courses[0]);
  $('#doc-note').textContent = `Mentor's note: ${note}`;
  if (typeof Replay !== 'undefined') Replay.content();
}

$$('input[name="plan-age"]').forEach(r => r.addEventListener('change', () => { state.planAge = r.value; renderPlan(); }));
$$('input[name="plan-track"]').forEach(r => r.addEventListener('change', () => { state.planTrack = r.value; renderPlan(); }));

/* ---------- Scroll to booking, mobile dock ---------- */

$$('[data-scroll-book]').forEach(a => a.addEventListener('click', e => {
  e.preventDefault();
  card.scrollIntoView({ behavior: smooth, block: 'start' });
  setTimeout(() => {
    const target = state.done ? $('#done') : (state.step === 1 && !displayName() ? $('#child-name') : $(`.step[data-step="${state.step}"] .step-q`));
    target.focus({ preventScroll: true });
  }, reduceMotion ? 0 : 600);
}));

let cardVisible = true;
function updateDock() {
  const dock = $('#dock');
  const show = !cardVisible && !state.done;
  dock.classList.toggle('show', show);
  dock.setAttribute('aria-hidden', String(!show));
  $('#dock-btn').tabIndex = show ? 0 : -1;
}
new IntersectionObserver(([entry]) => { cardVisible = entry.isIntersecting; updateDock(); }, { threshold: 0.1 }).observe(card);

/* ---------- Press cards and video player ---------- */

const isEmbeddable = p => !!p.video && p.video.type !== 'link';

function renderPress() {
  const row = $('#press-row');
  row.innerHTML = ICJ.press.map((p, i) => {
    const external = p.video?.type === 'link';
    const playable = !!p.video;
    const outletMark = (cls, alt) => (p.logo
      ? `<img class="${cls}" src="${p.logo}" alt="${alt}" loading="lazy">`
      : `<span class="${cls} pc-wordmark"${alt ? '' : ' aria-hidden="true"'}>${p.logoText}</span>`);
    const media = p.thumb ? `<img class="pc-thumb" src="${p.thumb}" alt="" loading="lazy">` : outletMark('pc-big-logo', '');
    const badge = !playable
      ? '<span class="pc-soon">Video coming soon</span>'
      : external
        ? `<span class="pc-dur">Watch on ${p.outlet} ↗</span>`
        : (p.duration ? `<span class="pc-dur">${p.duration}</span>` : '');
    const inner = `
      <span class="pc-media${p.thumb ? '' : ' no-thumb'}">
        ${media}
        ${playable && (p.thumb || !external) ? `<span class="pc-play"><svg aria-hidden="true"><use href="#i-play"/></svg></span>` : ''}
        ${badge}
      </span>
      <span class="pc-body">
        ${outletMark('pc-logo', p.outlet)}
        <b class="pc-title"></b>
        <span class="pc-date"></span>
      </span>`;
    return external
      ? `<a class="press-card" href="${p.video.url}" target="_blank" rel="noopener" data-i="${i}">${inner}</a>`
      : `<button type="button" class="press-card${playable ? '' : ' soon'}" data-i="${i}"${playable ? '' : ' aria-disabled="true"'}>${inner}</button>`;
  }).join('');
  $$('.press-card', row).forEach((el, i) => {
    $('.pc-title', el).textContent = ICJ.press[i].title;
    $('.pc-date', el).textContent = ICJ.press[i].date || ICJ.press[i].outlet;
  });
}

const Player = (() => {
  const dialog = $('#player');
  const frame = $('#player-frame');
  let index = 0;
  let opener = null;

  const playable = () => ICJ.press.map((p, i) => (isEmbeddable(p) ? i : -1)).filter(i => i >= 0);

  function embedFor(v, title) {
    const t = title.replace(/"/g, '&quot;');
    if (v.type === 'youtube') {
      const id = encodeURIComponent(v.id);
      return { html: `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1" title="${t}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`, original: `https://www.youtube.com/watch?v=${id}` };
    }
    if (v.type === 'vimeo') {
      const id = encodeURIComponent(v.id);
      return { html: `<iframe src="https://player.vimeo.com/video/${id}?autoplay=1&dnt=1" title="${t}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`, original: `https://vimeo.com/${id}` };
    }
    if (v.type === 'mp4') {
      return { html: `<video controls autoplay playsinline${v.poster ? ` poster="${v.poster}"` : ''}><source src="${v.src}" type="video/mp4"></video>`, original: v.src };
    }
    if (v.type === 'instagram') {
      const base = v.url.split('?')[0].replace(/\/?$/, '/');
      return { html: `<iframe class="ig" src="${base}embed/" title="${t}" allowfullscreen></iframe>`, original: v.url };
    }
    return { html: '', original: '#' };
  }

  function show(i) {
    index = i;
    const p = ICJ.press[i];
    const list = playable();
    const embed = embedFor(p.video, `${p.outlet}: ${p.title}`);
    $('#player-logo').hidden = !p.logo;
    if (p.logo) $('#player-logo').src = p.logo;
    $('#player-outlet').textContent = [p.outlet, p.date].filter(Boolean).join(' · ');
    $('#player-title').textContent = p.title;
    frame.classList.toggle('portrait', p.video.type === 'instagram');
    frame.innerHTML = embed.html;
    $('#player-src').href = embed.original;
    $('#player-src').textContent = p.video.type === 'instagram' ? 'Open on Instagram' : 'Open original';
    $('#player-count').textContent = `${list.indexOf(i) + 1} of ${list.length}`;
    $('#player-prev').hidden = $('#player-next').hidden = list.length < 2;
  }

  function step(dir) {
    const list = playable();
    const pos = list.indexOf(index);
    show(list[(pos + dir + list.length) % list.length]);
  }

  function open(i, from) {
    opener = from;
    show(i);
    dialog.showModal();
    document.documentElement.classList.add('no-scroll');
  }

  // Runs for every way of closing (button, backdrop, Esc) and is safe to run twice.
  function cleanup() {
    frame.innerHTML = ''; // removing the embed stops playback
    document.documentElement.classList.remove('no-scroll');
    if (opener) { opener.focus(); opener = null; }
  }

  function close() {
    if (dialog.open) dialog.close();
    cleanup();
  }

  dialog.addEventListener('close', cleanup);
  dialog.addEventListener('click', e => { if (e.target === dialog) close(); });
  dialog.addEventListener('keydown', e => {
    if (frame.contains(e.target)) return; // leave arrow keys to the video's own controls
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
  });
  $('#player-close').addEventListener('click', close);
  $('#player-prev').addEventListener('click', () => step(-1));
  $('#player-next').addEventListener('click', () => step(1));

  return { open, close, step };
})();

$('#press-row').addEventListener('click', e => {
  const cardEl = e.target.closest('.press-card');
  // Link cards are plain links to the outlet's page; "coming soon" cards do nothing.
  if (!cardEl || cardEl.tagName === 'A' || cardEl.classList.contains('soon')) return;
  Player.open(+cardEl.dataset.i, cardEl);
});

/* ---------- Footer ---------- */

// Link groups are accordions on phones and always open on wider screens.
const narrow = matchMedia('(max-width: 640px)');
function syncFooterCols() { $$('details.f-col').forEach(d => { d.open = !narrow.matches; }); }
narrow.addEventListener('change', syncFooterCols);
$$('details.f-col > summary').forEach(s => s.addEventListener('click', e => { if (!narrow.matches) e.preventDefault(); }));

/* ---------- Free class: live class replay ---------- */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// What the shared screen shows while the child builds, per preview scene.
const REPLAY_CODE = {
  story:  { kind: 'blocks', lines: [['ev', 'when ⚑ clicked'], ['mo', 'move 2'], ['mo', 'move 2'], ['mo', 'jump'], ['lo', 'say "Hi!"']] },
  game:   { kind: 'blocks', lines: [['ev', 'when ⚑ clicked'], ['va', 'set score to 0'], ['ct', 'forever'], ['mo', 'go to mouse x'], ['ct', 'if touching Star?'], ['va', 'change score by 1']] },
  robot:  { kind: 'blocks', lines: [['ev', 'when ⚑ clicked'], ['mo', 'move forward 2'], ['mo', 'turn right'], ['mo', 'move forward 3'], ['lo', 'say "Made it!"']] },
  ai:     { kind: 'blocks', lines: [['ev', 'when ⚑ clicked'], ['se', 'ask "What shall we talk about?"'], ['ai', 'set reply to AI answer'], ['lo', 'say reply']] },
  python: { kind: 'code', lines: [['', 'import random'], ['', 'name = input("Your name? ")'], ['', 'secret = random.randint(1, 20)'], ['', 'guess = int(input("Guess: "))'], ['', 'while guess != secret:'], ['', '    guess = int(input("Again: "))'], ['', 'print("You got it,", name)']] },
};

const Replay = (() => {
  const root = $('#replay');
  const list = $('.rp-steps', root);
  const steps = $$('.rp-step', root);
  const screen = $('#rp-screen');
  const segs = $$('.rp-seg i', root);
  const ranges = steps.map(li => [+li.dataset.from, +li.dataset.to]);
  const names = ['Say hello', 'Build something', 'Skill check', 'Your plan'];
  let lines = [];
  let last = -1;
  let ticking = false;

  function content() {
    const scene = Preview.scene || 'game';
    const code = REPLAY_CODE[scene];
    const box = $('#rp-code');
    box.className = `rp-code ${code.kind}`;
    box.innerHTML = code.lines.map(([c]) => `<span class="rp-line ${c}"></span>`).join('');
    lines = $$('.rp-line', box);
    lines.forEach((el, i) => { el.textContent = code.lines[i][1]; });
    $('#rp-build-title').textContent = `${displayName() ? poss(displayName()) : "your child's"} ${ICJ.builds[scene].noun}`;
    const paths = ICJ.paths[state.planAge];
    const courses = paths.package || paths[state.planTrack];
    $('#rp-plan-list').innerHTML = courses.slice(0, 3).map((c, i) => `<li${i === 0 ? ' class="first"' : ''}><span></span>${i === 0 ? '<em>Starts here</em>' : ''}</li>`).join('');
    $$('#rp-plan-list li span').forEach((el, i) => { el.textContent = courses[i]; });
    last = -1;
    frame();
  }

  function frame() {
    ticking = false;
    const box = list.getBoundingClientRect();
    if (box.bottom < -200 || box.top > innerHeight + 200) return;
    const win = $('.rp-window', root).getBoundingClientRect();
    const narrow = matchMedia('(max-width: 860px)').matches;
    // The "reading line": middle of the screen, or just below the sticky window on phones.
    const anchor = narrow ? win.bottom + (innerHeight - win.bottom) * 0.35 : innerHeight * 0.55;
    const p = clamp((anchor - box.top) / box.height, 0, 0.9999);
    const idx = Math.floor(p * steps.length);
    const local = p * steps.length - idx;
    const [from, to] = ranges[idx];
    const minutes = from + local * (to - from);
    const secs = Math.floor(minutes * 60);
    $('#rp-min').textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    segs.forEach((el, i) => { el.style.transform = `scaleX(${i < idx ? 1 : i > idx ? 0 : local})`; });
    const stepProgress = i => (idx > i ? 1 : idx < i ? 0 : local);
    const shown = Math.ceil(stepProgress(1) * lines.length);
    lines.forEach((el, i) => el.classList.toggle('on', i < shown));
    screen.style.setProperty('--build', stepProgress(1));
    screen.style.setProperty('--check', stepProgress(2));
    if (idx !== last) {
      last = idx;
      screen.dataset.step = idx;
      steps.forEach((li, i) => li.classList.toggle('active', i === idx));
      $('#rp-step-name').textContent = names[idx];
    }
  }

  const schedule = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  return { content, frame };
})();

/* ---------- Student projects: pinned, scroll-linked row ---------- */

const ProjectRow = (() => {
  const pin = $('#proj-pin');
  const vp = $('#proj-viewport');
  const track = $('#proj-track');
  const cards = $$('.proj', track);
  // Pin only on wide, tall-enough screens; phones and reduced-motion users swipe the row instead.
  const canPin = () => matchMedia('(min-width: 861px) and (min-height: 640px) and (prefers-reduced-motion: no-preference)').matches;
  let shift = 0;
  let ticking = false;

  function layout() {
    const pinned = canPin();
    pin.classList.toggle('pinned', pinned);
    track.style.transform = '';
    shift = Math.max(0, track.scrollWidth - vp.clientWidth);
    pin.style.height = pinned ? `${innerHeight + shift * 1.15}px` : '';
    update();
  }

  function update() {
    ticking = false;
    let p;
    if (pin.classList.contains('pinned')) {
      const total = pin.offsetHeight - innerHeight;
      p = total > 0 ? clamp(-pin.getBoundingClientRect().top / total, 0, 1) : 0;
      track.style.transform = `translateX(${(-p * shift).toFixed(1)}px)`;
    } else {
      const max = vp.scrollWidth - vp.clientWidth;
      p = max > 0 ? vp.scrollLeft / max : 0;
    }
    vp.classList.toggle('at-start', p < 0.01);
    vp.classList.toggle('at-end', p > 0.99);
    $('#proj-bar').style.setProperty('--p', Math.max(p, 1 / cards.length));
    $('#proj-count').textContent = `${Math.round(p * (cards.length - 1)) + 1} / ${cards.length}`;
  }

  const schedule = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  addEventListener('scroll', schedule, { passive: true });
  vp.addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', layout);
  return { layout };
})();

/* ---------- FAQ filtered by age ---------- */

let faqAge = 'all';

function renderFaq() {
  const groups = [];
  if (faqAge !== 'all') groups.push([`For ages ${ICJ.ages[faqAge].label}`, ICJ.faq[faqAge]]);
  groups.push([faqAge === 'all' ? '' : 'For every family', ICJ.faq.general]);
  const list = $('#faq-list');
  list.innerHTML = groups.map(([heading, items], g) => `${heading ? '<p class="faq-group"></p>' : ''}${items.map((_, i) => `<details${g === 0 && i === 0 ? ' open' : ''}><summary></summary><p></p></details>`).join('')}`).join('');
  const headings = $$('.faq-group', list);
  groups.filter(([h]) => h).forEach(([h], i) => { headings[i].textContent = h; });
  const all = groups.flatMap(([, items]) => items);
  $$('details', list).forEach((d, i) => {
    $('summary', d).textContent = all[i][0];
    $('p', d).textContent = all[i][1];
  });
  const n = displayName();
  $('#faq-for').textContent = faqAge === 'all'
    ? "Pick your child's age to see the questions parents of that age ask most."
    : `Showing questions for ages ${ICJ.ages[faqAge].label}${n ? `, like ${n}` : ''}, plus the ones every family asks.`;
}

function setFaqAge(age) {
  faqAge = age;
  const r = $(`input[name="faq-age"][value="${age}"]`);
  if (r) r.checked = true;
  renderFaq();
}

$$('input[name="faq-age"]').forEach(r => r.addEventListener('change', () => setFaqAge(r.value)));

/* ---------- Google reviews ---------- */

const Reviews = (() => {
  const section = $('#reviews');
  const starRow = rating => Array.from({ length: 5 }, (_, i) => `<svg class="${rating >= i + 0.75 ? 'full' : rating >= i + 0.25 ? 'half' : 'empty'}" aria-hidden="true"><use href="#i-star"/></svg>`).join('');

  function loadMapsScript(key) {
    if (window.google?.maps?.importLibrary) return Promise.resolve();
    return new Promise((resolve, reject) => {
      window.__icjMapsReady = resolve;
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&callback=__icjMapsReady`;
      script.async = true;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function render(place) {
    const reviews = (place.reviews || []).filter(r => r.text);
    if (!reviews.length) return;
    const score = Number(place.rating || 0).toFixed(1);
    $('#rv-score-h').textContent = score;
    $('#rv-score').textContent = score;
    $('#rv-stars').innerHTML = starRow(place.rating || 0);
    $('#rv-count').textContent = (place.userRatingCount || reviews.length).toLocaleString('en');
    $('#rv-all').href = place.googleMapsURI || '#';
    const track = $('#rv-track');
    track.innerHTML = reviews.map(r => `<figure class="rv-card">
        <div class="rv-top"><img class="rv-ava" alt="" loading="lazy" referrerpolicy="no-referrer"><span><a class="rv-name" target="_blank" rel="noopener"></a><small class="rv-when"></small></span></div>
        <span class="rv-stars-sm" role="img" aria-label="${r.rating} out of 5 stars">${starRow(r.rating)}</span>
        <blockquote class="rv-text"></blockquote>
      </figure>`).join('');
    $$('.rv-card', track).forEach((card, i) => {
      const r = reviews[i];
      const who = r.authorAttribution || {};
      const img = $('.rv-ava', card);
      if (who.photoURI) img.src = who.photoURI; else img.remove();
      const name = $('.rv-name', card);
      name.textContent = who.displayName || 'Google user';
      if (who.uri) name.href = who.uri; else name.removeAttribute('href');
      $('.rv-when', card).textContent = r.relativePublishTimeDescription || '';
      $('.rv-text', card).textContent = r.text;
    });
    // Repeat the cards so the scroller loops seamlessly.
    track.append(...$$('.rv-card', track).map(c => { const copy = c.cloneNode(true); copy.setAttribute('aria-hidden', 'true'); $$('a', copy).forEach(a => { a.tabIndex = -1; }); return copy; }));
    section.hidden = false;
  }

  async function load() {
    if (!CONFIG.googleMapsApiKey || !CONFIG.googlePlaceId) {
      console.info('[reviews] Add googleMapsApiKey and googlePlaceId to CONFIG in script.js to show Google reviews.');
      return;
    }
    try {
      await loadMapsScript(CONFIG.googleMapsApiKey);
      const { Place } = await google.maps.importLibrary('places');
      const place = new Place({ id: CONFIG.googlePlaceId });
      await place.fetchFields({ fields: ['rating', 'userRatingCount', 'reviews', 'googleMapsURI'] });
      render(place);
    } catch (err) {
      console.warn('[reviews] Could not load Google reviews.', err);
    }
  }

  // Load only when the parent scrolls near the FAQ, so the API is called once per visit and only when needed.
  new IntersectionObserver((entries, observer) => {
    if (!entries[0].isIntersecting) return;
    observer.disconnect();
    load();
  }, { rootMargin: '900px 0px' }).observe($('#faq'));

  return { render };
})();

/* ---------- Init ---------- */

// Duplicate the school logos so the marquee loops seamlessly.
const logoTrack = $('.logo-track');
logoTrack.append(...[...logoTrack.children].map(img => {
  const copy = img.cloneNode();
  copy.alt = '';
  copy.setAttribute('aria-hidden', 'true');
  return copy;
}));

renderDays();
renderSlots();
Preview.update({});
renderPlan();
renderPress();
renderFaq();
syncFooterCols();
personalize();
ProjectRow.layout();
addEventListener('load', ProjectRow.layout);
showStep(1, { focus: false });
