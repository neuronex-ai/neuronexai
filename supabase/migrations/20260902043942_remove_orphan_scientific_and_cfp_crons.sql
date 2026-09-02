do $$
begin
  if exists (select 1 from cron.job where jobname = 'daily-scientific-updates') then
    perform cron.unschedule('daily-scientific-updates');
  end if;

  if exists (select 1 from cron.job where jobname = 'daily-cfp-sync') then
    perform cron.unschedule('daily-cfp-sync');
  end if;
end
$$;
