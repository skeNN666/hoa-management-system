-- Зургийг Cloudflare R2-д хадгалах: шинэ файл → r2_key (data = null).
-- Хуучин (data-тай) файлууд хэвээр ажиллана; өдөр бүрийн cron тэднийг аажмаар R2 руу зөөнө.
alter table files alter column data drop not null;
alter table files add column r2_key text;
alter table files add constraint files_has_body check (data is not null or r2_key is not null);
