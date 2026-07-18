-- An active member who can create transactions may link only their own
-- Telegram account. The link-code row still carries auth.uid(), and the bot
-- validates that same member is active before each trusted-worker operation.
drop policy if exists telegram_link_codes_owner_write on public.telegram_link_codes;
create policy telegram_link_codes_member_write on public.telegram_link_codes
for all to authenticated
using (
  user_id = auth.uid()
  and public.has_business_role(business_id, array['owner','admin','accountant','staff'])
)
with check (
  user_id = auth.uid()
  and public.has_business_role(business_id, array['owner','admin','accountant','staff'])
);
