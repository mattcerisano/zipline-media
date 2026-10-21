# Pilot checklist — your first week with Studio OS

You have a login and a populated app. This is what to try, in roughly the
order a real week goes, so that by Friday you know whether this is a tool your
studio would actually run on. Nothing here is a commitment; the sample data
is there to be broken.

Everything below happens in the left sidebar unless it says Settings.

## Day 1 — look around, then make it yours

- [ ] **Dashboard.** Note the amber "sample data" bar; it stays until the
      sample productions are gone. Try **Customize** (top right) to hide
      widgets you won't use.
- [ ] **Settings → Branding.** Name, logo, brand colour. The colour re-skins
      every screen at once.
- [ ] **Settings → Team.** Add one colleague as *Staff* and give them the
      temporary password. Set **Drive keepers** to the people drives come back
      to at your studio.
- [ ] **Settings → Profile.** Your name and phone, which land on call sheets,
      and the theme: light, dim or dark, per person.

## Day 2 — a real production, start to finish

- [ ] **Slate.** Open "[Sample] Harbor & Vine — spring menu launch" and read
      the card top to bottom: crew, schedule, to-dos, budget, links.
- [ ] Now **add your own**: a shoot you actually have coming up. Client (a new
      one is created on the spot), date, call time, location (with Maps set up
      it finds the nearest hospital and parking by itself).
- [ ] Add crew from the **Rolodex** or type new names in. Set call times.
- [ ] **Export the call sheet** (PDF). This is the thing crew receive; is it
      what you'd send?
- [ ] **Calendar.** Your shoot is on it. If Google is connected, it's on the
      studio Google Calendar too, with the call sheet in the description.

## Day 3 — gear, drives, the edit

- [ ] **Gear Builder.** Build a gear list for your production from the
      inventory, adding a few of your own items alongside the sample ones.
      Save it to the production and export the manifest.
- [ ] **Drive Tracker.** The sample drive is out with an editor. Mark it
      returned, add one of your real drives, check it out to someone.
- [ ] **Edit Tracker.** The wrapped sample production is on the board. Drag
      it a column along; open it and add a note and a label.
- [ ] Optional: **Settings → Team**, add an *Editor* account linked to the
      sample contact "Sam Okafor". Sign in as them in a private window and
      see what a freelance editor sees (only their cards and the drives).

## Day 4 — the rest of the office

- [ ] **Rolodex.** Import your real contacts (CSV or vCard) and see what the
      duplicate finder makes of them.
- [ ] **Inbox** (needs Google): the connected account's mail, threaded to
      productions.
- [ ] **Meeting Notes**: write one and link it to a client.
- [ ] **Vault**: put one credential in it and share it with a teammate.
- [ ] **Integrations**: send a test alert to a Discord, Slack or Teams
      channel. Subscribe your phone to the live calendar feed.
- [ ] **Search** (⌘K / Ctrl-K) for a production, a person, a feature.

## Day 5 — look at what you used, then tell us

- [ ] **Usage** (admin only, in the sidebar). Every tab opened and by whom,
      over today, 7 days or 30 days. That's your honest answer to "which parts
      of this would we keep?"
- [ ] Run `supabase/install/remove_sample_data.sql` in Supabase → SQL Editor
      if you're carrying on with real data, or leave it if you're not.
- [ ] **Send feedback.** There is no feedback button in the app; email the
      person who set this up for you, or open an issue on the GitHub
      repository your deployment was made from. Most useful, in this order:
      1. The thing you reached for that wasn't there.
      2. The thing you did that took more clicks than it should.
      3. A screenshot of anything that looked wrong, with which browser.
      4. What you'd stop using your current tool for first, if anything.

## If something doesn't work

- **Blank screens** almost always mean a missing environment variable, not a
  bug. Check Vercel → Settings → Environment Variables against
  [INSTALL_NEW_STUDIO.md](INSTALL_NEW_STUDIO.md) and redeploy.
- **"This account hasn't been added"** at sign-in: an admin adds them under
  Settings → Team, with the exact same email.
- **Google keeps disconnecting**: the consent screen is still in Testing;
  see [SETUP.md](SETUP.md) §4.
- **A tab says "run the … migration"**: your database is behind the code.
  Paste the named file from `supabase/migrations/` into the SQL editor.
