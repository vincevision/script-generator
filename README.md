# EPIC WEAR — Coming Soon

A premium, fully static "under construction / coming soon" teaser site for the **EPIC WEAR** streetwear brand.
No framework, no build step: plain HTML, CSS and vanilla JS.

## Run locally

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

Any static host works (Netlify, Vercel, GitHub Pages, S3, …) — just upload the repository root.

## What's inside

| Path | Purpose |
| --- | --- |
| `index.html` | Page markup, inline SVG sprite (EPIC logo glyphs + icon system) |
| `assets/css/style.css` | Design system, animations, responsive + reduced-motion rules |
| `assets/js/main.js` | Loader choreography, particles, cursor, countdown, signup, reveals |
| `assets/favicon.svg`, `assets/apple-touch-icon.png` | Brand icons |
| `assets/img/` | Collection teaser imagery (WebP + JPEG fallback) and `og.jpg` share image |
| `assets/fonts/` | Self-hosted Archivo (variable weight + width) and JetBrains Mono |

## Configuration

**Launch countdown.** Set the ISO date on the countdown section in `index.html`:

```html
<section class="drop section" id="drop" data-launch="2026-10-16T18:00:00Z">
```

Leave it empty (`data-launch=""`) — or let the date pass — and the section shows **LAUNCHING SOON** instead.

**Email signups.** By default submissions are validated and stored in `localStorage` (so the flow is testable).
To send them to your backend / ESP, add an endpoint to the form — it receives a JSON `POST` of `{ "email", "source" }`:

```html
<form class="signup" id="signupForm" novalidate data-endpoint="https://your-api.example.com/waitlist">
```

**Contact & socials.** Email, phone, location and the social URLs in `index.html` are placeholders — replace them with the real ones.

## Performance & accessibility notes

- Animations use `transform`/`opacity`; canvas particles are DPR-capped and pause when the tab is hidden.
- Low-power devices (≤4 cores / ≤4 GB RAM / Save-Data) get a lighter background automatically.
- `prefers-reduced-motion` is respected: short fade-in intro, no parallax, particles or looping motion.
- Custom cursor only activates on fine pointers with hover; touch devices keep the native behaviour.
- Returning visitors in the same session get a shortened intro.
