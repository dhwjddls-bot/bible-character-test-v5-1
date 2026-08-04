-- V5.2: 결과 인물 12명에서 100명으로 확장
create table if not exists public.character_catalog (
  id text primary key,
  active boolean not null default true,
  catalog_version text not null default 'v5.2-100'
);

insert into public.character_catalog (id) values
  ('david'),('moses'),('joseph'),('esther'),('peter'),('paul'),('ruth'),('nehemiah'),('daniel'),('jeremiah'),('mary'),('martha'),
  ('adam'),('eve'),('noah'),('abraham'),('sarah'),('hagar'),('isaac'),('rebekah'),('jacob'),('leah'),('rachel'),('judah'),
  ('tamar_genesis'),('aaron'),('miriam'),('jochebed'),('jethro'),('bezalel'),('joshua'),('caleb'),('rahab'),('deborah'),('gideon'),('samson'),
  ('naomi'),('boaz'),('hannah'),('samuel'),('saul'),('jonathan'),('abigail'),('mephibosheth'),('nathan'),('solomon'),('elijah'),('widow_zarephath'),
  ('micaiah'),('elisha'),('shunammite_woman'),('naaman'),('huldah'),('hezekiah'),('josiah'),('job'),('jonah'),('amos'),('isaiah'),('ebed_melech'),
  ('ezekiel'),('mordecai'),('ezra'),('habakkuk'),('zechariah_priest'),('elizabeth'),('mary_mother'),('joseph_nazareth'),('simeon'),('anna_prophetess'),('john_baptist'),('andrew'),
  ('james_zebedee'),('john_zebedee'),('thomas'),('nathanael'),('mary_magdalene'),('joanna'),('samaritan_woman'),('nicodemus'),('zacchaeus'),('bartimaeus'),('joseph_arimathea'),('stephen'),
  ('philip_evangelist'),('ethiopian_eunuch'),('cornelius'),('ananias_damascus'),('barnabas'),('silas'),('john_mark'),('timothy'),('lydia'),('priscilla'),('aquila'),('apollos'),
  ('phoebe'),('tabitha'),('onesimus'),('epaphroditus')
on conflict (id) do update set active = true, catalog_version = excluded.catalog_version;

revoke all on table public.character_catalog from anon, authenticated;

alter table public.test_results drop constraint if exists test_results_character_contract;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'test_results_primary_character_fkey') then
    alter table public.test_results add constraint test_results_primary_character_fkey foreign key (primary_character) references public.character_catalog(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'test_results_second_character_fkey') then
    alter table public.test_results add constraint test_results_second_character_fkey foreign key (second_character) references public.character_catalog(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'test_results_third_character_fkey') then
    alter table public.test_results add constraint test_results_third_character_fkey foreign key (third_character) references public.character_catalog(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'test_results_character_distinctness') then
    alter table public.test_results add constraint test_results_character_distinctness check (
      second_character is not null and second_score is not null
      and third_character is not null and third_score is not null
      and primary_character <> second_character
      and primary_character <> third_character
      and second_character <> third_character
    );
  end if;
end
$$;
