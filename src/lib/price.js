// 카카오 카테고리명 기반 가격대 추정
export function estimatePriceRange(categoryName) {
  const cat = categoryName || ''

  // ~25천원
  if (
    cat.includes('뷔페') || cat.includes('오마카세') || cat.includes('고급') ||
    cat.includes('양고기') || cat.includes('해산물') || cat.includes('스테이크')
  ) return '~25천원'

  // ~15천원 — 일식/양식 계열
  if (
    cat.includes('일식') || cat.includes('초밥') || cat.includes('스시') ||
    cat.includes('일본식') || cat.includes('라멘') ||
    cat.includes('양식') || cat.includes('파스타') ||
    cat.includes('돈까스') || cat.includes('샐러드') || cat.includes('이탈리안') ||
    cat.includes('멕시칸') || cat.includes('인도') ||
    cat.includes('치킨') || cat.includes('피자') || cat.includes('족발') || cat.includes('보쌈')
  ) return '~15천원'

  // ~10천원 — 한식/중식 일반
  if (
    cat.includes('국밥') || cat.includes('백반') || cat.includes('찌개') ||
    cat.includes('한식') || cat.includes('중식') || cat.includes('냉면') ||
    cat.includes('비빔밥') || cat.includes('덮밥') || cat.includes('도시락') ||
    cat.includes('칼국수') || cat.includes('국수')
  ) return '~10천원'

  // ~8천원 — 분식/패스트푸드
  if (
    cat.includes('분식') || cat.includes('김밥') || cat.includes('떡볶이') ||
    cat.includes('순대') || cat.includes('패스트푸드') ||
    cat.includes('버거') || cat.includes('핫도그') || cat.includes('편의점') ||
    (cat.includes('라면') && !cat.includes('일본식'))
  ) return '~8천원'

  return '~10천원' // 기본값
}

const PRICE_ORDER = ['~8천원', '~10천원', '~15천원', '~25천원']

function priceToRange(price) {
  if (price <= 8000) return '~8천원'
  if (price <= 10000) return '~10천원'
  if (price <= 15000) return '~15천원'
  return '~25천원'
}

// menuMap: { [kakao_id]: [{price, ...}] } — DB에서 가져온 메뉴 데이터
export function filterByPrice(restaurants, priceRange, menuMap = {}) {
  if (priceRange === '전체') return restaurants
  return restaurants.filter((r) => {
    const kakaoId = r.kakao_id || r.id
    const dbMenus = menuMap[kakaoId]?.filter((m) => m.price)
    if (dbMenus?.length) {
      return PRICE_ORDER.indexOf(priceToRange(dbMenus[0].price)) <= PRICE_ORDER.indexOf(priceRange)
    }
    if (r.latest_price_krw) {
      return PRICE_ORDER.indexOf(priceToRange(r.latest_price_krw)) <= PRICE_ORDER.indexOf(priceRange)
    }
    // 카테고리 기반 추정 fallback
    const estimated = estimatePriceRange(r.category_name || r.category)
    return PRICE_ORDER.indexOf(estimated) <= PRICE_ORDER.indexOf(priceRange)
  })
}
