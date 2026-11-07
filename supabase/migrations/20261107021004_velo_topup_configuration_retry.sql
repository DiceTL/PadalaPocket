drop index public.velo_one_open_topup;
-- A mismatched session is never payable through this application. Keep it as evidence,
-- but permit a fresh explicit checkout after the project receiver is corrected.
create unique index velo_one_open_topup on public.velo_topups(parent_id) where status not in ('paid','failed','expired','cancelled','configuration_required');
