/**
 * Renders the signed-in app without a login, a database, or any credential.
 *
 * Why this exists: every authenticated screen in Studio OS was, until now,
 * unreviewable by anything but a human with an account. Layout regressions —
 * a clipped label, a control that outgrew its box, a stranded filter pill —
 * shipped and were found by screenshot. This makes them findable by machine.
 *
 * How it works. The app reaches Supabase two ways and both are interceptable:
 *
 *   1. `supabase.auth.getSession()` reads a session object out of localStorage
 *      under `sb-<project-ref>-auth-token`. Point NEXT_PUBLIC_SUPABASE_URL at a
 *      host that does not exist, seed that key, and the app believes it is
 *      signed in.
 *   2. `supabase.from(table)` issues plain HTTP to `<url>/rest/v1/<table>`.
 *      Playwright fulfils those from scripts/ui-harness/fixtures.ts.
 *
 * Nothing here can reach the real project: the configured host is fake, and any
 * request that escapes the router is failed rather than allowed out.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=https://harness.supabase.co \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=harness \
 *   npx next build && npx next start -p 3200
 *   npx tsx scripts/ui-harness/harness.mts --port 3200 --out /tmp/shots
 *
 * Exit code is non-zero if any screen clips text or overflows horizontally,
 * so this can gate a pull request.
 */
import { chromium, type Page, type Browser } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { TABLES } from './fixtures';

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};

const PORT = arg('port', '3200');
const OUT = arg('out', 'ui-harness-shots');
const BASE = `http://localhost:${PORT}`;
const SUPABASE_HOST = 'harness.supabase.co';
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/** Far-future so supabase-js never tries to refresh against a host that isn't there. */
const SESSION = {
  access_token: 'harness-access-token',
  refresh_token: 'harness-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
  user: {
    id: 'harness-user',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'harness@zipline.local',
    app_metadata: { provider: 'email' },
    user_metadata: { full_name: 'Harness User' },
    created_at: new Date().toISOString(),
  },
};

/** PostgREST returns a bare array; `.single()` sends an Accept asking for one object. */
function respondFor(url: URL, headers: Record<string, string>) {
  const table = url.pathname.replace('/rest/v1/', '').split('?')[0];
  const rows = TABLES[table];
  if (!rows) return { status: 404, body: { message: `harness: no fixture for "${table}"` } };

  // Honour the eq filters the app uses most, so per-job screens get their own rows.
  let out = rows as Record<string, unknown>[];
  for (const [key, raw] of url.searchParams) {
    if (['select', 'order', 'limit', 'offset'].includes(key)) continue;
    const m = /^eq\.(.*)$/.exec(raw);
    if (m) out = out.filter(r => String(r[key] ?? '') === m[1]);
  }

  const wantsOne = (headers['accept'] || '').includes('vnd.pgrst.object');
  return { status: 200, body: wantsOne ? (out[0] ?? null) : out };
}

async function install(page: Page) {
  // tsx compiles this file with esbuild's keepNames, which wraps named
  // functions in a `__name(...)` helper. Playwright ships the *source* of an
  // evaluated function to the browser, where that helper does not exist, so
  // any page.evaluate containing a named inner function throws
  // "__name is not defined". Providing an identity stub is the least invasive
  // fix; the alternative is writing every audit as one anonymous expression.
  await page.addInitScript(() => {
    (globalThis as unknown as Record<string, unknown>).__name ??= (fn: unknown) => fn;
  });

  await page.addInitScript(
    ([host, session]) => {
      // supabase-js derives the storage key from the project ref, the first
      // label of the host.
      const ref = (host as string).split('.')[0];
      localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session));
      // Skip the first-run tutorial, which otherwise covers the whole
      // workspace behind a modal — the screens under it are the point.
      localStorage.setItem('studio_seen_quickstart', 'true');
    },
    [SUPABASE_HOST, SESSION] as const,
  );

  // One handler for everything, deliberately. Playwright matches routes
  // newest-registered-first and `route.continue()` performs the request rather
  // than falling through to another handler — so a general '**' rule added
  // after a specific one silently swallows it. That is what made the first run
  // of this harness sit on the loading spinner: every fixture request was
  // continued to a host that does not exist.
  await page.route('**', async route => {
    const url = new URL(route.request().url());

    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return route.continue();

    if (url.hostname === SUPABASE_HOST) {
      if (url.pathname.startsWith('/rest/v1/')) {
        const { status, body } = respondFor(url, route.request().headers());
        return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      }
      if (url.pathname.startsWith('/auth/v1/')) {
        const body = url.pathname.endsWith('/user') ? SESSION.user : SESSION;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      }
      return route.abort(); // realtime / storage: the UI degrades without them
    }

    // Any other host is a bug in this harness, not traffic to allow out.
    return route.abort();
  });
}

/** Everything a layout regression looks like, measured rather than eyeballed. */
async function audit(page: Page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    const inScroller = (el: Element) => {
      for (let a = el.parentElement; a; a = a.parentElement) {
        const ox = getComputedStyle(a).overflowX;
        if (ox === 'auto' || ox === 'scroll') return true;
      }
      return false;
    };
    const clipped: string[] = [];
    for (const el of Array.from(document.querySelectorAll('*'))) {
      const hasText = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent!.trim());
      if (!hasText) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (inScroller(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.textOverflow === 'ellipsis' || /line-clamp/.test((el.className || '').toString())) continue;
      const over = el.scrollWidth - el.clientWidth;
      if (over > 2) clipped.push(`${el.tagName.toLowerCase()} +${over}px "${el.textContent!.trim().slice(0, 34)}"`);
    }
    const tiny = new Set<string>();
    for (const el of Array.from(document.querySelectorAll('*'))) {
      const hasText = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent!.trim());
      if (!hasText) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs && fs < 11) tiny.add(`${fs}px "${el.textContent!.trim().slice(0, 24)}"`);
    }
    return { clipped, tiny: Array.from(tiny), pageOverflow: de.scrollWidth - de.clientWidth };
  });
}

/**
 * Panels are reached by clicking the sidebar rather than by URL — Studio OS
 * keeps them all under /command-center. `nav` is the visible label to click.
 */
const SCREENS: { name: string; path: string; nav?: string }[] = [
  { name: 'dashboard', path: '/command-center' },
  { name: 'slate', path: '/command-center', nav: 'Slate' },
  { name: 'edit-tracker', path: '/command-center', nav: 'Edit Tracker' },
  { name: 'rolodex', path: '/command-center', nav: 'Rolodex' },
  { name: 'library', path: '/command-center', nav: 'Library' },
  { name: 'inbox', path: '/command-center', nav: 'Inbox' },
];
const WIDTHS = [390, 768, 1440];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser: Browser = await chromium.launch({ executablePath: CHROME });
  const findings: string[] = [];

  for (const screen of SCREENS) {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      await install(page);
      try {
        await page.goto(BASE + screen.path, { waitUntil: 'domcontentloaded', timeout: 30000 });
      } catch {
        findings.push(`${screen.name} @${width}: navigation failed`);
        await ctx.close();
        continue;
      }
      // A page still spinning has no layout to audit, and would otherwise be
      // reported as "clean" — which is exactly how the first version of this
      // harness passed on a loading screen. Require real content first.
      const ready = await page
        .waitForFunction(
          () => document.body.innerText.replace(/\s+/g, ' ').trim().length > 120,
          undefined,
          { timeout: 20000 },
        )
        .then(() => true)
        .catch(() => false);
      if (!ready) {
        findings.push(`${screen.name} @${width}: never finished loading — no content to audit`);
        await page.screenshot({ path: `${OUT}/${screen.name}-${width}-STUCK.png` });
        await ctx.close();
        continue;
      }
      if (screen.nav) {
        // On a phone the sidebar is behind a menu button; open it if present.
        const menu = page.getByRole('button', { name: 'Open navigation' }).first();
        if (await menu.isVisible().catch(() => false)) {
          await menu.click().catch(() => {});
          await page.waitForTimeout(400);
        }
        const item = page.getByRole('button', { name: screen.nav, exact: true })
          .or(page.getByText(screen.nav, { exact: true })).first();
        try {
          await item.click({ timeout: 8000 });
        } catch {
          findings.push(`${screen.name} @${width}: could not reach "${screen.nav}" in the sidebar`);
          await page.screenshot({ path: `${OUT}/${screen.name}-${width}-NAV-FAILED.png` });
          await ctx.close();
          continue;
        }
        await page.waitForTimeout(2500);
      }

      await page.waitForTimeout(1500);
      const r = await audit(page);
      const shot = `${OUT}/${screen.name}-${width}.png`;
      await page.screenshot({ path: shot, fullPage: false });
      const issues = [
        ...r.clipped.map(c => `clipped: ${c}`),
        ...(r.pageOverflow > 2 ? [`page overflows by ${r.pageOverflow}px`] : []),
        // Sub-11px type is deliberate from md up — that is what the
        // `text-[11px] md:text-[9px]` pattern exists to express. On a phone the
        // agreed floor is 10px (see src/lib/text-size.test.ts, which fails the
        // build on single-digit sizes). Anything smaller is a defect; the 10px
        // labels are a known open design question, counted but not failed, so
        // this can gate a PR without flagging 365 pre-existing labels.
        ...(width < 768
          ? r.tiny.filter(t => parseFloat(t) < 10).map(t => `text under 10px on a phone: ${t}`)
          : []),
      ];
      if (width < 768) {
        const tenPx = r.tiny.filter(t => parseFloat(t) === 10).length;
        if (tenPx) console.log(`    note: ${tenPx} label(s) at 10px on a phone (known open question, not failed)`);
      }
      issues.forEach(i => findings.push(`${screen.name} @${width}: ${i}`));
      console.log(`${screen.name} @${width}px  ${issues.length ? `${issues.length} issue(s)` : 'clean'}  → ${shot}`);
      await ctx.close();
    }
  }

  await browser.close();
  writeFileSync(`${OUT}/report.txt`, findings.join('\n') || 'clean\n');
  if (findings.length) {
    console.log(`\n${findings.length} finding(s):`);
    findings.forEach(f => console.log('  ! ' + f));
    process.exit(1);
  }
  console.log('\nNo layout findings.');
}

main();
