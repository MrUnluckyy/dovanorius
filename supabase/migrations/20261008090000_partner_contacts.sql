-- Who to talk to about a partner. Most partners are set up by Noriuto staff
-- and their owner never joins the panel, so partner_users cannot answer this.
-- Nullable and additive: the mobile app (same database) does not read it.
-- Readable only through the existing "partner members can read" policy.
alter table public.partners
  add column if not exists contact_name text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text;
