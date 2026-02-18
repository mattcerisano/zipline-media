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
- [ ] **Social Splash Thumbnail:** Create a dedicated splash thumbnail for social media sharing and video embeds.

## 🛠 Internal Crew Portal (`/crew`) Roadmap
- [ ] **Authentication:** Replace hardcoded `admin`/`zipline` with a real database auth (e.g., Supabase + NextAuth) for multi-user accounts.
- [ ] **Database Integration:** Move `contacts.ts` and `inventory.ts` to a real database (Postgres/Supabase) so edits persist permanently.
- [ ] **Calendar:** Build out the "Production Calendar" tab (currently a placeholder).
- [ ] **PDF Styling:** Refine the PDF export style for Call Sheets to match the new "cinematic" brand.
- [ ] **Gear Check-In/Out:** Add logic to track who has what gear (inventory management).

## 📂 Project Structure
Your project is consolidated in:  
`~/Documents/zipline-media`

Everything is self-contained in this folder.
