'use strict';

const SHOP_BASE = 'https://shop.snapticket.de/event';
const SHOP_HOME = 'https://shop.snapticket.de/';
const VIVENU_API = 'https://vivenu.com/api/events?top=100&skip=0';
const EB_API = 'https://www.eventbriteapi.com/v3';

let allEvents = [];
/** Volle Liste kommender Shows (sortiert); für „Mehr ansehen“. */
let showsUpcomingFull = [];
let showsVisibleCount = 0;
let countdownTimerId = null;

const SHOWS_STEP_DESKTOP = 6;
const SHOWS_STEP_MOBILE = 3;

function getShowsPageStep() {
  return window.matchMedia('(max-width: 768px)').matches ? SHOWS_STEP_MOBILE : SHOWS_STEP_DESKTOP;
}

function getCfg() {
  const d = {
    vivenuApiKey: '',
    eventbriteToken: '',
    vivenuSellerIds: [],
    /** false (Standard): alle zukünftigen Vivenu-Events außer „Backstage“ im Text. true: nur „Steh auf“/Open-Mic-Filter. */
    vivenuStrictFilter: false
  };
  const w = typeof window !== 'undefined' && window.STEH_AUF_CONFIG;
  if (!w || typeof w !== 'object') return d;
  return {
    vivenuApiKey: String(w.vivenuApiKey || '').trim(),
    eventbriteToken: String(w.eventbriteToken || '').trim(),
    vivenuSellerIds: Array.isArray(w.vivenuSellerIds) ? w.vivenuSellerIds.map(String) : [],
    vivenuStrictFilter: w.vivenuStrictFilter === true
  };
}

function textIsStehAufComedy(haystack) {
  const h = String(haystack || '').toLowerCase();
  if (h.includes('backstage')) return false;
  if (/steh\s*auf|stehauf|steh-auf/ui.test(h)) return true;
  if (/open\s*mic/ui.test(h) && /freising|münchen|muenchen|comedy/ui.test(h)) return true;
  return false;
}

function vivenuRowIsBackstage(row) {
  const parts = [row.name, row.slogan, row.description];
  if (Array.isArray(row.tags)) {
    row.tags.forEach(t => parts.push(typeof t === 'string' ? t : ''));
  }
  return String(parts.join(' ')).toLowerCase().includes('backstage');
}

function vivenuRowMatches(row, sellerAllow, strictFilter) {
  const sid = String(row.sellerId || '').trim();
  const allow = sellerAllow.map(String).map(s => s.trim()).filter(Boolean);

  if (allow.length) {
    if (!sid || !allow.some(a => a === sid)) {
      return false;
    }
    return !vivenuRowIsBackstage(row);
  }

  if (!strictFilter) {
    return !vivenuRowIsBackstage(row);
  }
  const parts = [row.name, row.slogan, row.description];
  if (Array.isArray(row.tags)) {
    row.tags.forEach(t => parts.push(typeof t === 'string' ? t : ''));
  }
  return textIsStehAufComedy(parts.join(' '));
}

function ebTextMatches(ev) {
  const parts = [];
  const n = ev.name;
  if (typeof n === 'string') parts.push(n);
  else if (n && n.text) parts.push(n.text);
  if (ev.description && ev.description.text) parts.push(ev.description.text);
  if (ev.summary && ev.summary.text) parts.push(ev.summary.text);
  return textIsStehAufComedy(parts.join(' '));
}

async function fetchJson(url, headers) {
  const res = await fetch(url, { headers, cache: 'no-store', mode: 'cors' });
  const text = await res.text();
  if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + text.slice(0, 160));
  return JSON.parse(text);
}

async function fetchVivenuEvents(cfg, meta, errors) {
  const out = [];
  if (!cfg.vivenuApiKey) return out;
  try {
    const data = await fetchJson(VIVENU_API, {
      Authorization: 'Bearer ' + cfg.vivenuApiKey,
      Accept: 'application/json'
    });
    const rows = data.rows || data.docs || [];
    meta.vivenu_rows_in = rows.length;
    const now = Date.now();
    let futureCount = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const start = row.start;
      if (!start) continue;
      const startTs = new Date(start).getTime();
      if (!Number.isNaN(startTs) && startTs >= now) futureCount++;
    }
    meta.vivenu_upcoming_in_api = futureCount;
    const sellerAllow = cfg.vivenuSellerIds;
    const strict = cfg.vivenuStrictFilter;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!vivenuRowMatches(row, sellerAllow, strict)) continue;
      const name = row.name || '';
      const start = row.start;
      if (!start) continue;
      const startTs = new Date(start).getTime();
      if (Number.isNaN(startTs) || startTs < now) continue;
      meta.vivenu_matched++;
      out.push({
        source: 'vivenu',
        name,
        start,
        end: row.end || null,
        image: row.image || null,
        locationName: row.locationName || null,
        locationCity: row.locationCity || null,
        tickets: row.tickets || [],
        url: row.url || '',
        id: row._id || row.id || null
      });
    }
  } catch (e) {
    errors.push('Vivenu: ' + (e.message || String(e)));
  }
  return out;
}

async function fetchEventbriteOrgPages(oid, headers, eb_events, errors) {
  let continuation = null;
  do {
    let q = 'status=live&order_by=start_asc&expand=venue&page_size=50';
    if (continuation) q += '&continuation=' + encodeURIComponent(continuation);
    const url = EB_API + '/organizations/' + encodeURIComponent(oid) + '/events/?' + q;
    try {
      const j = await fetchJson(url, headers);
      (j.events || []).forEach(ev => eb_events.push(ev));
      continuation = j.pagination && j.pagination.continuation ? j.pagination.continuation : null;
    } catch (e) {
      errors.push('Eventbrite org ' + oid + ': ' + (e.message || e));
      break;
    }
  } while (continuation);
}

async function fetchEventbriteEvents(cfg, meta, errors) {
  const eb_events = [];
  if (!cfg.eventbriteToken) return eb_events;
  const headers = {
    Authorization: 'Bearer ' + cfg.eventbriteToken,
    Accept: 'application/json'
  };
  try {
    let orgIds = [];
    try {
      const j1 = await fetchJson(EB_API + '/users/me/organizations/', headers);
      (j1.organizations || []).forEach(o => {
        if (o.id) orgIds.push(o.id);
      });
    } catch (e) {
      errors.push('Eventbrite organizations: ' + (e.message || e));
    }
    if (orgIds.length) {
      for (let i = 0; i < orgIds.length; i++) {
        await fetchEventbriteOrgPages(orgIds[i], headers, eb_events, errors);
      }
    }
    if (eb_events.length === 0) {
      try {
        const j2 = await fetchJson(
          EB_API + '/users/me/owned_events/?status=live&order_by=start_asc&expand=venue&page_size=50',
          headers
        );
        (j2.events || []).forEach(ev => eb_events.push(ev));
      } catch (e) {
        errors.push('Eventbrite owned_events: ' + (e.message || e));
      }
    }
    if (eb_events.length === 0) {
      try {
        const j4 = await fetchJson(
          EB_API + '/users/me/events/?status=live&order_by=start_asc&expand=venue&page_size=50',
          headers
        );
        (j4.events || []).forEach(ev => eb_events.push(ev));
      } catch (e) {
        errors.push('Eventbrite users/me/events: ' + (e.message || e));
      }
    }
    meta.eventbrite_events_in = eb_events.length;
    const now = Date.now();
    const mapped = [];
    for (let i = 0; i < eb_events.length; i++) {
      const ev = eb_events[i];
      if (!ebTextMatches(ev)) continue;
      const utc = ev.start && ev.start.utc;
      if (!utc) continue;
      const startTs = new Date(utc).getTime();
      if (Number.isNaN(startTs) || startTs < now) continue;
      meta.eventbrite_matched++;
      const nf = ev.name;
      const title = typeof nf === 'string' ? nf : (nf && nf.text) ? nf.text : '';
      let locName = null;
      let locCity = null;
      const venue = ev.venue;
      if (venue && typeof venue === 'object') {
        locName = venue.name || null;
        const addr = venue.address;
        if (addr && typeof addr === 'object') locCity = addr.city || null;
      }
      let logo = null;
      if (ev.logo && ev.logo.url) logo = ev.logo.url;
      mapped.push({
        source: 'eventbrite',
        name: title,
        start: new Date(startTs).toISOString(),
        end: ev.end && ev.end.utc ? ev.end.utc : null,
        image: logo,
        locationName: locName,
        locationCity: locCity,
        tickets: [],
        url: ev.url || '',
        id: null,
        ticketUrl: ev.url || '',
        isFree: ev.is_free === true
      });
    }
    return mapped;
  } catch (e) {
    errors.push('Eventbrite: ' + (e.message || String(e)));
    return [];
  }
}

async function fetchShowsClientSide() {
  const cfg = getCfg();
  const errors = [];
  const hints = [];
  const meta = {
    vivenu_key_set: cfg.vivenuApiKey !== '',
    eventbrite_token_set: cfg.eventbriteToken !== '',
    vivenu_rows_in: 0,
    vivenu_matched: 0,
    eventbrite_events_in: 0,
    eventbrite_matched: 0
  };
  const vivenuList = await fetchVivenuEvents(cfg, meta, errors);
  const ebList = await fetchEventbriteEvents(cfg, meta, errors);
  let events = vivenuList.concat(ebList);
  events.sort((a, b) => new Date(a.start) - new Date(b.start));
  if (events.length === 0) {
    if (!cfg.vivenuApiKey && !cfg.eventbriteToken) {
      hints.push('Keine API-Keys: In config.js vivenuApiKey und/oder eventbriteToken eintragen (Vorlage: config.example.js).');
    }
    const vivenuErr = errors.some(e => String(e).toLowerCase().includes('vivenu'));
    if (cfg.vivenuApiKey && vivenuErr) {
      hints.push('Vivenu-Anfrage fehlgeschlagen (Netzwerk, CORS oder ungültiger Key) – Browser-Konsole prüfen.');
    }
    if (cfg.vivenuApiKey && meta.vivenu_rows_in === 0 && !vivenuErr) {
      hints.push('Vivenu meldet 0 Events (Account leer oder Key gehört zu anderem Konto).');
    }
    if (cfg.vivenuApiKey && meta.vivenu_rows_in > 0 && meta.vivenu_matched === 0) {
      if (cfg.vivenuSellerIds && cfg.vivenuSellerIds.length) {
        hints.push('Vivenu: vivenuSellerIds passt zu keinem Event (falsche ID?) – Array leer [] setzen oder sellerId aus dem Vivenu-Dashboard/API prüfen.');
      } else if ((meta.vivenu_upcoming_in_api || 0) === 0) {
        hints.push('Vivenu liefert Daten, aber keine zukünftigen Starttermine (alle Events in der Vergangenheit).');
      } else {
        hints.push('Vivenu: Es gibt kommende Events, aber der Filter verwirft alle (z. B. alle als „Backstage“ erkannt oder vivenuStrictFilter: true). vivenuStrictFilter: false testen.');
      }
    }
    if (cfg.eventbriteToken && meta.eventbrite_events_in === 0) {
      hints.push('Eventbrite: 0 Events oder CORS/Token – ggf. nur Vivenu nutzen.');
    }
    if (cfg.eventbriteToken && meta.eventbrite_events_in > 0 && meta.eventbrite_matched === 0) {
      hints.push('Eventbrite: Events gefunden, Textfilter trifft nicht – Beschreibung mit „Steh auf“ ergänzen.');
    }
  }
  return { events, errors, hints, meta };
}

function initPreloader() {
  const preloader = document.getElementById('preloader');
  if (!preloader) return;
  const hasVisited = sessionStorage.getItem('sac_visited');
  if (hasVisited) { preloader.style.display = 'none'; return; }
  const logo = preloader.querySelector('.preloader-logo');
  setTimeout(() => logo && logo.classList.add('show'), 100);
  setTimeout(() => {
    preloader && preloader.classList.add('hide');
    setTimeout(() => { if (preloader) preloader.style.display = 'none'; }, 900);
  }, 1400);
  sessionStorage.setItem('sac_visited', '1');
}

function initCursor() {
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  if (isTouch) return;
  const dot = document.createElement('div');
  dot.className = 'cursor-dot';
  const ring = document.createElement('div');
  ring.className = 'cursor-ring';
  document.body.append(dot, ring);
  let ringX = 0, ringY = 0, mouseX = 0, mouseY = 0;
  document.addEventListener('mousemove', e => {
    mouseX = e.clientX; mouseY = e.clientY;
    dot.style.left = mouseX + 'px'; dot.style.top = mouseY + 'px';
  });
  function animateRing() {
    ringX += (mouseX - ringX) * 0.12;
    ringY += (mouseY - ringY) * 0.12;
    ring.style.left = ringX + 'px'; ring.style.top = ringY + 'px';
    requestAnimationFrame(animateRing);
  }
  animateRing();
}

function initNavDropdowns() {
  const items = document.querySelectorAll('.nav-has-dropdown');
  if (!items.length) return;

  let closeTimer = null;

  items.forEach(item => {
    const trigger = item.querySelector('.nav-dropdown-trigger');
    if (!trigger) return;

    item.addEventListener('mouseenter', () => {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
      items.forEach(other => {
        if (other !== item) {
          other.classList.remove('open');
          other.querySelector('.nav-dropdown-trigger')?.setAttribute('aria-expanded', 'false');
        }
      });
      item.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
    });

    item.addEventListener('mouseleave', () => {
      closeTimer = setTimeout(() => {
        item.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
      }, 180);
    });

    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = item.classList.contains('open');
      items.forEach(other => {
        other.classList.remove('open');
        other.querySelector('.nav-dropdown-trigger')?.setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        item.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });
  });

  document.addEventListener('click', (e) => {
    if (e.target.closest('.nav-has-dropdown')) return;
    items.forEach(item => {
      item.classList.remove('open');
      item.querySelector('.nav-dropdown-trigger')?.setAttribute('aria-expanded', 'false');
    });
  });
}

function initNavigation() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  const onScroll = () => {
    nav.classList.toggle('scrolled', window.scrollY > 60);
    updateActiveNavLink();
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  const hamburger = document.querySelector('.nav-hamburger');
  const overlay = document.querySelector('.nav-overlay');
  if (hamburger && overlay) {
    hamburger.addEventListener('click', () => {
      const isOpen = overlay.classList.toggle('open');
      hamburger.classList.toggle('open', isOpen);
      hamburger.setAttribute('aria-expanded', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });
    overlay.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        overlay.classList.remove('open');
        hamburger.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });
  }
}

function updateActiveNavLink() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');
  let current = '';
  sections.forEach(sec => {
    if (window.scrollY >= sec.offsetTop - 120) current = sec.id;
  });
  document.querySelectorAll('.nav-dropdown-trigger').forEach(t => t.classList.remove('active'));
  navLinks.forEach(link => {
    const href = link.getAttribute('href').slice(1);
    const isActive = href === current;
    link.classList.toggle('active', isActive);
    if (isActive) {
      link.closest('.nav-has-dropdown')?.querySelector('.nav-dropdown-trigger')?.classList.add('active');
    }
  });
}

function initHeroAnimation() {
  const title = document.querySelector('.hero-title');
  if (!title) return;
  const lines = title.querySelectorAll('.hero-line');
  lines.forEach((line, lineIdx) => {
    const text = line.textContent;
    line.textContent = '';
    const words = text.split(' ');
    words.forEach((word, wordIdx) => {
      const wrapper = document.createElement('span');
      wrapper.className = 'word-wrapper';
      const inner = document.createElement('span');
      inner.className = 'word';
      inner.textContent = word + (wordIdx < words.length - 1 ? '\u00a0' : '');
      inner.style.animationDelay = `${(lineIdx * words.length + wordIdx) * 0.08 + 0.4}s`;
      wrapper.appendChild(inner);
      line.appendChild(wrapper);
    });
  });
}

function observeRevealElts(elements) {
  if (!elements) return;
  const list = Array.from(elements);
  if (!list.length) return;
  if (!('IntersectionObserver' in window)) {
    list.forEach(el => el.classList.add('visible'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });
  list.forEach(el => observer.observe(el));
}

function initScrollReveal() {
  observeRevealElts(document.querySelectorAll('.reveal'));
}

function initCounters() {
  const counters = document.querySelectorAll('[data-counter]');
  if (!counters.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const suffix = el.dataset.suffix || '';
      const millionsMode = el.dataset.counterMode === 'millions';
      const targetVal = millionsMode
        ? parseFloat(el.dataset.counter, 10)
        : parseInt(el.dataset.counter, 10);
      const duration = millionsMode ? 2400 : 1800;
      const start = performance.now();
      function update(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        if (millionsMode && !Number.isNaN(targetVal)) {
          const val = eased * targetVal;
          el.textContent =
            val.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) +
            ' Mio.' +
            suffix;
        } else {
          el.textContent = Math.round(eased * targetVal) + suffix;
        }
        if (progress < 1) requestAnimationFrame(update);
      }
      requestAnimationFrame(update);
      observer.unobserve(el);
    });
  }, { threshold: 0.5 });
  counters.forEach(c => observer.observe(c));
}

function initFAQ() {
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(i => {
        i.classList.remove('open');
        i.querySelector('.faq-answer').style.maxHeight = null;
        i.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
        const answer = item.querySelector('.faq-answer');
        answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    });
  });
}

function initParallax() {
  const heroContent = document.querySelector('.hero-content');
  if (!heroContent || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  window.addEventListener('scroll', () => {
    const scrolled = window.scrollY;
    if (scrolled < window.innerHeight) {
      heroContent.style.transform = `translateY(${scrolled * 0.25}px)`;
    }
  }, { passive: true });
}

function getTicketUrl(event) {
  if (event.source === 'eventbrite') {
    return event.ticketUrl || event.url || '';
  }
  if (event.url) {
    return `${SHOP_BASE}/${event.url}`;
  }
  return '';
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function hideNextShowCountdown() {
  const wrap = document.getElementById('nextShowCountdown');
  if (wrap) wrap.hidden = true;
  if (countdownTimerId) {
    clearInterval(countdownTimerId);
    countdownTimerId = null;
  }
}

function setCountdownCta(event) {
  const cta = document.getElementById('countdownCta');
  if (!cta) return;
  const soldOut = (event.name || '').toLowerCase().includes('sold out');
  const ticketUrl = getTicketUrl(event);
  if (soldOut) {
    cta.href = '#shows';
    cta.removeAttribute('target');
    cta.removeAttribute('rel');
    cta.textContent = 'Weitere Termine';
  } else if (ticketUrl) {
    cta.href = ticketUrl;
    cta.target = '_blank';
    cta.rel = 'noopener noreferrer';
    cta.textContent = 'Tickets sichern';
  } else {
    cta.href = '#shows';
    cta.removeAttribute('target');
    cta.removeAttribute('rel');
    cta.textContent = 'Zu den Terminen';
  }
}

function initNextShowCountdown(event) {
  const wrap = document.getElementById('nextShowCountdown');
  if (!wrap || !event) {
    hideNextShowCountdown();
    return;
  }
  const start = new Date(event.start);
  if (Number.isNaN(start.getTime())) {
    hideNextShowCountdown();
    return;
  }

  const titleEl = document.getElementById('countdownShowTitle');
  const dateEl = document.getElementById('countdownDateTime');
  const cdDays = document.getElementById('cdDays');
  const cdHours = document.getElementById('cdHours');
  const cdMinutes = document.getElementById('cdMinutes');
  const cdSeconds = document.getElementById('cdSeconds');
  const grid = document.getElementById('countdownGrid');
  const doneMsg = document.getElementById('countdownDoneMsg');
  const eyebrow = document.getElementById('countdownEyebrow');

  if (titleEl) titleEl.textContent = event.name || 'Steh auf Comedy';
  if (dateEl) {
    dateEl.textContent = formatShortDateFull(event.start) + ' · Einlass ' + formatTime(event.start) + ' Uhr';
  }
  setCountdownCta(event);

  function applyDoneState() {
    if (eyebrow) eyebrow.textContent = 'Nächste Show:';
    if (grid) grid.hidden = true;
    if (doneMsg) doneMsg.hidden = false;
    if (countdownTimerId) {
      clearInterval(countdownTimerId);
      countdownTimerId = null;
    }
  }

  function tick() {
    const diff = start.getTime() - Date.now();
    if (diff <= 0) {
      if (cdDays) cdDays.textContent = '0';
      if (cdHours) cdHours.textContent = '00';
      if (cdMinutes) cdMinutes.textContent = '00';
      if (cdSeconds) cdSeconds.textContent = '00';
      applyDoneState();
      return;
    }
    if (grid) grid.hidden = false;
    if (doneMsg) doneMsg.hidden = true;
    if (eyebrow) eyebrow.textContent = 'Nächste Show in:';
    const sec = Math.floor(diff / 1000);
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (cdDays) cdDays.textContent = d > 99 ? String(d) : pad2(d);
    if (cdHours) cdHours.textContent = pad2(h);
    if (cdMinutes) cdMinutes.textContent = pad2(m);
    if (cdSeconds) cdSeconds.textContent = pad2(s);
  }

  if (countdownTimerId) {
    clearInterval(countdownTimerId);
    countdownTimerId = null;
  }
  wrap.hidden = false;
  tick();
  countdownTimerId = setInterval(tick, 1000);
  observeRevealElts([wrap]);
}

async function loadShows() {
  const grid = document.getElementById('showsGrid');
  if (!grid) return;
  showSkeletons(grid);
  try {
    const data = await fetchShowsClientSide();
    if (data.errors && data.errors.length) {
      console.warn('Termine API:', data.errors.join('; '));
    }
    if (data.hints && data.hints.length) {
      console.info('Termine Hinweise:', data.hints.join(' '));
    }
    allEvents = data.events || [];
    const upcoming = allEvents.filter(e => new Date(e.start) >= new Date());
    if (!upcoming.length) {
      hideNextShowCountdown();
      renderShowsFallback(grid, data.hints || [], data.errors || [], data.meta);
      return;
    }
    renderShowCardsPaginated(grid, upcoming);
    initNextShowCountdown(upcoming[0]);
  } catch (err) {
    console.error('Termine laden:', err);
    hideNextShowCountdown();
    renderShowsFallback(grid, [], [String(err.message || err)]);
  }
}

function showSkeletons(grid) {
  const moreWrap = document.getElementById('showsMoreWrap');
  if (moreWrap) moreWrap.hidden = true;
  grid.innerHTML = Array.from({ length: 3 }, () => `
    <div class="skeleton-card">
      <div class="skeleton skeleton-img"></div>
      <div class="skeleton-body">
        <div class="skeleton skeleton-line short"></div>
        <div class="skeleton skeleton-line medium"></div>
        <div class="skeleton skeleton-line full"></div>
      </div>
    </div>`).join('');
}

function updateShowsMoreButton() {
  const wrap = document.getElementById('showsMoreWrap');
  if (!wrap) return;
  wrap.hidden = showsVisibleCount >= showsUpcomingFull.length;
}

function renderShowsGridInitial(grid, eventsFull) {
  showsUpcomingFull = eventsFull;
  showsVisibleCount = Math.min(getShowsPageStep(), eventsFull.length);
  grid.setAttribute('aria-busy', 'false');
  grid.innerHTML = eventsFull.slice(0, showsVisibleCount).map(e => buildShowCard(e)).join('');
  bindGlobalTicketCtas(eventsFull);
  observeRevealElts(grid.querySelectorAll('.show-card'));
  updateShowsMoreButton();
}

function appendShowsGrid(grid) {
  const prev = showsVisibleCount;
  const step = getShowsPageStep();
  showsVisibleCount = Math.min(prev + step, showsUpcomingFull.length);
  const html = showsUpcomingFull.slice(prev, showsVisibleCount).map(e => buildShowCard(e)).join('');
  const beforeLen = grid.children.length;
  grid.insertAdjacentHTML('beforeend', html);
  observeRevealElts(Array.from(grid.children).slice(beforeLen));
  updateShowsMoreButton();
}

function renderShowCardsPaginated(grid, eventsFull) {
  if (!eventsFull.length) {
    renderShowsFallback(grid);
    return;
  }
  renderShowsGridInitial(grid, eventsFull);
  injectEventSchemas(eventsFull);
}

let globalTicketCtaHandlersBound = false;

function initShowsLoadMore() {
  const btn = document.getElementById('showsMoreBtn');
  const grid = document.getElementById('showsGrid');
  if (!btn || !grid) return;
  btn.addEventListener('click', () => {
    if (!showsUpcomingFull.length || showsVisibleCount >= showsUpcomingFull.length) return;
    appendShowsGrid(grid);
  });
}

function buildShowCard(event) {
  const start = new Date(event.start);
  const end = event.end ? new Date(event.end) : null;
  const now = new Date();
  const isToday = start.toDateString() === now.toDateString();
  const isSoldOut = (event.name || '').toLowerCase().includes('sold out');
  const minPrice = getMinPrice(event);
  const ticketUrl = getTicketUrl(event);
  const isFreeEventbrite = event.source === 'eventbrite' && event.isFree === true;

  let badge = '';
  if (isSoldOut) badge = `<span class="show-badge badge-soldout">Ausverkauft</span>`;
  else if (isToday) badge = `<span class="show-badge badge-today">Heute!</span>`;

  const imageHtml = event.image
    ? `<img src="${escAttr(event.image)}" alt="Steh auf Comedy – ${escAttr(formatFullDate(event.start))}" loading="lazy" width="2420" height="900" onerror="this.style.display='none'">`
    : `<div class="show-card-placeholder">🎭</div>`;

  let ctaHtml = '';
  if (isSoldOut) {
    ctaHtml = `<span style="font-size:0.85rem;color:#cc3333;font-weight:600;">Ausverkauft</span>`;
  } else if (ticketUrl) {
    ctaHtml = `<a href="${escAttr(ticketUrl)}" target="_blank" rel="noopener noreferrer" class="show-cta">Tickets sichern →</a>`;
  }

  return `
    <article class="show-card reveal">
      <div class="show-card-image">
        ${imageHtml}
        ${badge}
      </div>
      <div class="show-card-body">
        <div class="show-date">${formatShortDateFull(event.start)}</div>
        <div class="show-time">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Einlass ${formatTime(event.start)} Uhr${end ? ` · Show ${formatTime(event.end)} Uhr` : ''}
        </div>
        <div class="show-name">${escHtml(event.name)}</div>
        ${event.locationName ? `
        <div class="show-location">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          ${escHtml(event.locationName)}${event.locationCity ? `, ${escHtml(event.locationCity)}` : ''}
        </div>` : ''}
        <div class="show-footer">
          ${isFreeEventbrite
            ? `<div class="show-price show-price-free">Kostenlos</div>`
            : minPrice !== null
              ? `<div class="show-price">ab ${formatPrice(minPrice)} <span>€</span></div>`
              : '<div></div>'}
          ${ctaHtml}
        </div>
      </div>
    </article>`;
}

function bindGlobalTicketCtas(events) {
  const first = events.find(e => !(e.name || '').toLowerCase().includes('sold out'));
  if (!first) return;
  if (globalTicketCtaHandlersBound) return;
  globalTicketCtaHandlersBound = true;
  const handler = (ev) => {
    ev.preventDefault();
    const u = getTicketUrl(first);
    if (u) {
      window.open(u, '_blank', 'noopener,noreferrer');
    } else {
      window.open(SHOP_HOME, '_blank', 'noopener,noreferrer');
    }
  };
  const navCta = document.querySelector('.nav-cta');
  if (navCta) navCta.addEventListener('click', handler);
  const overlayCta = document.querySelector('.nav-cta-overlay');
  if (overlayCta) overlayCta.addEventListener('click', handler);
  const heroBtn = document.querySelector('.hero-actions .btn-primary');
  if (heroBtn) heroBtn.addEventListener('click', handler);
}

function renderShowsFallback(grid, hints = [], apiErrors = [], meta = null) {
  hideNextShowCountdown();
  showsUpcomingFull = [];
  showsVisibleCount = 0;
  const moreWrap = document.getElementById('showsMoreWrap');
  if (moreWrap) moreWrap.hidden = true;
  grid.setAttribute('aria-busy', 'false');
  const hintLines = [...hints, ...apiErrors].filter(Boolean);
  const debugBlock = hintLines.length
    ? `<div class="shows-debug" role="status"><strong>Hinweis zur Ticket-Anzeige:</strong><ul>${hintLines.map(h => `<li>${escHtml(h)}</li>`).join('')}</ul>${meta ? `<p class="shows-debug-meta">Vivenu-Zeilen: ${meta.vivenu_rows_in ?? '–'}, Treffer: ${meta.vivenu_matched ?? '–'} · Eventbrite: ${meta.eventbrite_events_in ?? '–'} / ${meta.eventbrite_matched ?? '–'}</p>` : ''}</div>`
    : '';
  grid.innerHTML = `
    <div class="shows-empty">
      <p>Aktuell sind keine kommenden Termine geladen. Lege <code>config.js</code> an (Kopie von <code>config.example.js</code>) und trage <code>vivenuApiKey</code> und optional <code>eventbriteToken</code> ein.</p>
      ${debugBlock}
      <a href="https://www.instagram.com/steh_auf_comedy/" target="_blank" rel="noopener noreferrer" class="shows-empty-ig">
        @steh_auf_comedy auf Instagram →
      </a>
    </div>`;
}

function injectEventSchemas(events) {
  events.forEach(event => {
    const ticketUrl = getTicketUrl(event);
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Event',
      'name': event.name || 'Steh auf Comedy',
      'startDate': event.start,
      'endDate': event.end || undefined,
      'eventStatus': 'https://schema.org/EventScheduled',
      'eventAttendanceMode': 'https://schema.org/OfflineEventAttendanceMode',
      'location': {
        '@type': 'Place',
        'name': event.locationName || 'Freising',
        'address': {
          '@type': 'PostalAddress',
          'addressLocality': event.locationCity || 'Freising',
          'addressCountry': 'DE'
        }
      },
      'organizer': {
        '@type': 'Organization',
        'name': 'Steh auf Comedy',
        'url': 'https://www.steh-auf.com'
      },
      'url': ticketUrl || 'https://www.steh-auf.com',
      'image': event.image || undefined
    };
    if (event.tickets && event.tickets.length) {
      const minPrice = getMinPrice(event);
      if (minPrice !== null) {
        schema.offers = {
          '@type': 'Offer',
          'price': minPrice,
          'priceCurrency': 'EUR',
          'url': ticketUrl,
          'availability': (event.name || '').toLowerCase().includes('sold out')
            ? 'https://schema.org/SoldOut'
            : 'https://schema.org/InStock'
        };
      }
    }
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
  });
}

const GALLERY_FALLBACK = [
  'gallery1.JPG', 'gallery2.JPG', 'gallery3.JPG', 'gallery4.jpg',
  'gallery5.jpg', 'gallery6.jpg', 'gallery7.jpg', 'gallery8.jpg', 'gallery9.jpg',
  'gallery10.jpg', 'gallery11.jpg'
];

/** Dateinamen der Startseiten-Galerie-Vorschau (für Lightbox-Navigation). */
let previewGalleryFiles = [];
let previewLightboxIndex = 0;
let galleryPreviewLightboxBound = false;

function openPreviewLightbox(index) {
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  if (!lightbox || !lightboxImg || !previewGalleryFiles.length) return;
  previewLightboxIndex = (index + previewGalleryFiles.length) % previewGalleryFiles.length;
  lightboxImg.src = 'assets/galerie/' + previewGalleryFiles[previewLightboxIndex];
  lightboxImg.alt =
    'Steh auf Comedy – Impressionen aus unseren Shows – Foto ' + (previewLightboxIndex + 1);
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
  const closeBtn = document.getElementById('lightboxClose');
  if (closeBtn) closeBtn.focus();
}

function closePreviewLightbox() {
  const lightbox = document.getElementById('lightbox');
  if (!lightbox) return;
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
}

function previewLightboxPrev() {
  openPreviewLightbox(previewLightboxIndex - 1);
}

function previewLightboxNext() {
  openPreviewLightbox(previewLightboxIndex + 1);
}

function initGalleryPreviewLightbox() {
  const gallery = document.getElementById('galleryPreview');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  if (!gallery || !lightbox || !lightboxImg) return;
  if (galleryPreviewLightboxBound) return;
  galleryPreviewLightboxBound = true;

  gallery.addEventListener('click', e => {
    const item = e.target.closest('.gallery-item');
    if (!item) return;
    e.preventDefault();
    const idx = parseInt(item.dataset.index, 10);
    if (Number.isNaN(idx)) return;
    openPreviewLightbox(idx);
  });

  gallery.addEventListener('keydown', e => {
    const item = e.target.closest('.gallery-item');
    if (!item) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const idx = parseInt(item.dataset.index, 10);
      if (Number.isNaN(idx)) return;
      openPreviewLightbox(idx);
    }
  });

  const closeBtn = document.getElementById('lightboxClose');
  const prevBtn = document.getElementById('lightboxPrev');
  const nextBtn = document.getElementById('lightboxNext');
  if (closeBtn) closeBtn.addEventListener('click', closePreviewLightbox);
  if (prevBtn) prevBtn.addEventListener('click', previewLightboxPrev);
  if (nextBtn) nextBtn.addEventListener('click', previewLightboxNext);

  lightbox.addEventListener('click', e => {
    if (e.target === lightbox) closePreviewLightbox();
  });

  document.addEventListener('keydown', e => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') closePreviewLightbox();
    if (e.key === 'ArrowLeft') previewLightboxPrev();
    if (e.key === 'ArrowRight') previewLightboxNext();
  });

  let touchStartX = 0;
  lightbox.addEventListener(
    'touchstart',
    e => {
      touchStartX = e.touches[0].clientX;
    },
    { passive: true }
  );
  lightbox.addEventListener(
    'touchend',
    e => {
      const diff = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) {
        diff > 0 ? previewLightboxNext() : previewLightboxPrev();
      }
    },
    { passive: true }
  );
}

const FAME_IG_SVG =
  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>';

let fameHandlesPromise = null;
let fameMounted = false;

function prefetchFameHandles() {
  if (!fameHandlesPromise) {
    fameHandlesPromise = fetch('assets/wall-of-fame/index.json')
      .then(res => (res.ok ? res.json() : []))
      .catch(() => []);
  }
  return fameHandlesPromise;
}

function shuffleArray(items) {
  const list = items.slice();
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function fameInstagramUrl(handle) {
  return `https://www.instagram.com/${encodeURIComponent(handle)}/`;
}

function createFameTile(handle, eager = false) {
  const safeHandle = handle.replace(/[^a-zA-Z0-9._]/g, '');
  if (!safeHandle) return '';
  const src = `assets/wall-of-fame/${safeHandle}.webp`;
  const url = fameInstagramUrl(safeHandle);
  const loading = eager ? 'eager' : 'lazy';
  const priority = eager ? 'high' : 'low';
  return `<a href="${url}" class="fame-tile" target="_blank" rel="noopener noreferrer" aria-label="@${safeHandle} auf Instagram" role="listitem">
    <img src="${src}" alt="" width="156" height="208" loading="${loading}" decoding="async" fetchpriority="${priority}">
    <span class="fame-tile-ig">${FAME_IG_SVG}</span>
  </a>`;
}

function renderFameCarousel(carousel, handles) {
  const shuffled = shuffleArray(handles);
  const count = shuffled.length;
  const start = Math.floor(Math.random() * count);
  const eagerCount = Math.min(13, count);

  const order = Array.from({ length: count }, (_, i) => (start + i) % count);
  const firstHtml = order
    .slice(0, eagerCount)
    .map(idx => createFameTile(shuffled[idx], true))
    .join('');
  carousel.innerHTML = firstHtml;

  requestAnimationFrame(() => {
    if (count > eagerCount) {
      carousel.insertAdjacentHTML(
        'beforeend',
        order.slice(eagerCount).map(idx => createFameTile(shuffled[idx], false)).join('')
      );
    }
    carousel.children[0]?.scrollIntoView({ inline: 'center', block: 'nearest' });
  });
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

async function mountWallOfFame() {
  if (fameMounted) return;
  fameMounted = true;

  const stage = document.getElementById('fameStage');
  const carouselWrap = document.getElementById('fameCarouselWrap');
  const carousel = document.getElementById('fameCarousel');
  const grid = document.getElementById('fameGrid');
  const countEl = document.getElementById('fameCount');
  const countNum = document.getElementById('fameCountNum');
  if (!stage || !carouselWrap || !carousel || !grid) return;

  const handles = await prefetchFameHandles();

  if (!handles.length) {
    stage.innerHTML = '<p class="fame-loading">Wall of Fame wird geladen …</p>';
    return;
  }

  if (countNum) countNum.textContent = String(handles.length);
  if (countEl) countEl.hidden = false;

  if (prefersReducedMotion()) {
    carouselWrap.hidden = true;
    grid.hidden = false;
    grid.innerHTML = shuffleArray(handles).map(h => createFameTile(h, false)).join('');
  } else {
    carouselWrap.hidden = false;
    grid.hidden = true;
    renderFameCarousel(carousel, handles);
    carouselWrap.classList.remove('is-loading');
  }
}

function scheduleIdleMount() {
  const run = () => mountWallOfFame();
  if ('requestIdleCallback' in window) {
    requestIdleCallback(run, { timeout: 1200 });
  } else {
    setTimeout(run, 300);
  }
}

function initWallOfFame() {
  const stage = document.getElementById('fameStage');
  if (!stage) return;

  prefetchFameHandles();
  scheduleIdleMount();

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          observer.disconnect();
          mountWallOfFame();
        }
      },
      { rootMargin: '100% 0px' }
    );
    observer.observe(stage);
  }
}

async function loadGalleryPreview() {
  const container = document.getElementById('galleryPreview');
  if (!container) return;
  let files = GALLERY_FALLBACK;
  try {
    const res = await fetch('assets/galerie/index.json');
    if (res.ok) files = await res.json();
  } catch (e) {
    console.warn('Galerie-Preview: nutze Fallback-Liste');
  }
  const preview = files.slice(0, 9);
  previewGalleryFiles = preview;
  container.innerHTML = preview
    .map(
      (file, i) => `
    <div class="gallery-item reveal reveal-delay-${(i % 4) + 1}" data-index="${i}" role="button" tabindex="0" aria-label="Foto ${i + 1} in Lightbox öffnen">
      <img
        src="assets/galerie/${file}"
        alt="Steh auf Comedy – Impressionen aus unseren Shows"
        loading="lazy"
        width="400"
        height="300"
      >
      <div class="gallery-overlay"></div>
    </div>`
    )
    .join('');
  initScrollReveal();
  initGalleryPreviewLightbox();
}

function getMinPrice(event) {
  const tickets = event.tickets || [];
  if (!tickets.length) return null;
  return Math.min(...tickets.map(t => t.price));
}

function formatShortDateFull(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

function formatFullDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
}

function formatPrice(p) {
  return Number(p).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(str) {
  return escHtml(str).replace(/'/g, '&#39;');
}

document.addEventListener('DOMContentLoaded', () => {
  initWallOfFame();
  initPreloader();
  initCursor();
  initNavDropdowns();
  initNavigation();
  initHeroAnimation();
  initScrollReveal();
  initCounters();
  initFAQ();
  initParallax();
  initShowsLoadMore();
  loadShows();
  loadGalleryPreview();
});
