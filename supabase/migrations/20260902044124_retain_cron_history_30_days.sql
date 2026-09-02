delete from cron.job_run_details
where start_time < now() - interval '30 days';

do $$
begin
  if exists (select 1 from cron.job where jobname = 'cleanup-cron-job-run-details') then
    perform cron.unschedule('cleanup-cron-job-run-details');
  end if;

  perform cron.schedule(
    'cleanup-cron-job-run-details',
    '30 5 * * *',
    $command$delete from cron.job_run_details where start_time < now() - interval '30 days';$command$
  );
end
$$;
