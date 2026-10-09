-- Esquema de Halo Nutrition para Supabase (Postgres). Ejecutar en el editor SQL del proyecto, una sola vez.
-- Referencias: Row Level Security https://supabase.com/docs/guides/database/postgres/row-level-security
--              Campos del JWT (email) https://supabase.com/docs/guides/auth/jwt-fields
--              Storage y políticas    https://supabase.com/docs/guides/storage/quickstart

create extension if not exists pgcrypto;

-- ---------- Administradores ----------
-- Los correos de esta tabla ven el panel /admin/ y pueden editar productos y pedidos.
create table if not exists public.admins (
  email text primary key
);

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ---------- Productos ----------
create table if not exists public.productos (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  nombre text not null,
  categoria text not null,
  precio integer not null check (precio >= 0),
  porciones integer,
  forma text not null default 'tarro' check (forma in ('tarro', 'lata', 'shaker', 'caja')),
  presentacion text not null default '',
  resumen text not null default '',
  descripcion text not null default '',
  beneficios jsonb not null default '[]',
  datos jsonb not null default '[]',
  nutricion jsonb,
  uso text not null default '',
  palabras_clave text[] not null default '{}',
  sabores jsonb not null default '[]',
  faq jsonb not null default '[]',
  imagen_url text,
  visible boolean not null default true,
  stock integer not null default 0 check (stock >= 0),
  stock_minimo integer not null default 5 check (stock_minimo >= 0),
  orden integer not null default 0,
  actualizado timestamptz not null default now()
);

-- ---------- Pedidos ----------
create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  referencia text not null unique,
  creado timestamptz not null default now(),
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'pagado', 'preparando', 'enviado', 'entregado', 'cancelado')),
  cliente_email text,
  cliente_nombre text,
  items jsonb not null,
  subtotal integer not null,
  envio integer not null default 0,
  total integer not null,
  mp_payment_id text,
  guia text,
  notas text,
  actualizado timestamptz not null default now()
);
-- Datos de checkout (contacto, documento, dirección) y descuentos aplicados.
alter table public.pedidos add column if not exists cliente_telefono text;
alter table public.pedidos add column if not exists documento text;
alter table public.pedidos add column if not exists envio_datos jsonb;
alter table public.pedidos add column if not exists cupon text;
alter table public.pedidos add column if not exists descuento integer not null default 0;
create index if not exists pedidos_creado_idx on public.pedidos (creado desc);
create index if not exists pedidos_email_idx on public.pedidos (lower(cliente_email));

-- Fecha de actualización automática.
create or replace function public.tocar_actualizado() returns trigger language plpgsql as $$
begin new.actualizado = now(); return new; end $$;
drop trigger if exists productos_actualizado on public.productos;
create trigger productos_actualizado before update on public.productos for each row execute function public.tocar_actualizado();
drop trigger if exists pedidos_actualizado on public.pedidos;
create trigger pedidos_actualizado before update on public.pedidos for each row execute function public.tocar_actualizado();

-- Descuenta inventario al confirmarse un pago. Solo la llama el servidor (rol service_role).
create or replace function public.descontar_stock(p_items jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare it jsonb;
begin
  for it in select * from jsonb_array_elements(p_items) loop
    update public.productos
      set stock = greatest(0, stock - coalesce((it ->> 'cantidad')::int, 0))
      where slug = it ->> 'slug';
  end loop;
end $$;
revoke execute on function public.descontar_stock(jsonb) from public, anon, authenticated;
grant execute on function public.descontar_stock(jsonb) to service_role;

-- ---------- Seguridad por filas ----------
alter table public.admins enable row level security;
alter table public.productos enable row level security;
alter table public.pedidos enable row level security;

drop policy if exists "admins visibles para admins" on public.admins;
create policy "admins visibles para admins" on public.admins for select to authenticated using ((select public.es_admin()));

drop policy if exists "productos visibles" on public.productos;
create policy "productos visibles" on public.productos for select to anon, authenticated
  using (visible or (select public.es_admin()));
drop policy if exists "admin crea productos" on public.productos;
create policy "admin crea productos" on public.productos for insert to authenticated with check ((select public.es_admin()));
drop policy if exists "admin edita productos" on public.productos;
create policy "admin edita productos" on public.productos for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));
drop policy if exists "admin borra productos" on public.productos;
create policy "admin borra productos" on public.productos for delete to authenticated using ((select public.es_admin()));

-- Los pedidos los crea el servidor (service_role, que no pasa por RLS). El cliente ve los suyos; el admin, todos.
drop policy if exists "ver pedidos" on public.pedidos;
create policy "ver pedidos" on public.pedidos for select to authenticated
  using (lower(cliente_email) = lower((select auth.jwt() ->> 'email')) or (select public.es_admin()));
drop policy if exists "admin actualiza pedidos" on public.pedidos;
create policy "admin actualiza pedidos" on public.pedidos for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

-- ---------- Imágenes de productos (Storage) ----------
insert into storage.buckets (id, name, public) values ('productos', 'productos', true) on conflict (id) do nothing;
drop policy if exists "imagenes publicas" on storage.objects;
create policy "imagenes publicas" on storage.objects for select using (bucket_id = 'productos');
drop policy if exists "admin sube imagenes" on storage.objects;
create policy "admin sube imagenes" on storage.objects for insert to authenticated
  with check (bucket_id = 'productos' and (select public.es_admin()));
drop policy if exists "admin cambia imagenes" on storage.objects;
create policy "admin cambia imagenes" on storage.objects for update to authenticated
  using (bucket_id = 'productos' and (select public.es_admin()));
drop policy if exists "admin borra imagenes" on storage.objects;
create policy "admin borra imagenes" on storage.objects for delete to authenticated
  using (bucket_id = 'productos' and (select public.es_admin()));

-- ---------- Tu primer administrador ----------
-- Cambia el correo y ejecuta esta línea. Esa persona debe registrarse en /cuenta/ con ese mismo correo.
-- insert into public.admins (email) values ('tu-correo@dominio.com');
