# Zipline Media - Launch & Roadmap

## 🚀 Pre-Launch Checklist (Public Site)
- [ ] **Mobile QA:** Verify the "Master-Detail" layout on actual devices (not just simulator).
- [ ] **SEO Metadata:** Update title, description, and OG images for all pages in `layout.tsx`.
- [ ] **Favicon:** Replace the default Next.js/Vercel favicon with the Zipline logo.
- [ ] **Contact Form:** Connect the Contact form to a real backend (e.g., Formspree, EmailJS, or Next.js API route).
- [ ] **Analytics:** Add Vercel Analytics or Google Analytics to track visitors.
- [ ] **Domain:** Connect `zipline.media` to Vercel (requires DNS update).

## 🎬 Content & Assets
- [ ] **New Reel:** Edit and export a new 16:9 Company Reel to replace `broadway-reel.mp4` for the homepage modal.
- [ ] **Landing Thumbnail:** Design a high-quality thumbnail/poster frame for the main landing page video.
- [x] **Social Splash Thumbnail:** Create a dedicated splash thumbnail for social media sharing and video embeds.

## 📂 Project Structure
Your project is consolidated in:  
`~/Documents/zipline-media`

Everything is self-contained in this folder.

## 🔧 Studio OS Backlog (from July 2026 audit)
Ranked roughly by on-set impact. Items marked ✅ are done.

- [x] ✅ Replace all `alert()`/`confirm()` with in-app toasts + confirm modal (`src/components/Feedback.tsx`)
- [x] ✅ **Sync status indicator** — "last synced X min ago / ⚠️ failing" chip on Calendar + Inbox so a broken Google token is visible before someone misses a shoot
- [x] ✅ **Tighten allow-all RLS** — verified already fixed by 20260706000002 (audit grep hit superseded policies in older migration files); only the intentional public-read on jobs/inventory for the gear-share page remains
- [x] ✅ **Team-synced preferences** — move `custom_tabs_list`, active tab, scratch notes, saved gear owners from localStorage to org/profile tables (edit-stage defs show the pattern)
- [x] ✅ **Offline / stale-cache support** — the worker now caches the Supabase reads behind call sheets, gear manifests, and crew lists (allowlisted tables only — never tokens or the vault) and replays them on a dead signal, with a banner naming how old the data is. Uncovered along the way: the worker had never actually been registering in production (it waited on a `load` event that had already fired), so the PWA had been inert since it shipped.
- [x] ✅ **Google sync deletion round-trip** — tombstones so deleted Google events disappear here and in-app marker deletes don't resurrect
- [ ] **Email round 2** — send attachments, drafts, Sent/Starred/Trash views, undo-send
- [ ] **Web push notifications** — call-time reminders and @mention pings to phones
- [x] ✅ **Bounded queries** — date-bound the calendar jobs fetch; paginate Rolodex (currently 1,000 contacts up front)
- [ ] **Component splitting** — Rolodex (2.2k lines), Rentals (2.2k), EditTracker (2k), Slate (1.8k): split opportunistically when touched
- [ ] **⌘K onboarding surface** — show top features in the empty search palette for new teammates
