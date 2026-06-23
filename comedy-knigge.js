'use strict';

document.addEventListener('DOMContentLoaded', () => {

  /* ============================================================
     MEDIA HUB – Format-Tabs
     ============================================================ */
  const tabs = document.querySelectorAll('.media-tab');
  const panels = document.querySelectorAll('.media-panel');

  if (tabs.length && panels.length) {
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.getAttribute('aria-controls');

        // Tabs updaten
        tabs.forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');

        // Panels umschalten
        panels.forEach(panel => {
          if (panel.id === target) {
            panel.removeAttribute('hidden');
            panel.classList.add('active');
          } else {
            panel.setAttribute('hidden', '');
            panel.classList.remove('active');
          }
        });
      });

      // Keyboard-Navigation (Pfeiltasten)
      tab.addEventListener('keydown', e => {
        const tabArr = Array.from(tabs);
        const idx = tabArr.indexOf(tab);
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          tabArr[(idx + 1) % tabArr.length].focus();
          tabArr[(idx + 1) % tabArr.length].click();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          tabArr[(idx - 1 + tabArr.length) % tabArr.length].focus();
          tabArr[(idx - 1 + tabArr.length) % tabArr.length].click();
        }
      });
    });
  }

  /* ============================================================
     INFOGRAFIK – Lightbox
     ============================================================ */
  const lightbox = document.getElementById('infografikLightbox');
  const zoomBtn = document.querySelector('.infografik-zoom-btn');
  const closeBtn = document.querySelector('.lightbox-close');
  const infografikImg = document.querySelector('.knigge-infografik');

  function openLightbox() {
    if (!lightbox) return;
    lightbox.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    closeBtn && closeBtn.focus();
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.setAttribute('hidden', '');
    document.body.style.overflow = '';
    zoomBtn && zoomBtn.focus();
  }

  if (zoomBtn) zoomBtn.addEventListener('click', openLightbox);
  if (infografikImg) infografikImg.addEventListener('click', openLightbox);
  if (closeBtn) closeBtn.addEventListener('click', closeLightbox);

  if (lightbox) {
    lightbox.addEventListener('click', e => {
      if (e.target === lightbox) closeLightbox();
    });
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && lightbox && !lightbox.hasAttribute('hidden')) {
      closeLightbox();
    }
  });


  /* ============================================================
     LESEFORTSCHRITTS-LEISTE
     ============================================================ */
  const progressFill = document.getElementById('readingProgressFill');

  if (progressFill) {
    const updateProgress = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0;
      progressFill.style.width = pct + '%';
    };
    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
  }

  const tocDetails = document.getElementById('kniggeTocDetails');
  if (tocDetails) {
    const mq = window.matchMedia('(min-width: 1025px)');
    const syncToc = () => {
      tocDetails.open = mq.matches;
    };
    syncToc();
    mq.addEventListener('change', syncToc);
    tocDetails.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', () => {
        if (!mq.matches) tocDetails.open = false;
      });
    });
  }

  const navDropdownItems = document.querySelectorAll('.nav-has-dropdown');
  let navCloseTimer = null;
  navDropdownItems.forEach(item => {
    const trigger = item.querySelector('.nav-dropdown-trigger');
    if (!trigger) return;

    item.addEventListener('mouseenter', () => {
      if (navCloseTimer) {
        clearTimeout(navCloseTimer);
        navCloseTimer = null;
      }
      navDropdownItems.forEach(other => {
        if (other !== item) {
          other.classList.remove('open');
          other.querySelector('.nav-dropdown-trigger')?.setAttribute('aria-expanded', 'false');
        }
      });
      item.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
    });

    item.addEventListener('mouseleave', () => {
      navCloseTimer = setTimeout(() => {
        item.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
      }, 180);
    });

    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = item.classList.contains('open');
      navDropdownItems.forEach(other => {
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
    navDropdownItems.forEach(item => {
      item.classList.remove('open');
      item.querySelector('.nav-dropdown-trigger')?.setAttribute('aria-expanded', 'false');
    });
  });

  const nav = document.querySelector('.nav');
  if (nav) {
    window.addEventListener(
      'scroll',
      () => {
        nav.classList.toggle('scrolled', window.scrollY > 60);
      },
      { passive: true }
    );
  }

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
});
