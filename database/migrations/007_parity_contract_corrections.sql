begin;

update tickets
set status = case status
  when 'Open' then 'Todo'
  when 'In Review' then 'In Progress'
  when 'Rejected' then 'Todo'
  else status
end
where status in ('Open', 'In Review', 'Rejected');

update tickets set priority = 'High' where priority = 'Urgent';
update tasks set status = 'On Progress' where status = 'In Progress';
update tasks set priority = 'High' where priority = 'Urgent';
update tasks set phase = 'Hari H' where phase = 'Event Day';
update products set status = 'Live' where status = 'Active';
update content_evaluations set format = 'Reel' where format = 'Reels';
update content_evaluations set format = 'Feed Photo' where format = 'Single Image';
update buyers
set status = replace(status, 'Sudah convert - ', 'Sudah convert — ')
where status like 'Sudah convert - %';

commit;
