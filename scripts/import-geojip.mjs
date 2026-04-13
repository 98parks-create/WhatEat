// 거지맵 데이터 → WhatEat Supabase 임포트
// 실행: node scripts/import-geojip.mjs

const GEOJIP_URL = 'https://lzeazgyvjzireemncjep-all.supabase.co/rest/v1'
const GEOJIP_KEY = 'sb_publishable_b7EOyF1IuulD2ZU-VYqtCA_2L3X6PSV'

const OUR_URL = 'https://tycwcqbypctbfkpfsbns.supabase.co/rest/v1'
const OUR_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5Y3djcWJ5cGN0YmZrcGZzYm5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDc4NjIsImV4cCI6MjA5MTQyMzg2Mn0.9oXP8bLAAheQ4W7JlDJP1EtUj7fYpNjQctSqAFLUVKA'

const CATEGORY_MAP = {
  korean: '음식점 > 한식',
  korean_buffet: '음식점 > 한식 > 뷔페',
  chinese: '음식점 > 중식',
  japanese: '음식점 > 일식',
  western: '음식점 > 양식',
  snack: '음식점 > 분식',
  noodle: '음식점 > 한식 > 국수',
  soup: '음식점 > 한식 > 국밥',
  cafe: '카페',
  fastfood: '음식점 > 패스트푸드',
  chicken: '음식점 > 치킨',
  pizza: '음식점 > 피자',
  burger: '음식점 > 패스트푸드 > 버거',
  meat: '음식점 > 한식 > 고기요리',
  seafood: '음식점 > 해산물',
  vietnamese: '음식점 > 아시안',
  thai: '음식점 > 아시안',
}

async function fetchGeojip(offset) {
  const res = await fetch(
    `${GEOJIP_URL}/restaurants?select=*&deleted_at=is.null&order=created_at.asc&limit=1000&offset=${offset}`,
    { headers: { apikey: GEOJIP_KEY, Authorization: `Bearer ${GEOJIP_KEY}` } }
  )
  return res.json()
}

async function upsertRestaurants(rows) {
  const res = await fetch(`${OUR_URL}/restaurants`, {
    method: 'POST',
    headers: {
      apikey: OUR_KEY,
      Authorization: `Bearer ${OUR_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`upsert failed: ${res.status} ${text}`)
  }
}

async function insertMenus(rows) {
  const res = await fetch(`${OUR_URL}/restaurant_menus`, {
    method: 'POST',
    headers: {
      apikey: OUR_KEY,
      Authorization: `Bearer ${OUR_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) {
    const text = await res.text()
    console.warn(`menu insert warn: ${res.status} ${text.slice(0, 200)}`)
  }
}

function transform(r) {
  const kakaoId = `geojip_${r.id}`
  const category = CATEGORY_MAP[r.category_key] || '음식점 > 한식'
  return {
    kakao_id: kakaoId,
    name: r.name,
    address: r.address,
    category,
    lat: String(r.lat),
    lng: String(r.lng),
    votes_up: 0,
    votes_down: 0,
  }
}

function transformMenu(r) {
  if (!r.latest_menu_name) return null
  return {
    kakao_id: `geojip_${r.id}`,
    menu_name: r.latest_menu_name,
    price: r.latest_price_krw || null,
    calories: null,
  }
}

async function main() {
  let offset = 0
  let total = 0
  let page = 0

  while (true) {
    process.stdout.write(`\r페이지 ${++page} (offset ${offset}) 가져오는 중...`)
    const rows = await fetchGeojip(offset)
    if (!rows.length) break

    const restaurants = rows.map(transform)
    const menus = rows.map(transformMenu).filter(Boolean)

    await upsertRestaurants(restaurants)
    if (menus.length) await insertMenus(menus)

    total += rows.length
    offset += 1000

    if (rows.length < 1000) break
    await new Promise(r => setTimeout(r, 300)) // rate limit 방지
  }

  console.log(`\n\n완료! 총 ${total}개 식당 임포트`)
}

main().catch(console.error)
