// 카카오 지도 스크립트 로드
export function loadKakaoMapScript() {
  return new Promise((resolve, reject) => {
    if (window.kakao && window.kakao.maps) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${import.meta.env.VITE_KAKAO_JS_KEY}&autoload=false&libraries=services`
    script.onload = () => window.kakao.maps.load(resolve)
    script.onerror = reject
    document.head.appendChild(script)
  })
}

// 점심 부적합 카테고리
const LUNCH_BLOCKLIST = [
  '술집', '주점', '호프', '포차', '이자카야', '바(BAR)', '바 ',
  '나이트', '클럽', '유흥', '단란주점', '룸살롱',
  '노래', '가라오케',
  '삼겹살', '곱창', '막창', '대창',
  '갈비', '갈매기살', '항정살',
  '양꼬치', '양갈비',
  '고기구이', '육류,고기', '구이',
  '오리구이', '오리로스',
  '닭발', '닭갈비',
  '횟집', '회 ', '수산', '해산물', '조개구이', '랍스터', '대게', '킹크랩',
  '뷔페', '오마카세',
]

export function isLunchFriendly(categoryName) {
  const cat = categoryName || ''
  return !LUNCH_BLOCKLIST.some((block) => cat.includes(block))
}

// 여러 페이지 Kakao Places 검색 (최대 3페이지 = 45건)
// mapInstance: kakao.maps.Map 객체 — 지도 보이는 영역 기반 검색에 사용
export function searchNearbyRestaurants({ lat, lng, radius = 1500, keyword = '음식점', dinnerMode = false, mapInstance = null }) {
  return new Promise((resolve, reject) => {
    const ps = mapInstance
      ? new window.kakao.maps.services.Places(mapInstance)
      : new window.kakao.maps.services.Places()
    const isCafe = keyword === '카페'
    const categoryCode = isCafe ? 'CE7' : 'FD6'
    const searchKeyword = isCafe ? '카페' : keyword
    const allResults = []

    const baseOptions = mapInstance
      ? { useMapBounds: true, category_group_code: categoryCode, size: 15 }
      : { location: new window.kakao.maps.LatLng(lat, lng), radius, category_group_code: categoryCode, size: 15 }

    function fetchPage(page) {
      ps.keywordSearch(
        searchKeyword,
        (data, status, pagination) => {
          if (status === window.kakao.maps.services.Status.OK) {
            allResults.push(...data)
            if (page < 5 && pagination.hasNextPage) {
              fetchPage(page + 1)
            } else {
              const filtered = dinnerMode
                ? allResults
                : allResults.filter((r) => isLunchFriendly(r.category_name))
              resolve(filtered)
            }
          } else if (status === window.kakao.maps.services.Status.ZERO_RESULT) {
            resolve(allResults)
          } else {
            allResults.length > 0 ? resolve(allResults) : reject(new Error('Places 검색 실패'))
          }
        },
        { ...baseOptions, page }
      )
    }

    fetchPage(1)
  })
}

// 좌표로 주소 검색 (Geocoder)
export function coordsToAddress(lat, lng) {
  return new Promise((resolve) => {
    const geocoder = new window.kakao.maps.services.Geocoder()
    geocoder.coord2Address(lng, lat, (result, status) => {
      if (status === window.kakao.maps.services.Status.OK) {
        resolve(result[0]?.road_address?.address_name || result[0]?.address?.address_name || '')
      } else {
        resolve('')
      }
    })
  })
}

// 주소로 좌표 검색
export function addressToCoords(address) {
  return new Promise((resolve, reject) => {
    const geocoder = new window.kakao.maps.services.Geocoder()
    geocoder.addressSearch(address, (result, status) => {
      if (status === window.kakao.maps.services.Status.OK) {
        resolve({ lat: Number(result[0].y), lng: Number(result[0].x) })
      } else {
        reject(new Error('주소를 찾을 수 없어요'))
      }
    })
  })
}
