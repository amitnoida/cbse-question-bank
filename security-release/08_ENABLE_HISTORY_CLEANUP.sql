-- Apply after the tested retention functions. This schedules completed-detail deletion only.
SELECT cron.schedule('cbse-history-retention-14-days','*/15 * * * *','SELECT public.cbse_cleanup_test_history(false);');
