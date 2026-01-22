# Zipline Media - Website Requirements & Design Document

## Project Overview
A bold, cinematic, and simple Single Page Application (SPA) for **Zipline Media**, a video production company bridging the gap between Broadway entertainment and Fortune 500 corporate clients.

**Core Philosophy:** "People First. Creative Always."
**Visual Style:** Dark mode, high contrast, cinematic, agency-grade.

## Tech Stack
-   **Framework:** Next.js (App Router)
-   **Styling:** Tailwind CSS
-   **Animation:** Framer Motion
-   **Icons:** Lucide React
-   **Fonts:** 
    -   *Hero Title:* **Montserrat** (Black/Heavy weight)
    -   *Body/Headers:* **Lulo Clean** (Bold, Uppercase, Tracking-wide)

## Site Structure

### 1. Main Page (SPA Flow)
The main experience is a continuous scroll, tightly paced with minimal dead space.

*   **Hero Section:**
    *   Full-screen background video (`broadway-reel.mp4`).
    *   Overlay: "CURIOSITY UNLEASHED" in massive white text (Montserrat).
    *   Classic cinematic look (white text over video, no knockout effects).
    
*   **Work Section:**
    *   **Layout:** 2-column grid.
    *   **Content:** Mixed portfolio (Broadway & Corporate side-by-side). No category tabs/filters (Unified Brand).
    *   **Interaction:** Videos autoplay muted on load (color).
    *   **Titles:** Broad categories (e.g., "PERFORMANCE & NARRATIVE", "BRAND & CORPORATE"). No "high impact" subtitles.

*   **Platform Expertise:**
    *   Integrated into the About flow.
    *   **Message:** "Any Screen. Any Format."
    *   **Visuals:** 9:16, 16:9, 1:1 outlines.
    *   **Philosophy:** "We shoot with the destination in mind."

*   **Clients:**
    *   Infinite scrolling horizontal ticker of client names/logos.

*   **About Section:**
    *   **Heading:** "PEOPLE FIRST. CREATIVE ALWAYS." (Centered, single line).
    *   **Layout:** Centered text block.
    *   **Process:** 3-column grid with icons (Lightbulb, Clapperboard, Wand).
    *   **Tone:** "We are smart, adaptable, and innovative... We add spice to taste."

*   **Contact Section:**
    *   **Headline:** "LET'S ROLL."
    *   **Layout:** Vertical stack (Text centered above Form) or split 50/50 on large screens.
    *   **Details:** `CONTACT@ZIPLINE.MEDIA`, New York, NY.
    *   **Form:** Name, Email, Project Type, Message. Minimalist styling.

### 2. The Archive (`/archive`)
A separate page for the deep dive.
*   **Title:** "ZIPLINE VIDEO REPOSITORY".
*   **Concept:** A massive, text-heavy list of all past jobs.
*   **Layout:** Chronological list (Year | Client | Project | Type).
*   **Interaction:** Hover effects to highlight rows.
*   **Access:** Linked via "OPEN VIDEO REPOSITORY" button at the bottom of the Work section.

## User Preferences & Learnings
*   **Spacing:** Tight vertical spacing (`py-24` or less). Avoid "dead space".
*   **Brand Voice:** 
    *   Avoid silos: Do not explicitly separate Broadway from Corporate; show versatility.
    *   Confident: Use "Repository", "Let's Roll", "Unleashed".
*   **Video:** Autoplay is preferred over hover-to-play. Full color is preferred over grayscale.
*   **Navigation:** Navbar links anchor to sections (`#work`) but must work from external pages (`/#work`).

## Assets
*   **Video:** `broadway-reel.mp4` (used for Hero and Broadway project).
*   **Fonts:** Custom font files located in `public/lulo-clean`.
*   **Logos:** Zipline "Z" (10x10) and Full Blue Logo.

## Future Roadmap (Long-Term Ecosystem)
*   **Rentals Page:** A public-facing catalog for equipment rental.
*   **Gear List:** A technical showcase of the studio's inventory.
*   **Internal Tools Integration:**
    *   **Gear Builder App:** Integrate existing scaffolding for building equipment lists.
    *   **Rolodex App:** Integrate contact/CRM management tools.
    *   **Architecture:** Combine these apps into the main site behind a robust authentication system (User/Staff/Admin permissions), creating a unified operations hub.
