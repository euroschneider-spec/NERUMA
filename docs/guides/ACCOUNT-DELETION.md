# Deleting an account: the administrator's steps

Why it works this way: `docs/planning/DECISIONS.md`, "Deleting an account deletes everything, after 30 days". What is stored where:
`docs/guides/PERSONAL-DATA.md`. Everything below is on the page **Account deletions** (`/en/admin/deletions`), which only platform
administrators can open, with two-factor.

## How a deletion goes

1. **It starts**, either because the person pressed *Delete my account* on their account page (with their password and two-factor
   code), or because you started it for someone who wrote in (below).
2. **At once:** the account is locked (no sign-in; nothing it can read or change), the guides whose live version the person
   published go down, and an organisation they owned **alone** is hidden. Its QR codes say the guide isn't available.
3. **Within 30 days** you can **Restore** it, if the person changes their mind. Everything comes back as it was.
4. **After 30 days** the entry says *Due: can be erased now*. **Erase now** deletes everything about the person: sign-in, two-factor,
   remembered devices, request, documents, review history, acceptance record, the guide versions they published, their name in
   the change history. Problem reports they sent stay, marked *Sender's account deleted*; you can delete those by hand on the
   *Problem reports* page.
5. **A hidden organisation** has its own 30 days. When it is due, **Erase organisation** deletes its guides, steps and photos. Its
   places keep their addresses and QR codes, which keep saying the guide isn't available.
   **If it pays for a plan, cancel its subscription in Stripe first** (`docs/guides/PAYMENTS.md`, section 6): erasing doesn't stop Stripe
   charging.

Nothing runs by itself: an erase happens only when an administrator presses the button. Check the page once a week.

## Someone writes in asking to be deleted

1. **Check it is them.** The request must come from the account's own email address. Reply to that address (not to another one the
   message gives) and ask them to confirm. For an organisation owner, also confirm with the organisation through a contact you
   found yourself (official website or registry), as for a lost phone (`TWO-FACTOR.md`).
2. **Start the deletion:** *Start a deletion for someone who wrote in* → their account email → *Start deletion* → confirm.
3. **Send them their data:** on their entry, *Download their data* gives you a ZIP: a letter in their language, all their data in
   `data.json`, their documents and the photos of an organisation they owned alone. Send it to the account's email address, with
   the date it will be deleted (shown on the entry). Until NERUMA has an email provider (TECH-TASKS §4) this is done by hand.
4. Write down who asked, when, and how you checked, with your other review notes.

## Someone changes their mind

Within the 30 days: their entry → **Restore** → confirm. Tell them they can sign in again. After 30 days a restore is refused; if the
erase hasn't happened yet, ask the owner what to do.

## A colleague wants the organisation

While the organisation is hidden (30 days), it can be handed to a verified colleague. That is the next step of this work
(`docs/briefs/2026-10-13-delete-account.md`) and not built yet: until then, don't erase a hidden organisation someone has asked for.

## If something goes wrong

- *Erase now* removes the files first, then the database. If it stops halfway (a network error), the entry stays; press it again.
- The database refuses any erase before the date, by anyone but a platform administrator, or while a file remains.
