EXEC dbms_scheduler.CREATE_SCHEDULE(
  schedule_name   => 'dbms_test_sch_weekly_comm',
  repeat_interval => 'FREQ=WEEKLY;',
  comments        => 'This is weekly test schedule'
);
