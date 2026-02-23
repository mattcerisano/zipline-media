# Zipline Media - Website Requirements & Design Document

## Project Overview
A bold, cinematic, and simple Single Page Application (SPA) for **Zipline Media**. The site bridges the gap between Broadway entertainment and Fortune 500 corporate clients with high-energy visuals and clear platform expertise.

**Core Philosophy:** "People First. Creative Always."
**Visual Style:** Dark mode, high contrast, cinematic, agency-grade.
**Current Status:** **LIVE ON VERCEL** (`zipline-media.vercel.app`)

## Tech Stack
-   **Framework:** Next.js 15+ (App Router)
-   **Styling:** Tailwind CSS 4.0
-   **Animation:** Framer Motion (Slick staggered entrances and masked text reveals)
-   **Icons:** Lucide React
-   **Fonts:** 
    -   *Hero Title:* **Montserrat** (Black/Heavy weight)
    -   *Body/Headers/Taglines:* **Lulo Clean** (Bold, Uppercase, Wide Tracking)

## Site Structure

### 1. Main Page (SPA Flow)
The experience is a continuous, tightly-paced scroll.

*   **Header (Sticky):** 
    -   Solid Black bar (`bg-black/90`) with background blur.
    -   Large Zipline Blue logo with tagline: "CREATIVE VIDEO PRODUCTION".
*   **Hero Section:**
    -   Full-screen background video (`LandingPage.mp4`).
    -   Overlay: "CURIOSITY UNLEASHED" with high-contrast gradient for readability.
    -   Slick "Masked Reveal" animation on load.
*   **Work Section (The Portals):**
    -   Three vertical 9:16 cards: **BRAND**, **PERFORMANCE**, **PODCASTS**.
    -   Videos autoplay muted on load in full color.
    -   Open Video Repository button (Zipline Blue hover effect).
*   **Trust Statement:**
    -   "HIGH DRAMA FOR BROADWAY. NO DRAMA FOR YOU." (Clever/Sexy tone).
*   **Client Ticker:**
    -   Three categorized horizontal lanes (Brand, Performance, Podcasts).
    -   Infinite scroll (30s speed) with pause-on-hover.
    -   Clean bold text representation for all clients (Qualcomm, T-Mobile, Tony Awards, etc.).
*   **About Section:**
    -   "PEOPLE FIRST. CREATIVE ALWAYS." (Centered).
    -   Process Breakdown: **01 THE BLUEPRINT**, **02 THE ACTION**, **03 THE ALCHEMY**.
*   **Contact Section:**
    -   Headline: "LET'S ROLL." (Left-aligned).
    -   Email: `CONTACT@ZIPLINE.MEDIA`.
    -   Form: Minimalist, high-contrast, Zipline Blue submit button.

### 2. The Video Repository (`/archive`)
*   **Title:** "ZIPLINE VIDEO REPOSITORY".
*   **Data:** Scraped/Integrated project list (Tony Awards series, Chase, Keke Palmer, etc.).
*   **Layout:** Chronological, manifest-style list.

## Assets
-   **Video:** `LandingPage.mp4` (Hero), `broadway-reel.mp4` (Work).
-   **Logos:** `Zipline Logo FULL Blue.png` (Hex: `#0077FF` for sub-branding).

## Future Roadmap
-   **Rentals Page & Gear List:** Technical equipment showcase.
-   **Internal Portal:** Integration of the Gear Builder and Rolodex apps.
-   **Authentication:** Multi-level permissions (Staff/Admin/Client).
-   **Deployment:** Link custom domain `zipline.media`.