'use strict';

const API_URL = '../api/tippspiel.php';

function setStatus(el, text, type) {
  if (!el) return;
  el.textContent = text;
  el.hidden = !text;
  el.classList.remove('is-error', 'is-success');
  if (type === 'error') el.classList.add('is-error');
  if (type === 'success') el.classList.add('is-success');
}

function showClosedState(deadlineEl, form, submitBtn) {
  if (deadlineEl) {
    deadlineEl.textContent = 'Die Teilnahmefrist ist abgelaufen.';
    deadlineEl.classList.add('is-closed');
  }
  if (form) {
    form.querySelectorAll('input, button').forEach(el => {
      el.disabled = true;
    });
  }
  if (submitBtn) submitBtn.disabled = true;
}

async function loadStatus() {
  const deadlineEl = document.getElementById('tippspielDeadline');
  const form = document.getElementById('tippspielForm');
  const submitBtn = form?.querySelector('.tippspiel-submit');

  try {
    const res = await fetch(API_URL, { headers: { Accept: 'application/json' } });
    const data = await res.json();
    if (!data.ok) return;

    if (deadlineEl && data.deadline_display) {
      deadlineEl.textContent = data.open
        ? `Teilnahme möglich bis ${data.deadline_display}`
        : 'Die Teilnahmefrist ist abgelaufen.';
      if (!data.open) deadlineEl.classList.add('is-closed');
    }

    if (!data.open) {
      showClosedState(deadlineEl, form, submitBtn);
    }
  } catch (e) {
    // Server-Check beim Absenden
  }
}

function initTippspiel() {
  const form = document.getElementById('tippspielForm');
  if (!form) return;

  const statusEl = document.getElementById('tippspielStatus');
  const submitBtn = form.querySelector('.tippspiel-submit');
  const successEl = document.getElementById('tippspielSuccess');

  loadStatus();

  form.addEventListener('submit', async e => {
    e.preventDefault();

    const firstName = String(form.querySelector('#tippspielFirstName')?.value || '').trim();
    const lastName = String(form.querySelector('#tippspielLastName')?.value || '').trim();
    const email = String(form.querySelector('#tippspielEmail')?.value || '').trim();
    const tipDe = form.querySelector('#tippspielDe')?.value;
    const tipEc = form.querySelector('#tippspielEc')?.value;
    const consent = form.querySelector('#tippspielConsent')?.checked;

    if (!firstName) {
      setStatus(statusEl, 'Bitte gib deinen Vornamen ein.', 'error');
      form.querySelector('#tippspielFirstName')?.focus();
      return;
    }

    if (!lastName) {
      setStatus(statusEl, 'Bitte gib deinen Nachnamen ein.', 'error');
      form.querySelector('#tippspielLastName')?.focus();
      return;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus(statusEl, 'Bitte gib eine gültige E-Mail-Adresse ein.', 'error');
      form.querySelector('#tippspielEmail')?.focus();
      return;
    }

    if (tipDe === '' || tipEc === '' || tipDe === null || tipEc === null) {
      setStatus(statusEl, 'Bitte tippe ein Ergebnis ein.', 'error');
      return;
    }

    if (!consent) {
      setStatus(statusEl, 'Bitte stimme den Teilnahmebedingungen zu.', 'error');
      form.querySelector('#tippspielConsent')?.focus();
      return;
    }

    setStatus(statusEl, '', '');
    submitBtn.disabled = true;
    submitBtn.setAttribute('aria-busy', 'true');

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          tip_de: Number(tipDe),
          tip_ec: Number(tipEc),
          consent: true
        })
      });

      let data = {};
      try {
        data = await res.json();
      } catch (err) {
        throw new Error('Unerwartete Server-Antwort.');
      }

      if (!res.ok || !data.ok) {
        throw new Error(data.message || 'Einreichung fehlgeschlagen.');
      }

      form.hidden = true;
      if (successEl) {
        successEl.hidden = false;
        const msg = successEl.querySelector('.tippspiel-success-text');
        if (msg) msg.textContent = data.message || data.tip_message || 'Dein Tipp ist eingegangen. Wir melden uns per E-Mail, wenn du gewonnen hast.';
      }
    } catch (err) {
      setStatus(statusEl, err.message || 'Etwas ist schiefgelaufen. Bitte erneut versuchen.', 'error');
      submitBtn.disabled = false;
      submitBtn.removeAttribute('aria-busy');
    }
  });
}

document.addEventListener('DOMContentLoaded', initTippspiel);
