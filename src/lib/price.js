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
  const targetIndex = PRICE_ORDER.indexOf(priceRange)

  return restaurants.filter((r) => {
    const kakaoId = r.kakao_id || r.id
    const dbMenus = menuMap[kakaoId]?.filter((m) => m.price)
    
    // 1. DB 메뉴 정보가 있는 경우 (첫 번째 메뉴 기준)
    if (dbMenus?.length) {
      const firstMenuPrice = dbMenus[0].price
      return PRICE_ORDER.indexOf(priceToRange(firstMenuPrice)) <= targetIndex
    }
    
    // 2. 식당 테이블에 등록된 최신 가격 정보가 있는 경우
    if (r.latest_price_krw) {
      return PRICE_ORDER.indexOf(priceToRange(r.latest_price_krw)) <= targetIndex
    }
    
    // 2.5 가성비 전용 데이터 (geojip_%) 예외 처리: 명시적 가격 정보가 없으면 ~8천원으로 간주
    if (String(kakaoId).startsWith('geojip_')) {
      return PRICE_ORDER.indexOf('~8천원') <= targetIndex
    }
    
    // 3. 카테고리 기반 추정 (Fallback)
    const estimated = estimatePriceRange(r.category_name || r.category)
    return PRICE_ORDER.indexOf(estimated) <= targetIndex
  })
}
