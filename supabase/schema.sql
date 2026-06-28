-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Categories
create table if not exists categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  parent_id uuid references categories(id) on delete set null,
  created_at timestamptz default now()
);

-- Products
create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  sku text not null unique,
  name text not null,
  description text,
  category_id uuid references categories(id) on delete set null,
  metal_type text,
  metal_purity text,
  stone_type text,
  diamond_weight_ct numeric(10,3),
  gross_weight_g numeric(10,3),
  price_inr numeric(12,2),
  mrp_inr numeric(12,2),
  stock_qty integer not null default 1,
  is_active boolean not null default true,
  images text[] not null default '{}',
  tags text[] not null default '{}',
  is_featured boolean not null default false,
  created_at timestamptz default now()
);

-- Custom product parameter definitions
create table if not exists product_params (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  label text not null,
  field_type text not null default 'text',
  options text[],
  is_required boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

-- Row Level Security
alter table products enable row level security;
alter table categories enable row level security;
alter table product_params enable row level security;

-- Public read access (storefront)
create policy "Public read products" on products for select using (true);
create policy "Public read categories" on categories for select using (true);
create policy "Public read product_params" on product_params for select using (true);

-- Authenticated write access (admin)
create policy "Auth insert products" on products for insert with check (auth.role() = 'authenticated');
create policy "Auth update products" on products for update using (auth.role() = 'authenticated');
create policy "Auth delete products" on products for delete using (auth.role() = 'authenticated');
create policy "Auth insert categories" on categories for insert with check (auth.role() = 'authenticated');
create policy "Auth update categories" on categories for update using (auth.role() = 'authenticated');
create policy "Auth delete categories" on categories for delete using (auth.role() = 'authenticated');
create policy "Auth write product_params" on product_params for all using (auth.role() = 'authenticated');
