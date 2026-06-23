/* ============================================================
   STEH AUF COMEDY – galerie.js
   Galerie-Seite: Masonry-Grid + Lightbox
   ============================================================ */

'use strict';

// Um neue Fotos hinzuzufügen:
// 1. Foto in /assets/galerie/ ablegen
// 2. Dateinamen in /assets/galerie/index.json eintragen
//    Beispiel: ["foto1.jpg", "foto2.jpg", "neues-foto.jpg"]

// Fallback-Liste für den Fall, dass JSON nicht geladen werden kann
const GALLERY_FALLBACK = [
  "gallery1.JPG","gallery2.JPG","gallery3.JPG","gallery4.jpg","gallery5.jpg","gallery6.jpg","gallery7.jpg","gallery8.jpg","gallery9.jpg","gallery10.jpg","gallery11.jpg"
];

let galleryImages = [];
let currentIndex = 0;

// ── GALERIE LADEN ──
async function loadGallery() {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;

  try {
    const res = await fetch('assets/galerie/index.json');
    if (!res.ok) throw new Error('index.json nicht geladen');
    galleryImages = await res.json();
  } catch (e) {
    console.warn('Galerie: JSON-Fetch fehlgeschlagen, nutze Fallback-Liste', e);
    galleryImages = GALLERY_FALLBACK;
  }

  renderGallery(grid);
  initLightbox();
}

// ── GALERIE RENDERN ──
function renderGallery(grid) {
  grid.innerHTML = galleryImages.map((file, i) => `
    <div class="gallery-page-item" data-index="${i}" role="button" tabindex="0" aria-label="Foto ${i + 1} öffnen">
      <img
        src="assets/galerie/${file}"
        alt="Steh auf Comedy – Impressionen aus unseren Shows"
        loading="lazy"
        width="600"
        height="400"
      >
      <div class="gallery-page-overlay"></div>
    </div>`).join('');

  // Scroll Reveal für Gallery Items
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.05 });

    grid.querySelectorAll('.gallery-page-item').forEach((item, i) => {
      item.style.opacity = '0';
      item.style.transform = 'translateY(30px)';
      item.style.transition = `opacity 0.6s ease ${i * 0.03}s, transform 0.6s ease ${i * 0.03}s`;
      observer.observe(item);
    });
  }
}

// ── LIGHTBOX ──
function initLightbox() {
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  if (!lightbox || !lightboxImg) return;

  // Klick auf Bild
  document.getElementById('galleryGrid').addEventListener('click', e => {
    const item = e.target.closest('.gallery-page-item');
    if (!item) return;
    currentIndex = parseInt(item.dataset.index);
    openLightbox(currentIndex);
  });

  // Tastaturnavigation in der Galerie
  document.getElementById('galleryGrid').addEventListener('keydown', e => {
    const item = e.target.closest('.gallery-page-item');
    if (!item) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      currentIndex = parseInt(item.dataset.index);
      openLightbox(currentIndex);
    }
  });

  // Lightbox schließen
  document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
  document.getElementById('lightboxPrev').addEventListener('click', showPrev);
  document.getElementById('lightboxNext').addEventListener('click', showNext);

  // Klick außerhalb
  lightbox.addEventListener('click', e => {
    if (e.target === lightbox) closeLightbox();
  });

  // Tastatur
  document.addEventListener('keydown', e => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') showPrev();
    if (e.key === 'ArrowRight') showNext();
  });

  // Touch-Swipe
  let touchStartX = 0;
  lightbox.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  lightbox.addEventListener('touchend', e => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      diff > 0 ? showNext() : showPrev();
    }
  }, { passive: true });
}

function openLightbox(index) {
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');

  lightboxImg.src = `assets/galerie/${galleryImages[index]}`;
  lightboxImg.alt = `Steh auf Comedy – Impressionen aus unseren Shows – Foto ${index + 1}`;

  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('lightboxClose').focus();
}

function closeLightbox() {
  const lightbox = document.getElementById('lightbox');
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
}

function showPrev() {
  currentIndex = (currentIndex - 1 + galleryImages.length) % galleryImages.length;
  openLightbox(currentIndex);
}

function showNext() {
  currentIndex = (currentIndex + 1) % galleryImages.length;
  openLightbox(currentIndex);
}

// ── NAVIGATION & PRELOADER ──
function initPageNav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;

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

  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 60);
  }, { passive: true });

  const hamburger = document.querySelector('.nav-hamburger');
  const overlay = document.querySelector('.nav-overlay');

  if (hamburger && overlay) {
    hamburger.addEventListener('click', () => {
      const isOpen = overlay.classList.toggle('open');
      hamburger.classList.toggle('open', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    overlay.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        overlay.classList.remove('open');
        hamburger.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  initPageNav();
  loadGallery();
});
