# Steh auf Comedy – Website

Offizielles Repository der Website **[steh-auf.com](https://www.steh-auf.com)** – der Stand-up Comedy Show aus Freising und München.

Dieses Projekt enthält den vollständigen statischen Quellcode der Website: HTML, CSS, JavaScript und alle lokal gehosteten Medien (Bilder, Videos, Audio, PDFs). Die Seite ist bewusst ohne Build-Tool oder Framework gehalten und kann direkt auf jedem Webserver ausgeliefert werden.

---

## Inhaltsverzeichnis

- [Über das Projekt](#über-das-projekt)
- [Live-Website](#live-website)
- [Technologie-Stack](#technologie-stack)
- [Design Guide](#design-guide)
- [Projektstruktur](#projektstruktur)
- [Seitenübersicht](#seitenübersicht)
- [JavaScript-Module](#javascript-module)
- [Konfiguration](#konfiguration)
- [Externe Dienste & APIs](#externe-dienste--apis)
- [Lokale Entwicklung](#lokale-entwicklung)
- [Deployment](#deployment)
- [Inhalte pflegen](#inhalte-pflegen)
- [SEO & Barrierefreiheit](#seo--barrierefreiheit)
- [Bekannte Einschränkungen](#bekannte-einschränkungen)
- [Repository & Kontakt](#repository--kontakt)

---

## Über das Projekt

**Steh auf Comedy** ist eine monatliche Stand-up Comedy Show in Freising und München. Die Website dient als zentrale Anlaufstelle für:

- **Ticketverkauf** – Anzeige kommender Shows mit Live-Daten von Vivenu und Eventbrite
- **Open Mic** – Informationen für Comedians, die auftreten möchten
- **Firmenevents** – Landingpage für Comedy-Shows als Teamevent
- **Comedy Knigge** – Ressourcen für angehende Comedians (Video, Podcast, Infografik, Präsentation)
- **Galerie** – Impressionen aus vergangenen Shows
- **Rechtliches** – Impressum und Datenschutzerklärung

Gegründet von **Yahya Pervaiz** (Comedian & Moderator) und **Lemarr Baqai** (Veranstaltungskaufmann).

---

## Live-Website

| | |
|---|---|
| **URL** | [https://www.steh-auf.com](https://www.steh-auf.com) |
| **E-Mail** | [haha@steh-auf.com](mailto:haha@steh-auf.com) |
| **Instagram** | [@steh_auf_comedy](https://www.instagram.com/steh_auf_comedy/) |
| **Standort** | Freising, Bayern, Deutschland |

---

## Technologie-Stack

| Bereich | Technologie |
|---------|-------------|
| Markup | Semantisches HTML5 |
| Styling | Vanilla CSS (kein Preprocessor, kein Framework) |
| Logik | Vanilla JavaScript (ES6+, `'use strict'`) |
| Schriftarten | [Google Fonts](https://fonts.google.com/) – Bowlby One SC & Poppins |
| Ticket-APIs | Vivenu (Snapticket) & Eventbrite REST API |
| Build | Keiner – Dateien werden direkt ausgeliefert |
| Hosting | Statischer Webserver (z. B. Apache, Nginx, GitHub Pages) |

Es gibt **kein** `package.json`, **kein** Bundler und **keine** Abhängigkeiten, die vor dem Deployment installiert werden müssen.

---

## Design Guide

Dieser Abschnitt dokumentiert das visuelle Erscheinungsbild der Website. Alle Design-Tokens sind als CSS Custom Properties in `styles.css` definiert und gelten projektweit – auch für `firmenevents.css` und `comedy-knigge.css`.

### Markenidentität

| Aspekt | Richtlinie |
|--------|------------|
| **Stil** | Hell, modern, energiegeladen – Comedy ohne Dunkelmodus-Klischee |
| **Ton** | Authentisch, einladend, professionell mit Bühnen-Charakter |
| **Logo-Farben** | Navy `#29285b` und Magenta `#e20e7e` (aus `assets/logo.svg`) |
| **Theme Color** | `#0f0f11` (Browser-Chrome, Meta-Tag) |

Das Logo (`assets/logo.svg`) ist die visuelle Referenz für alle Markenfarben. Navy steht für Vertrauen und Professionalität, Magenta für Energie und Bühnenpräsenz.

---

### Farbpalette

#### Primärfarben

| Name | CSS-Variable | Hex | RGB | Verwendung |
|------|--------------|-----|-----|------------|
| **Magenta (Accent)** | `--accent` | `#e20e7e` | `226, 14, 126` | CTAs, Labels, Hover-Akzente, Fokus-Ring |
| **Navy** | `--navy` | `#29285b` | `41, 40, 91` | Überschriften, Navigation, Footer-Overlay |

#### Hintergründe & Flächen

| Name | CSS-Variable | Hex | Verwendung |
|------|--------------|-----|------------|
| **Hintergrund** | `--bg` | `#ffffff` | Seitenhintergrund |
| **Surface** | `--surface` | `#f8f7fc` | Sektionen, Karten-Hintergrund |
| **Surface 2** | `--surface-2` | `#f0eef8` | Verlauf-Endpunkte, Skeleton-Loader |
| **Border** | `--border` | `#e2dff0` | Rahmen, Trennlinien |

#### Textfarben

| Name | CSS-Variable | Hex | Verwendung |
|------|--------------|-----|------------|
| **Text Primary** | `--text` | `#1a1830` | Fließtext-Überschriften, starke Kontraste |
| **Text Secondary** | `--text-secondary` | `#5a5875` | Absätze, Beschreibungen |
| **Text Muted** | `--text-muted` | `#8b89a8` | Labels, Metadaten, TOC-Titel |

#### Zusatzfarben (nicht als Token)

| Farbe | Hex | Verwendung |
|-------|-----|------------|
| Weiß | `#ffffff` | Button-Text auf Accent, Dropdown-Hintergrund |
| Pink-Gradient | `#ff6bb5` | Lesefortschritts-Leiste (Comedy Knigge) |
| Transparente Overlays | `rgba(255,255,255,0.88–0.95)` | Hero-Overlays über Fotos |

#### Farbverwendung – Do's & Don'ts

**Do:**
- Magenta für primäre Aktionen (Tickets, CTAs, Section-Labels)
- Navy für Überschriften und Hover-Zustände von Buttons
- Helle Surfaces (`--surface`) für abwechselnde Sektionen
- Dezente Magenta/Navy-Gradients (`rgba` mit 4–8 % Opazität) in Hero-Bereichen

**Don't:**
- Magenta und Navy nicht als gleichwertige Flächenfarben nebeneinander ohne Weißraum
- Keine dunklen Vollflächen-Hintergründe (Ausnahme: Mobile-Nav-Overlay in Navy)
- Keine zusätzlichen Akzentfarben einführen – die Palette ist bewusst zweifarbig

---

### Typografie

#### Schriftfamilien

| Rolle | Font | CSS-Variable | Gewichte | Einsatz |
|-------|------|--------------|----------|---------|
| **Display** | [Bowlby One SC](https://fonts.google.com/specimen/Bowlby+One+SC) | `--font-display` | 400 | `h1`, `h2`, Statistiken, Hero-Headlines |
| **Body** | [Poppins](https://fonts.google.com/specimen/Poppins) | `--font-body` | 300, 400, 500, 600, 700 | Fließtext, Navigation, Buttons, `h3` |

Einbindung über Google Fonts:

```
Bowlby One SC – weight 400
Poppins – weights 300, 400, 500, 600, 700
```

#### Typografische Skala

| Element | Font | Größe | Gewicht | Letter-Spacing | Zeilenhöhe |
|---------|------|-------|---------|----------------|------------|
| `h1` | Display | `clamp(2.2rem, 6vw, 4.5rem)` | 400 | `0.02em` | `1.15` |
| `h2` | Display | `clamp(1.5rem, 3.5vw, 2.5rem)` | 400 | `0.02em` | `1.2` |
| `h3` | Body | `clamp(1.2rem, 2.5vw, 1.8rem)` | 600 | `-0.02em` | `1.2` |
| Body | Body | `clamp(1rem, 1.5vw, 1.125rem)` | 400 | normal | `1.65` |
| Absätze (`p`) | Body | inherit | 400 | normal | `1.75` |
| Section Label | Body | `0.75rem` | 600 | `0.15em` | – |
| Nav-Links | Body | `0.9rem` | 500 | normal | – |
| Buttons | Body | `1rem` | 600 | normal | – |

#### Section Labels

Kleine Kategorie-Überschriften über Sektionen:

```css
.section-label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--accent);
}
```

---

### Abstände & Layout

#### CSS Custom Properties

| Token | Wert | Verwendung |
|-------|------|------------|
| `--section-padding` | `clamp(80px, 12vw, 160px)` | Vertikaler Abstand zwischen Sektionen |
| `--container-padding` | `clamp(20px, 5vw, 60px)` | Horizontaler Innenabstand |
| `.container` max-width | `1200px` | Zentrierter Content-Bereich |

#### Border Radius

| Token | Wert | Verwendung |
|-------|------|------------|
| `--radius-sm` | `4px` | Kleine Elemente, Fokus-Ring |
| `--radius` | `8px` | Buttons, Inputs, Icon-Boxen |
| `--radius-lg` | `12px` | Karten, Dropdowns, TOC-Boxen |

#### Grid-Systeme

| Bereich | Spalten (Desktop) | Breakpoint-Umbruch |
|---------|-------------------|-------------------|
| Show-Karten | 3 Spalten | 1 Spalte ab 768px |
| Team | 2 Spalten | 1 Spalte ab 768px |
| Galerie (Masonry) | 3 Spalten | 2 ab 768px, 1 ab 480px |
| Supporter | 3 Spalten | 1 Spalte ab 1024px |
| Firmenevents-Karten | 3 Spalten | Responsive in `firmenevents.css` |
| Comedy-Knigge Layout | Sidebar 260px + Content | 1 Spalte ab 768px |

---

### Komponenten

#### Buttons

Zwei Varianten – immer mit `min-height: 52px` und `padding: 14px 28px`:

| Variante | Klasse | Normal | Hover |
|----------|--------|--------|-------|
| **Primary** | `.btn-primary` | Magenta-Füllung, weißer Text | Navy-Füllung, `translateY(-2px)` |
| **Secondary** | `.btn-secondary` | Transparent, Navy-Text, Border | Navy-Border, `translateY(-2px)` |

Nav-CTA (`.nav-cta`) ist eine kompakte Primary-Variante: `padding: 10px 20px`, `font-size: 0.875rem`, `min-height: 44px`.

#### Navigation

| Zustand | Verhalten |
|---------|-----------|
| **Default** | Fixed, transparent, Logo 76px hoch |
| **Scrolled** (`.nav.scrolled`) | Weißer Hintergrund mit `backdrop-filter: blur(20px)`, Schatten, Logo 64px |
| **Desktop** | Horizontale Links + Dropdown-Panels |
| **Mobile** (≤ 768px) | Hamburger → Vollbild-Overlay in Navy mit `clip-path`-Animation |

Dropdown-Panels: weißer Hintergrund, `border-radius: var(--radius-lg)`, Schatten `0 12px 40px rgba(navy, 0.12)`.

#### Karten

Standard-Kartenmuster (Shows, Anlässe, Team):

- Hintergrund: `--bg` oder `--surface`
- Border: `1px solid var(--border)`
- Border-Radius: `--radius-lg`
- Hover: `translateY(-4px)`, Schatten `0 12px 40px rgba(navy, 0.08)`

#### Hero-Bereiche

Hero-Sektionen nutzen ein dreischichtiges Overlay über `assets/hero.JPG`:

1. **Foto** – `background-size: cover`, `background-position: center`
2. **Gradient** – Weißer Verlauf (88–92 % Opazität) für Lesbarkeit
3. **Radial-Akzent** – Dezentes Magenta (`rgba(226, 14, 126, 0.07–0.08)`)

#### Show-Karten

- Event-Bild oben mit abgerundeten Ecken
- Datum-Badge in Accent-Farbe
- Ticket-Button: Primary wenn verfügbar, Secondary/Disabled bei Ausverkauft
- Skeleton-Loader mit Shimmer-Animation in `--surface` / `--surface-2`

#### Galerie & Lightbox

- Masonry-Layout mit CSS `columns`
- Overlay beim Hover: halbtransparente Schicht
- Lightbox: dunkler Overlay (`z-index: 8000`), Pfeile links/rechts, Esc zum Schließen

#### Comedy-Knigge – Media Hub

- Tab-Navigation für Video / Podcast / Infografik / PDF
- Lesefortschritts-Leiste oben: Gradient `accent → #ff6bb5 → navy`
- Sticky Table of Contents (Sidebar) auf Desktop

---

### Animationen & Übergänge

| Token | Wert | Verwendung |
|-------|------|------------|
| `--transition-fast` | `0.2s ease` | Hover, Farbwechsel, Fokus |
| `--transition-smooth` | `0.7s cubic-bezier(0.16, 1, 0.3, 1)` | Scroll Reveal, Karten |
| `--transition-spring` | `0.5s cubic-bezier(0.34, 1.56, 0.64, 1)` | Federnde Effekte |

**Scroll Reveal:** Elemente starten mit `opacity: 0` und `translateY(30px)`, werden per `IntersectionObserver` eingeblendet.

**Preloader:** Logo-Animation beim Seitenstart, Slide-Up beim Ausblenden (`#preloader`).

**Custom Cursor** (nur Desktop mit `pointer: fine`): Magenta-Punkt + Ring in Accent-Farbe.

**Reduced Motion:** Bei `prefers-reduced-motion: reduce` werden alle Animationen auf `0.01ms` reduziert und Scroll-Reveal deaktiviert.

---

### Schatten

| Verwendung | Wert |
|------------|------|
| Navigation (scrolled) | `0 2px 20px rgba(41, 40, 91, 0.08)` |
| Dropdown | `0 12px 40px rgba(41, 40, 91, 0.12)` |
| Karten (hover) | `0 12px 40px rgba(41, 40, 91, 0.08)` |
| Show-Karten (hover) | `0 20px 60px rgba(226, 14, 126, 0.12)` |
| Lightbox | `0 20px 60px rgba(41, 40, 91, 0.15)` |

Schatten sind stets in Navy- oder Accent-RGB definiert – nie reines Schwarz.

---

### Icons & Bilder

| Asset | Pfad | Hinweis |
|-------|------|---------|
| Logo | `assets/logo.svg` | Favicon, Nav, Footer, Preloader |
| Hero | `assets/hero.JPG` | Startseite, OG-Image, Firmenevents |
| Team | `assets/yahya.JPG`, `assets/lemarr.JPG` | Portrait-Format |
| Galerie | `assets/galerie/gallery1–11.*` | Mix aus `.JPG` und `.jpg` |
| Supporter | `assets/supporter/*.png` | Max. Breite 320px in der Darstellung |

**Bild-Richtlinien:**
- Hero und Galerie: authentische Show-Fotos, keine Stock-Bilder
- Team-Fotos: Hochformat, natürliche Beleuchtung
- Supporter-Logos: PNG mit transparentem Hintergrund
- Immer `alt`-Texte setzen; Galerie nutzt `loading="lazy"`

---

### Responsive Breakpoints

| Breakpoint | Anpassungen |
|------------|-------------|
| **≤ 1024px** | About-Grid 1 Spalte, Past-Shows 2 Spalten, Supporter 1 Spalte |
| **≤ 768px** | Hamburger-Navigation, Show-Grid 1 Spalte, Team 1 Spalte, Galerie 2 Spalten, Hero-Buttons volle Breite |
| **≤ 480px** | Galerie 1 Spalte, Cookie-Banner Buttons gestapelt |
| **≤ 375px** | Reduziertes Nav-Padding |

Mobile-First ist nicht konsequent umgesetzt – das Design ist Desktop-first mit progressiven Anpassungen. Neue Komponenten sollten `clamp()` und die bestehenden Breakpoints nutzen.

---

### Barrierefreiheit im Design

| Regel | Umsetzung |
|-------|-----------|
| **Fokus sichtbar** | `:focus-visible` mit 2px Accent-Outline, 3px Offset |
| **Kontrast** | Navy/Magenta auf Weiß erfüllen WCAG AA für Texte |
| **Touch-Targets** | Buttons min. 44–52px Höhe |
| **ARIA** | Dropdowns (`aria-expanded`), Lightbox, Media-Tabs (`aria-selected`) |
| **Safe Areas** | `env(safe-area-inset-*)` auf Mobile-Overlay und Comedy-Knigge |
| **Reduced Motion** | Vollständige Deaktivierung animierter Effekte |

---

### CSS-Dateien – Zuständigkeiten

| Datei | Geltungsbereich |
|-------|-----------------|
| `styles.css` | Globale Tokens, Navigation, Hero, Shows, Team, FAQ, Footer, Galerie, Lightbox |
| `firmenevents.css` | Hero, Anlässe-Grid, Prozess-Sektion der Firmenevents-Seite |
| `comedy-knigge.css` | TOC-Sidebar, Media-Hub, Lesefortschritt, Prose-Styling |

Neue Seiten sollten `styles.css` immer einbinden und nur seiten-spezifische Ergänzungen in einer eigenen CSS-Datei pflegen. **Design-Tokens nicht duplizieren** – immer die `:root`-Variablen aus `styles.css` verwenden.

---

## Projektstruktur

```
website-steh-auf/
├── index.html                  # Startseite (Haupt-Landingpage)
├── galerie.html                # Galerie mit Lightbox
├── impressum.html              # Impressum
├── datenschutz.html            # Datenschutzerklärung
├── styles.css                  # Globales Stylesheet
├── main.js                     # Event-Logik, Navigation, Shows, Countdown
├── galerie.js                  # Galerie-Grid & Lightbox
├── config.js                   # API-Keys (Vivenu, Eventbrite)
├── robots.txt                  # Crawler-Anweisungen
├── sitemap.xml                 # XML-Sitemap für Suchmaschinen
│
├── assets/
│   ├── logo.svg                # Logo & Favicon
│   ├── hero.JPG                # Hero-Bild (OG/Twitter)
│   ├── yahya.JPG               # Team-Foto Yahya Pervaiz
│   ├── lemarr.JPG              # Team-Foto Lemarr Baqai
│   ├── galerie/
│   │   ├── index.json          # Liste aller Galerie-Bilder
│   │   └── gallery1–11.*       # Galerie-Fotos
│   └── supporter/              # Logos der Partner & Supporter
│
├── firmenevents/
│   ├── index.html              # Landingpage Firmenevents
│   └── ../firmenevents.css     # Seitenspezifisches CSS (im Root)
│
└── comedy-knigge/
    ├── index.html              # Comedy-Knigge Ressourcen-Seite
    ├── ../comedy-knigge.css    # Seitenspezifisches CSS (im Root)
    ├── ../comedy-knigge.js     # Media-Hub Tabs & Interaktionen (im Root)
    └── assets/
        ├── erklärvideo.mp4     # Erklärvideo
        ├── podcast.m4a         # Podcast-Audio
        ├── infografik.png      # Infografik
        └── praesentation.pdf   # Präsentation als PDF
```

---

## Seitenübersicht

| Seite | Datei | Beschreibung |
|-------|-------|--------------|
| **Startseite** | `index.html` | Hero, kommende Shows, Team, Galerie-Vorschau, FAQ, Kontakt |
| **Galerie** | `galerie.html` | Vollständige Fotogalerie mit Masonry-Layout und Lightbox |
| **Firmenevents** | `firmenevents/index.html` | Angebote für Comedy-Shows als Firmenevent |
| **Comedy Knigge** | `comedy-knigge/index.html` | Ressourcen für Comedians: Video, Podcast, Infografik, PDF |
| **Impressum** | `impressum.html` | Rechtliche Angaben gemäß TMG |
| **Datenschutz** | `datenschutz.html` | Datenschutzerklärung (DSGVO) |

Alle Seiten teilen sich eine einheitliche Navigation mit Dropdown-Menüs, Mobile-Hamburger-Menü und Footer.

---

## JavaScript-Module

### `main.js` – Kernlogik der Startseite

Verantwortlich für:

- **Event-Feed** – Lädt kommende Shows von Vivenu und Eventbrite parallel
- **Show-Karten** – Rendert Termine mit Bild, Ort, Datum und Ticket-Button
- **Countdown** – Live-Countdown bis zur nächsten Show
- **„Mehr ansehen"** – Paginierte Anzeige (6 Shows Desktop / 3 Mobile)
- **Schema.org** – Dynamisches `Event`-JSON-LD für SEO
- **Navigation** – Scroll-Effekte, Dropdown, Mobile-Overlay
- **Scroll Reveal** – Einblend-Animationen per `IntersectionObserver`
- **FAQ-Akkordeon** – Aufklappbare FAQ-Einträge

**Filterlogik für Vivenu-Events:**

- Standard (`vivenuStrictFilter: false`): Alle zukünftigen Events außer solche mit „Backstage" im Text
- Strikt (`vivenuStrictFilter: true`): Nur Events mit „Steh auf", „Open Mic" + Standort-Bezug

### `galerie.js` – Galerie-Seite

- Lädt Bildliste aus `assets/galerie/index.json`
- Fallback auf hardcodierte Liste, falls JSON nicht erreichbar
- Masonry-Grid mit Lazy Loading
- Lightbox mit Tastatur (←/→/Esc) und Touch-Swipe
- Scroll-Reveal-Animationen

### `comedy-knigge.js` – Comedy-Knigge Seite

- Media-Hub mit Tabs (Video / Podcast / Infografik / PDF)
- Lightbox für die Infografik
- Navigation und Preloader

### `config.js` – Zentrale Konfiguration

Siehe Abschnitt [Konfiguration](#konfiguration).

---

## Konfiguration

Die Datei `config.js` stellt das globale Objekt `window.STEH_AUF_CONFIG` bereit:

```javascript
window.STEH_AUF_CONFIG = {
  vivenuApiKey: 'key_...',       // Vivenu/Snapticket API-Key
  eventbriteToken: '...',        // Eventbrite Personal OAuth Token
  vivenuSellerIds: [],           // Optional: Nur Events bestimmter Seller-IDs
  vivenuStrictFilter: false      // true = nur Steh-auf-relevante Events
};
```

| Option | Typ | Beschreibung |
|--------|-----|--------------|
| `vivenuApiKey` | `string` | Bearer-Token für die Vivenu Events API |
| `eventbriteToken` | `string` | OAuth-Token für die Eventbrite API v3 |
| `vivenuSellerIds` | `string[]` | Wenn gesetzt: Nur Events dieser Seller-IDs anzeigen |
| `vivenuStrictFilter` | `boolean` | Strenger Textfilter für Vivenu-Events (siehe `main.js`) |

> **Hinweis:** `config.js` wird auf der Live-Website öffentlich ausgeliefert. API-Keys sind damit im Browser sichtbar. Für Produktionsumgebungen empfiehlt sich ein serverseitiger Proxy, der die Keys schützt.

`config.js` muss **vor** `main.js` geladen werden:

```html
<script src="config.js" defer></script>
<script src="main.js" defer></script>
```

---

## Externe Dienste & APIs

Die Website ist statisch, bindet aber zur Laufzeit externe Dienste ein:

| Dienst | URL | Verwendung |
|--------|-----|------------|
| **Vivenu API** | `https://vivenu.com/api/events` | Kommende Shows & Ticket-Status |
| **Eventbrite API** | `https://www.eventbriteapi.com/v3` | Zusätzliche Event-Termine |
| **Snapticket Shop** | `https://shop.snapticket.de/` | Ticket-Kauf-Links |
| **Google Fonts** | `fonts.googleapis.com` | Schriftarten Bowlby One SC & Poppins |
| **Instagram** | `instagram.com/steh_auf_comedy` | Social-Media-Links |

Diese Dienste erfordern eine **aktive Internetverbindung**. Ohne Netzwerk werden Shows nicht geladen; alle statischen Inhalte (Texte, Bilder, Medien) funktionieren weiterhin.

---

## Lokale Entwicklung

Da kein Build-Schritt nötig ist, reicht ein lokaler Webserver. Die Seite **nicht** per `file://` öffnen – `fetch()` für Galerie und APIs funktioniert nur über HTTP.

### Option 1: MAMP (empfohlen für dieses Setup)

Das Projekt liegt unter `/Applications/MAMP/htdocs/website-steh-auf/`.

1. MAMP starten
2. Browser öffnen: [http://localhost:8888/website-steh-auf/](http://localhost:8888/website-steh-auf/)

### Option 2: Python (eingebaut auf macOS)

```bash
cd website-steh-auf
python3 -m http.server 8080
```

Dann: [http://localhost:8080](http://localhost:8080)

### Option 3: Node.js (npx)

```bash
cd website-steh-auf
npx serve .
```

### Option 4: PHP

```bash
cd website-steh-auf
php -S localhost:8080
```

---

## Deployment

Die Website kann auf jedem Server ausgeliefert werden, der statische Dateien bereitstellt.

### Apache

Dateien in das Document Root kopieren. `.htaccess` für saubere URLs ist optional – die Seite funktioniert mit den vorhandenen `.html`-Pfaden und Verzeichnis-`index.html`-Dateien.

### Nginx

```nginx
server {
    listen 80;
    server_name steh-auf.com www.steh-auf.com;
    root /var/www/website-steh-auf;
    index index.html;

    location / {
        try_files $uri $uri/ $uri.html =404;
    }
}
```

### GitHub Pages

1. Repository-Einstellungen → Pages → Source: `main` Branch, Root `/`
2. Custom Domain `www.steh-auf.com` eintragen
3. DNS-CNAME auf `<username>.github.io` setzen

> **Achtung:** Bei GitHub Pages sind Vivenu/Eventbrite-API-Aufrufe vom Browser aus möglich, sofern CORS erlaubt ist. Prüfe die API-Richtlinien der Anbieter.

### Allgemeine Checkliste vor dem Go-Live

- [ ] `config.js` mit gültigen API-Keys befüllt
- [ ] `sitemap.xml` und `robots.txt` auf die Produktions-Domain zeigen
- [ ] Canonical-URLs und OG-Tags in den HTML-Dateien geprüft
- [ ] HTTPS aktiviert
- [ ] Große Medien (Video ~MB, PDF ~28 MB) – ggf. CDN oder Kompression prüfen

---

## Inhalte pflegen

### Neue Galerie-Fotos hinzufügen

1. Bilddatei in `assets/galerie/` ablegen (z. B. `gallery12.jpg`)
2. Dateiname in `assets/galerie/index.json` eintragen:

```json
[
  "gallery1.JPG",
  "gallery2.JPG",
  ...
  "gallery12.jpg"
]
```

3. Optional: denselben Eintrag in `GALLERY_FALLBACK` in `galerie.js` ergänzen

### Neue Show-Termine

Shows werden **automatisch** über Vivenu und Eventbrite geladen. Manuelle Pflege in HTML ist nicht nötig, solange die APIs korrekt konfiguriert sind.

### Texte & Inhalte ändern

Inhalte liegen direkt in den jeweiligen `.html`-Dateien. Es gibt kein CMS – Änderungen werden per Editor vorgenommen und committed.

### Comedy-Knigge Medien aktualisieren

Medien liegen in `comedy-knigge/assets/`:

| Datei | Format | Beschreibung |
|-------|--------|--------------|
| `erklärvideo.mp4` | Video | Erklärvideo für Comedians |
| `podcast.m4a` | Audio | Podcast-Episode |
| `infografik.png` | Bild | Comedy-Knigge Infografik |
| `praesentation.pdf` | PDF | Präsentation zum Download |

Nach dem Austausch einer Datei den Browser-Cache leeren oder einen Cache-Busting-Query-String anhängen.

---

## SEO & Barrierefreiheit

Die Website ist für Suchmaschinen und Social Media optimiert:

- **Structured Data (JSON-LD):** `ComedyClub`, `FAQPage`, `Event`, `BreadcrumbList`, `WebSite`
- **Open Graph & Twitter Cards** auf allen Hauptseiten
- **Canonical URLs** und `meta robots`
- **XML-Sitemap** (`sitemap.xml`) mit 6 URLs
- **Semantisches HTML** mit ARIA-Attributen (Dropdowns, Lightbox, Tabs)
- **Alt-Texte** auf Bildern
- **Tastaturnavigation** in Galerie-Lightbox und Navigation
- **Lazy Loading** für Galerie-Bilder (`loading="lazy"`)
- **Google Site Verification** und Facebook Domain Verification im `<head>`

---

## Bekannte Einschränkungen

| Thema | Details |
|-------|---------|
| **API-Keys im Frontend** | `config.js` ist öffentlich einsehbar |
| **Externe Abhängigkeiten** | Shows und Schriftarten benötigen Internet |
| **Toter PDF-Link** | `comedy-knigge/index.html` verweist auf `/site/assets/files/2055/comedy-knigge.pdf` (404 auf dem Server). Lokale Alternative: `comedy-knigge/assets/praesentation.pdf` |
| **Kein CMS** | Alle Inhalte werden manuell in HTML/JSON gepflegt |
| **Große Dateien** | Video, Audio und PDF erhöhen die Repository-Größe (~107 MB+) |

---

## Repository & Kontakt

| | |
|---|---|
| **Repository** | [github.com/yahyajohnny/website-steh-auf](https://github.com/yahyajohnny/website-steh-auf) |
| **Live-Website** | [www.steh-auf.com](https://www.steh-auf.com) |
| **E-Mail** | [haha@steh-auf.com](mailto:haha@steh-auf.com) |
| **Instagram** | [@steh_auf_comedy](https://www.instagram.com/steh_auf_comedy/) |

---

*Stand-up Comedy aus Freising – authentisch, laut und live.*
