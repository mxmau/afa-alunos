create table if not exists public.afa_students (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  class_name text,
  registration text,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.afa_students enable row level security;

drop policy if exists "AFA students are private" on public.afa_students;

create policy "AFA students are private"
on public.afa_students
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists afa_students_user_id_idx on public.afa_students(user_id);
create index if not exists afa_students_name_idx on public.afa_students(name);
