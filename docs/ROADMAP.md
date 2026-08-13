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
- [x] ✅ **Calendar timezone correctness** — call times are wall-clock in `STUDIO_TIMEZONE`; push sends `{dateTime, timeZone}` and the pull reads Google's own offset, instead of both resolving against the UTC server clock (an 8:00 AM call landed on Google at 4:00 AM)
- [x] ✅ **Multi-day events render across their span** — Google-imported markers painted only their start day; jobs gained an End Date field in Slate
- [x] ✅ **Slate auto-populates Google Calendar** — saving a production pushes it, deleting one removes it. Previously only the Calendar tab's inline editor ever pushed
- [x] ✅ **Times on calendar markers** — a marker was date-only, so a 2 PM meeting booked on the Calendar tab covered the whole day here and pushed to Google as an all-day event; timed Google events also lost their hours on import
- [x] ✅ **Hold → Booked without retyping** — a marker can be converted into a full production, carrying its name, dates, times, and notes into Slate's form, and clearing itself once the production saves
- [x] ✅ **Secondary roles on contacts** — assigning an edit no longer requires retitling someone "Editor" and billing them as one on every call sheet; roles are offered as positions when adding crew to a sheet
- [x] ✅ **CSV import that reads real exports** — one RFC 4180 parser for both importers: BOM, semicolon/tab delimiters, quoted commas and newlines, apostrophes in names, and header variants ("Contact", "Vendor", Company fallback), with an error that names the columns it found
- [ ] **Offline / stale-cache support** — service worker caching last-viewed call sheets & gear lists for bad-signal locations
- [x] ✅ **Google sync deletion round-trip** — tombstones so deleted Google events disappear here and in-app marker deletes don't resurrect
- [ ] **Email round 2** — send attachments, drafts, Sent/Starred/Trash views, undo-send
- [ ] **Web push notifications** — call-time reminders and @mention pings to phones
- [x] ✅ **Bounded queries** — date-bound the calendar jobs fetch; paginate Rolodex (currently 1,000 contacts up front)
- [ ] **Component splitting** — Rolodex (2.2k lines), Rentals (2.2k), EditTracker (2k), Slate (1.8k): split opportunistically when touched
- [ ] **⌘K onboarding surface** — show top features in the empty search palette for new teammates
