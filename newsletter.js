'use strict';

function getNewsletterCfg() {
  const d = {
    apiUrl: 'api/newsletter.php',
    formAction: '',
    hiddenFields: {}
  };
  const w = typeof window !== 'undefined' && window.STEH_AUF_CONFIG;
  if (!w || typeof w !== 'object') return d;

  const nl = w.cleverReach;
  if (!nl || typeof nl !== 'object') return d;

  return {
    apiUrl: String(nl.apiUrl || d.apiUrl).trim(),
    formAction: String(nl.formAction || '').trim(),
    hiddenFields: nl.hiddenFields && typeof nl.hiddenFields === 'object' ? nl.hiddenFields : {}
  };
}

function setNewsletterMessage(el, text, type) {
  if (!el) return;
  el.textContent = text;
  el.hidden = !text;
  el.classList.remove('is-error', 'is-success');
  if (type === 'error') el.classList.add('is-error');
  if (type === 'success') el.classList.add('is-success');
}

function submitViaApi(cfg, email, form, statusEl, submitBtn) {
  return fetch(cfg.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, consent: true })
  })
    .then(async res => {
      let data = {};
      try {
        data = await res.json();
      } catch (e) {
        throw new Error('Unerwartete Server-Antwort.');
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.message || 'Anmeldung fehlgeschlagen.');
      }
      return data;
    })
    .then(data => {
      form.hidden = true;
      const success = document.getElementById('newsletterSuccess');
      if (success) {
        success.hidden = false;
        const msg = success.querySelector('.newsletter-success-text');
        if (msg) msg.textContent = data.message;
      }
      setNewsletterMessage(statusEl, '', '');
    })
    .catch(err => {
      setNewsletterMessage(statusEl, err.message || 'Etwas ist schiefgelaufen.', 'error');
      submitBtn.disabled = false;
      submitBtn.removeAttribute('aria-busy');
    });
}

function submitViaFormAction(cfg, form, statusEl, submitBtn) {
  return new Promise(resolve => {
    let iframe = document.getElementById('newsletterCleverReachFrame');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'newsletterCleverReachFrame';
      iframe.name = 'newsletterCleverReachFrame';
      iframe.title = 'Newsletter-Anmeldung';
      iframe.hidden = true;
      iframe.setAttribute('aria-hidden', 'true');
      document.body.appendChild(iframe);
    }

    const onLoad = () => {
      iframe.removeEventListener('load', onLoad);
      form.hidden = true;
      const success = document.getElementById('newsletterSuccess');
      if (success) success.hidden = false;
      setNewsletterMessage(statusEl, '', '');
      submitBtn.disabled = false;
      submitBtn.removeAttribute('aria-busy');
      resolve();
    };

    iframe.addEventListener('load', onLoad);
    form.action = cfg.formAction;
    form.method = 'post';
    form.target = 'newsletterCleverReachFrame';
    form.submit();
  });
}

function initNewsletter() {
  const form = document.getElementById('newsletterForm');
  if (!form) return;

  const emailInput = form.querySelector('#newsletterEmail');
  const consentInput = form.querySelector('#newsletterConsent');
  const statusEl = document.getElementById('newsletterStatus');
  const submitBtn = form.querySelector('.newsletter-submit');
  const cfg = getNewsletterCfg();

  if (!cfg.apiUrl && !cfg.formAction) {
    setNewsletterMessage(
      statusEl,
      'Newsletter-Anmeldung wird gerade eingerichtet. Schau bald wieder vorbei!',
      'error'
    );
    if (submitBtn) submitBtn.disabled = true;
    return;
  }

  Object.entries(cfg.hiddenFields).forEach(([name, value]) => {
    let hidden = form.querySelector(`input[type="hidden"][name="${name}"]`);
    if (!hidden) {
      hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = name;
      form.appendChild(hidden);
    }
    hidden.value = String(value);
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const email = String(emailInput?.value || '').trim();
    const consent = consentInput?.checked;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setNewsletterMessage(statusEl, 'Bitte gib eine gültige E-Mail-Adresse ein.', 'error');
      emailInput?.focus();
      return;
    }

    if (!consent) {
      setNewsletterMessage(statusEl, 'Bitte stimme der Datenschutzerklärung zu.', 'error');
      consentInput?.focus();
      return;
    }

    setNewsletterMessage(statusEl, '', '');
    submitBtn.disabled = true;
    submitBtn.setAttribute('aria-busy', 'true');

    if (cfg.formAction) {
      submitViaFormAction(cfg, form, statusEl, submitBtn);
    } else {
      submitViaApi(cfg, email, form, statusEl, submitBtn);
    }
  });
}

document.addEventListener('DOMContentLoaded', initNewsletter);
