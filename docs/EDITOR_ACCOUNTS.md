# Freelance editor accounts & time tracking

How to hand an outside editor a login, what that login can reach, and how the
hours logged against a card are kept trustworthy.

---

## 1. Run the two migrations — manual, one paste each

Open **Supabase → SQL Editor → New query**, paste each file, run it:

1. `supabase/migrations/20260822000000_editor_card_scope.sql`
2. `supabase/migrations/20260822000001_edit_time_tracking.sql`

Run them in that order — the second builds on helpers the first defines. Both
are safe to run twice.

Until the first one is applied, an editor account can read every row an
authenticated account could: every production, the Rolodex, the budget, the
vault. Until the second, the Time section on a card will not save.

---

## 2. Add the editor

**Settings → Team → Add Team Member**

| Field | What to put |
| --- | --- |
| Email | Their real address. If it matches a Rolodex contact, that contact is picked for you. |
| Role | **Freelance Editor** |
| Rolodex Contact | Who they are on the board. Pick them, or leave it on *Create a new contact* and type their name. |
| Temporary Password | **Generate**, then send it to them. |

They sign in at `/command-center` and land on the Edit Tracker.

**The contact link is the whole mechanism.** Cards are assigned to a Rolodex
contact (`jobs.editor_id`), so the account can only see the cards assigned to
the contact it is linked to. Link the wrong person and they see the wrong
cards; link nobody and they see an empty board. That is why the form will not
create an editor account without it.

Linking someone who isn't listed as post crew adds *Editor* to their secondary
roles, so they show up in a card's Editor dropdown and can actually be given
work. Their primary title is left alone.

To change who an account is tied to later, use the contact dropdown on their
row in the team roster.

---

## 3. What the account can reach

Enforced by row-level security in the database, not by hiding buttons — the
anon key ships in the page bundle, so anything enforced only in the UI is
enforced not at all.

| | |
| --- | --- |
| **Sees** | Edit Tracker cards assigned to their contact. Those cards' checklists. Their own Rolodex row, their own profile and scratch pad, the board's column definitions. |
| **Can change** | Stage, notes, labels, due date, review and Drive links, creative brief and palette — on their own cards. |
| **Cannot** | See any other card, the Rolodex, clients, the budget, the vault, the calendar, the roster, or another editor's hours. Rename a production, reassign a card, cancel a job, create or delete one, or edit the studio's board columns. |

A column an editor may not write is refused outright rather than ignored, so a
UI change that starts sending the wrong field fails loudly in testing instead of
quietly in production.

---

## 4. Time on a card

Open a card → **Time**. Start and stop, or type an amount you forgot to time
("45m", "1h 30m", "90"). Staff see everyone's hours on a card; an editor sees
their own. The card face shows the total.

What makes the number worth invoicing from:

- **The database writes every timestamp.** Nothing is taken from the browser's
  clock. Moving a laptop's system time, or patching the page bundle, changes
  nothing about what gets recorded.
- **The browser cannot write time at all.** `edit_time_entries` has no insert,
  update, or delete policy. Every write goes through `/api/edits/time`, which
  takes the caller's identity from their bearer token — never from the request
  body — and checks the card is assigned to them.
- **Entries are append-only.** Once stopped, an entry cannot be re-opened,
  re-timed, backdated, or moved to another card or person. The database refuses
  it *including for the server itself*, so a bug in the route cannot rewrite
  history. A mis-started timer is deleted and re-logged, not edited.
- **One timer at a time, per person.** A unique index, not a disabled button —
  a second tab or a phone left open on another card cannot double-bill an hour.
- **Forgotten timers are capped at 12 hours** and flagged as auto-stopped, so a
  timer left running overnight reads as a truncation rather than a night's work.
- **Manual entries are marked as such** and capped at 12 hours each, so an
  invoice can tell a measured hour from a remembered one.
