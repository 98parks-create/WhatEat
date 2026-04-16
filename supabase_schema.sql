-- 식당 정보 (카카오 기본정보 + 유저 추가정보)
create table restaurants (
  id uuid primary key default gen_random_uuid(),
  kakao_id text unique not null,
  name text not null,
  address text,
  category text,
  lat text,
  lng text,
  votes_up int default 0,
  votes_down int default 0,
  place_url text,
  image_url text,
  latest_price_krw int,
  note text,
  created_at timestamptz default now()
);

-- 식당 메뉴 + 영양정보 + 가격
create table restaurant_menus (
  id uuid primary key default gen_random_uuid(),
  kakao_id text,  -- FK 제거 (직접 등록 편의를 위해)
  menu_name text not null,
  price int,      -- 실제 가격 (원)
  calories numeric,
  carbs numeric,
  protein numeric,
  fat numeric,
  sodium numeric,
  created_at timestamptz default now()
);

-- 식사 기록
create table meal_records (
  id uuid primary key default gen_random_uuid(),
  kakao_id text,
  restaurant_name text not null,
  category text,
  menu_name text,
  calories numeric,
  date date not null default current_date,
  device_id text,  -- 로그인 없이 기기별 구분
  created_at timestamptz default now()
);

-- 팀 투표방
create table vote_rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_nickname text,
  status text default 'voting',
  created_at timestamptz default now()
);

-- 투표 후보 (방별 식당 목록)
create table room_candidates (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references vote_rooms(id) on delete cascade,
  kakao_id text,
  name text not null,
  category text,
  distance text,
  address text
);

-- 투표 결과
create table room_votes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references vote_rooms(id) on delete cascade,
  candidate_id uuid references room_candidates(id) on delete cascade,
  nickname text not null,
  created_at timestamptz default now()
);

-- 식당 사진 갤러리
create table restaurant_photos (
  id uuid primary key default gen_random_uuid(),
  kakao_id text not null,
  url text not null,
  device_id text,
  created_at timestamptz default now()
);

-- 자유게시판
create table free_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  device_id text,
  likes int default 0,
  comment_count int default 0,
  created_at timestamptz default now()
);

-- 게시판 댓글
create table post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references free_posts(id) on delete cascade,
  content text not null,
  device_id text,
  created_at timestamptz default now()
);

-- 한 줄 리뷰
create table reviews (
  id uuid primary key default gen_random_uuid(),
  kakao_id text not null,
  restaurant_name text,
  content text not null,
  device_id text,
  created_at timestamptz default now()
);

-- 실시간 구독을 위한 publication 활성화
alter publication supabase_realtime add table room_votes;

-- RLS 비활성화 (MVP - 추후 인증 추가시 활성화)
alter table restaurants enable row level security;
alter table restaurant_menus enable row level security;
alter table meal_records enable row level security;
alter table vote_rooms enable row level security;
alter table room_candidates enable row level security;
alter table room_votes enable row level security;

create policy "public read" on restaurants for select using (true);
create policy "public insert" on restaurants for insert with check (true);
create policy "public update" on restaurants for update using (true);

create policy "public read" on restaurant_menus for select using (true);
create policy "public insert" on restaurant_menus for insert with check (true);

create policy "public read" on meal_records for select using (true);
create policy "public insert" on meal_records for insert with check (true);
create policy "public delete" on meal_records for delete using (true);

create policy "public read" on vote_rooms for select using (true);
create policy "public insert" on vote_rooms for insert with check (true);

create policy "public read" on room_candidates for select using (true);
create policy "public insert" on room_candidates for insert with check (true);

create policy "public read" on room_votes for select using (true);
create policy "public insert" on room_votes for insert with check (true);
create policy "public delete" on room_votes for delete using (true);

-- restaurant_photos RLS
alter table restaurant_photos enable row level security;
create policy "public read" on restaurant_photos for select using (true);
create policy "public insert" on restaurant_photos for insert with check (true);

-- free_posts RLS
alter table free_posts enable row level security;
create policy "public read" on free_posts for select using (true);
create policy "public insert" on free_posts for insert with check (true);
create policy "public update" on free_posts for update using (true);

-- post_comments RLS
alter table post_comments enable row level security;
create policy "public read" on post_comments for select using (true);
create policy "public insert" on post_comments for insert with check (true);
-- reviews RLS
alter table reviews enable row level security;
create policy "public read" on reviews for select using (true);
create policy "public insert" on reviews for insert with check (true);
-- restaurant_menus delete (메뉴 삭제 기능용)
create policy "public delete" on restaurant_menus for delete using (true);
