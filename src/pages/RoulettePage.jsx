import { useState } from 'react'
import { searchNearbyRestaurants, addressToCoords } from '../lib/kakao'
import { filterByPrice, estimatePriceRange } from '../lib/price'
import { supabase } from '../lib/supabase'
import { getDeviceId } from '../lib/deviceId'
import { Shuffle, MapPin, ChevronDown, ChevronUp, Users, GlassWater, Flame, Plus, Check, Navigation, Search } from 'lucide-react'

const CATEGORIES = ['전체', '한식', '중식', '일식', '양식', '분식']
const PRICE_RANGES = ['전체', '~8천원', '~10천원', '~15천원', '~25천원']
const PERSON_COUNTS = ['1인', '2-4명', '5-9명', '10명+']

function getKeyword(category, persons, isDinner, dietOnly) {
  if (isDinner) return PERSON_COUNTS.indexOf(persons) >= 2 ? '고깃집' : '삼겹살'
  if (dietOnly && category === '전체') return '샐러드'
  if (category !== '전체') return category
  return '음식점'
}

const DIET_KEYWORDS = ['샐러드', '포케', '샌드위치', '그릭요거트', '서브웨이', '다이어트', '건강식', '키토']

function getRadius() {
  return 500 // 사용자 요청: 500m 고정 (도보 10분 내외)
}

export default function RoulettePage() {
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState(null)
  const [resultMenus, setResultMenus] = useState([])
  const [category, setCategory] = useState('전체')
  const [priceRange, setPriceRange] = useState('전체')
  const [persons, setPersons] = useState('1인')
  const [isDinner, setIsDinner] = useState(false)
  const [lunchOnly, setLunchOnly] = useState(true)
  const [dietOnly, setDietOnly] = useState(false)
  const [geojipOnly, setGeojipOnly] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  const [history, setHistory] = useState([])
  const [added, setAdded] = useState(false)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [newMenu, setNewMenu] = useState({ name: '', price: '', calories: '' })
  const [savingMenu, setSavingMenu] = useState(false)

  // 위치 모드
  const [locationMode, setLocationMode] = useState('current') // 'current' | 'custom'
  const [customAddress, setCustomAddress] = useState('')
  const [customCoords, setCustomCoords] = useState(null)
  const [searchingAddr, setSearchingAddr] = useState(false)
  const [addrError, setAddrError] = useState('')

  async function searchAddress() {
    if (!customAddress.trim()) return
    setSearchingAddr(true)
    setAddrError('')
    try {
      const coords = await addressToCoords(customAddress)
      setCustomCoords(coords)
      setAddrError('')
    } catch {
      setAddrError('주소를 찾을 수 없어요')
      setCustomCoords(null)
    }
    setSearchingAddr(false)
  }

  async function spin() {
    if (spinning) return
    setSpinning(true)
    setResult(null)
    setResultMenus([])
    setAdded(false)

    try {
      let pos
      if (locationMode === 'custom' && customCoords) {
        pos = customCoords
      } else {
        pos = await getCurrentPosition()
      }

      const keyword = getKeyword(category, persons, isDinner, dietOnly)
      const radius = getRadius(persons, isDinner)

      let pool = []

      if (geojipOnly) {
        // 거지맵 저렴한 식당만
        const delta = radius / 111000
        let query = supabase
          .from('restaurants')
          .select('*')
          .like('kakao_id', 'geojip_%')
          .gte('lat', String(pos.lat - delta))
          .lte('lat', String(pos.lat + delta))
          .gte('lng', String(pos.lng - delta))
          .lte('lng', String(pos.lng + delta))
        if (category !== '전체') query = query.ilike('category', `%${category}%`)
        if (priceRange !== '전체') {
          // geojip은 latest_price_krw 기준 직접 필터
          const priceMap = { '~8천원': 8000, '~10천원': 10000, '~15천원': 15000, '~25천원': 25000 }
          query = query.lte('latest_price_krw', priceMap[priceRange] || 25000)
        }
        const { data } = await query.limit(50)
        pool = (data || []).map((r) => ({
          ...r,
          place_name: r.name,
          id: r.kakao_id,
          y: r.lat,
          x: r.lng,
          road_address_name: r.address,
          category_name: r.category,
          _isGeojip: true,
        }))
      } else {
        let results = await searchNearbyRestaurants({
          lat: pos.lat, lng: pos.lng, radius, keyword, dinnerMode: isDinner,
        })

        if (!isDinner && priceRange !== '전체') {
          const kakaoIds = results.map((r) => r.id)
          const { data: menuData } = await supabase
            .from('restaurant_menus').select('*').in('kakao_id', kakaoIds)
          const menuMap = {}
          menuData?.forEach((m) => {
            if (!menuMap[m.kakao_id]) menuMap[m.kakao_id] = []
            menuMap[m.kakao_id].push(m)
          })
          results = filterByPrice(results, priceRange, menuMap)
        }

        if (dietOnly) {
          results = results.filter((r) =>
            DIET_KEYWORDS.some((kw) => (r.category_name || '').includes(kw) || (r.place_name || '').includes(kw))
          )
        }

        pool = results
      }

      // 최근 7일 먹은 곳 제외
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
      const { data: recentMeals } = await supabase
        .from('meal_records').select('kakao_id')
        .eq('device_id', getDeviceId()).gte('date', sevenDaysAgo)
      const recentIds = new Set(recentMeals?.map((m) => m.kakao_id) || [])
      const unvisited = pool.filter((r) => !recentIds.has(r.id || r.kakao_id))
      const finalPool = unvisited.length >= 3 ? unvisited : pool

      if (!finalPool.length) {
        alert('조건에 맞는 식당이 없어요. 필터를 조정해보세요.')
        setSpinning(false)
        return
      }

      let count = 0
      const interval = setInterval(() => {
        setResult(finalPool[Math.floor(Math.random() * finalPool.length)])
        count++
        if (count >= 15) {
          clearInterval(interval)
          const final = finalPool[Math.floor(Math.random() * finalPool.length)]
          setResult(final)
          setHistory((prev) => [final, ...prev].slice(0, 5))
          setSpinning(false)
          fetchResultMenus(final.id || final.kakao_id)
        }
      }, 100)
    } catch {
      alert('위치 정보를 가져올 수 없어요.')
      setSpinning(false)
    }
  }

  async function fetchResultMenus(kakaoId) {
    const { data } = await supabase
      .from('restaurant_menus').select('*').eq('kakao_id', kakaoId).limit(4)
    setResultMenus(data || [])
  }

  function getCurrentPosition() {
    return new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        reject,
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    )
  }

  async function addToRecord() {
    if (!result || added) return
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('meal_records').insert({
      kakao_id: result.id || result.kakao_id,
      restaurant_name: result.place_name,
      category: result.category_name,
      date: today,
      device_id: getDeviceId(),
    })
    setAdded(true)
  }

  async function saveMenu() {
    if (!newMenu.name.trim() || !result) return
    setSavingMenu(true)
    await supabase.from('restaurants').upsert({
      kakao_id: result.id || result.kakao_id,
      name: result.place_name,
      address: result.road_address_name || result.address_name,
      category: result.category_name,
      lat: result.y,
      lng: result.x,
      ...(result.place_url && { place_url: result.place_url }),
    })
    await supabase.from('restaurant_menus').insert({
      kakao_id: result.id || result.kakao_id,
      menu_name: newMenu.name,
      price: newMenu.price ? Number(newMenu.price) : null,
      calories: newMenu.calories ? Number(newMenu.calories) : null,
    })
    setSavingMenu(false)
    setShowAddMenu(false)
    setNewMenu({ name: '', price: '', calories: '' })
    fetchResultMenus(result.id || result.kakao_id)
  }

  const filterSummary = [
    category !== '전체' && category,
    priceRange !== '전체' && priceRange,
    persons !== '1인' && persons,
    isDinner && '회식',
    lunchOnly && !isDinner && '점심간편식',
    dietOnly && !isDinner && '다이어터',
    geojipOnly && '가성비만',
  ].filter(Boolean).join(' · ')

  const estimatedPrice = result ? estimatePriceRange(result.category_name) : ''

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  const detailHref = (() => {
    if (!result) return '#'
    const kakaoId = result.id || result.kakao_id
    const name = result.place_name || result.name
    const addr = result.road_address_name || result.address_name || result.address || ''
    const q = encodeURIComponent(name + ' ' + addr.split(' ').slice(0, 3).join(' '))
    if (isMobile) {
      if (result.place_url) return result.place_url
      if (kakaoId && !String(kakaoId).startsWith('geojip_')) {
        return `https://place.map.kakao.com/${kakaoId}`
      }
    }
    return `https://map.naver.com/v5/search/${q}`
  })()

  return (
    <div className="p-4 max-w-md mx-auto pb-24">
      <div className="text-center mb-5 pt-4">
        <h2 className="text-2xl font-bold text-gray-900">오늘 뭐 먹지?</h2>
        <p className="text-sm text-gray-400 mt-1">룰렛 돌려서 결정해요</p>
      </div>

      {/* 위치 선택 */}
      <div className="mb-3">
        <p className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1">
          <Navigation size={12} /> 검색 위치
        </p>
        <div className="flex gap-2 mb-2">
          <button onClick={() => setLocationMode('current')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
              locationMode === 'current' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200'
            }`}>
            <MapPin size={14} /> 내 위치
          </button>
          <button onClick={() => setLocationMode('custom')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
              locationMode === 'custom' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200'
            }`}>
            <Search size={14} /> 직접 입력
          </button>
        </div>
        {locationMode === 'custom' && (
          <div>
            <div className="flex gap-2">
              <input
                value={customAddress}
                onChange={(e) => setCustomAddress(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchAddress()}
                placeholder="주소 또는 지역명 (예: 강남역, 판교)"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400"
              />
              <button onClick={searchAddress} disabled={searchingAddr}
                className="bg-orange-500 text-white px-3 rounded-xl text-sm font-medium disabled:opacity-50">
                {searchingAddr ? '...' : '검색'}
              </button>
            </div>
            {addrError && <p className="text-xs text-red-400 mt-1">{addrError}</p>}
            {customCoords && !addrError && (
              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                <Check size={12} /> "{customAddress}" 기준으로 검색해요
              </p>
            )}
          </div>
        )}
      </div>

      {/* 인원 선택 */}
      <div className="mb-3">
        <p className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1">
          <Users size={12} /> 인원
        </p>
        <div className="flex gap-2">
          {PERSON_COUNTS.map((p) => (
            <button key={p} onClick={() => { setPersons(p); setIsDinner(PERSON_COUNTS.indexOf(p) >= 2) }}
              className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-colors ${
                persons === p ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200'
              }`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* 회식 모드 */}
      <button onClick={() => setIsDinner(!isDinner)}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border mb-3 transition-colors ${
          isDinner ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-white border-gray-200 text-gray-500'
        }`}>
        <div className="flex items-center gap-2">
          <GlassWater size={16} className={isDinner ? 'text-purple-500' : 'text-gray-400'} />
          <span className="text-sm font-medium">회식장소 모드</span>
          {isDinner && <span className="text-xs text-purple-400">단체석·고깃집 위주</span>}
        </div>
        <div className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 ${isDinner ? 'bg-purple-500' : 'bg-gray-200'}`}>
          <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${isDinner ? 'translate-x-5' : ''}`} />
        </div>
      </button>

      {/* 특수 필터 */}
      {!isDinner && (
        <div className="flex flex-col gap-2 mb-3">
          <div className="flex gap-2">
            <button onClick={() => { setLunchOnly(!lunchOnly); if (!lunchOnly) setDietOnly(false) }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                lunchOnly ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200'
              }`}>
              🍱 점심 간편식
            </button>
            <button onClick={() => { setDietOnly(!dietOnly); if (!dietOnly) { setLunchOnly(false); setGeojipOnly(false) } }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                dietOnly ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-600 border-gray-200'
              }`}>
              🥗 다이어터
            </button>
          </div>
          <button onClick={() => { setGeojipOnly(!geojipOnly); if (!geojipOnly) setDietOnly(false) }}
            className={`w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
              geojipOnly ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200'
            }`}>
            💰 가성비만
          </button>
        </div>
      )}

      {/* 필터 */}
      <button onClick={() => setShowFilter(!showFilter)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-gray-200 text-sm text-gray-600 mb-3">
        <span className={filterSummary ? 'text-orange-500 font-medium' : ''}>
          {filterSummary || '카테고리 · 가격대 필터'}
        </span>
        {showFilter ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {showFilter && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <p className="text-xs font-semibold text-gray-500 mb-2">카테고리</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCategory(c)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${category === c ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200'}`}>
                {c}
              </button>
            ))}
          </div>
          <p className="text-xs font-semibold text-gray-500 mb-2">가격대</p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {PRICE_RANGES.map((p) => (
              <button key={p} onClick={() => setPriceRange(p)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors shadow-sm ${
                  priceRange === p ? 'bg-green-600 text-white' : 'bg-white text-gray-500 border border-gray-200'
                }`}>
                {p}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-300 mt-2">* 최근 7일간 안 먹은 곳을 우선 추천해요</p>
        </div>
      )}

      {/* 룰렛 결과 카드 */}
      <div className={`bg-white rounded-2xl border-2 p-5 mb-4 transition-all ${
        spinning ? 'border-orange-300 animate-pulse' : result ? 'border-orange-500' : 'border-gray-100'
      }`}>
        {result ? (
          <>
            <div className="flex items-start gap-3 mb-3">
              <span className="text-3xl">{spinning ? '🎲' : isDinner ? '🍻' : result._isGeojip ? '💰' : '🍽️'}</span>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-gray-900 truncate">{result.place_name}</h3>
                <p className="text-sm text-gray-400">{result.category_name?.split(' > ').slice(-1)[0]}</p>
                <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                  <MapPin size={11} /> {result.road_address_name || result.address_name || result.address}
                </div>
                {result._isGeojip && result.latest_price_krw && (
                  <p className="text-xs text-green-600 font-semibold mt-0.5">
                    💰 대표 메뉴 약 {Number(result.latest_price_krw).toLocaleString()}원
                  </p>
                )}
              </div>
            </div>

            {!spinning && (
              <div className="bg-gray-50 rounded-xl p-3 mb-3">
                {resultMenus.length > 0 ? (
                  <>
                    <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                      <Flame size={11} className="text-orange-400" /> 메뉴 정보
                    </p>
                    {resultMenus.map((m, i) => (
                      <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-100 last:border-0">
                        <span className="text-gray-700 font-medium">{m.menu_name}</span>
                        <div className="flex items-center gap-2">
                          {m.price && <span className="text-blue-500 font-semibold">{Number(m.price).toLocaleString()}원</span>}
                          {m.calories && <span className="text-orange-500 font-bold">{m.calories}kcal</span>}
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 font-medium">예상 가격대</p>
                      <p className="text-sm font-bold text-blue-500 mt-0.5">{estimatedPrice}</p>
                    </div>
                    <button onClick={() => setShowAddMenu(true)}
                      className="flex items-center gap-1 text-xs text-orange-500 bg-orange-50 px-2.5 py-1.5 rounded-lg">
                      <Plus size={12} /> 메뉴 등록
                    </button>
                  </div>
                )}

                {showAddMenu && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs font-semibold text-gray-500 mb-2">메뉴 정보 추가</p>
                    <div className="flex flex-col gap-2">
                      <input value={newMenu.name} onChange={(e) => setNewMenu({...newMenu, name: e.target.value})}
                        placeholder="메뉴명" className="text-sm border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-orange-400" />
                      <div className="flex gap-2">
                        <input value={newMenu.price} onChange={(e) => setNewMenu({...newMenu, price: e.target.value})}
                          placeholder="가격 (원)" type="number" className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-orange-400" />
                        <input value={newMenu.calories} onChange={(e) => setNewMenu({...newMenu, calories: e.target.value})}
                          placeholder="칼로리" type="number" className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-orange-400" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setShowAddMenu(false)} className="flex-1 py-2 text-xs text-gray-400 border border-gray-200 rounded-lg">취소</button>
                        <button onClick={saveMenu} disabled={savingMenu || !newMenu.name.trim()}
                          className="flex-1 py-2 text-xs bg-orange-500 text-white rounded-lg disabled:opacity-50">
                          {savingMenu ? '저장 중...' : '저장'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {resultMenus.length > 0 && !showAddMenu && (
                  <button onClick={() => setShowAddMenu(true)}
                    className="mt-2 w-full text-xs text-gray-400 flex items-center justify-center gap-1 py-1">
                    <Plus size={11} /> 메뉴 추가
                  </button>
                )}
              </div>
            )}

            {!spinning && (
              <div className="flex gap-2">
                <a href={detailHref}
                  target="_blank" rel="noopener noreferrer"
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-700 text-center hover:bg-gray-200 transition-colors">
                  🗺️ 식당 정보 보기
                </a>
                <button onClick={addToRecord} disabled={added}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${added ? 'bg-green-100 text-green-600' : 'bg-orange-500 text-white'}`}>
                  {added ? '✓ 기록 완료' : '오늘 먹었어요'}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-6">
            <div className="text-5xl mb-3">{isDinner ? '🍻' : dietOnly ? '🥗' : geojipOnly ? '💰' : '🎲'}</div>
            <p className="text-gray-400 text-sm">
              {isDinner ? `${persons} 회식장소를 찾아드려요` : dietOnly ? '가벼운 식단을 찾아드려요' : geojipOnly ? '주변 가성비 식당을 찾아드려요' : '버튼을 눌러 오늘 점심을 결정해요'}
            </p>
          </div>
        )}
      </div>

      {/* 룰렛 버튼 */}
      <button onClick={spin} disabled={spinning || (locationMode === 'custom' && !customCoords)}
        className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${
          spinning ? 'bg-gray-100 text-gray-400'
          : isDinner ? 'bg-purple-500 text-white active:scale-95'
          : geojipOnly ? 'bg-green-600 text-white active:scale-95'
          : 'bg-orange-500 text-white active:scale-95'
        } disabled:opacity-50`}>
        <Shuffle size={22} className={spinning ? 'animate-spin' : ''} />
        {spinning ? '찾는 중...' : isDinner ? '회식장소 뽑기!' : dietOnly ? '🥗 식단 뽑기!' : geojipOnly ? '💰 가성비 뽑기!' : '돌려돌려 룰렛!'}
      </button>
      {locationMode === 'custom' && !customCoords && (
        <p className="text-xs text-center text-orange-400 mt-2">위치를 검색해야 룰렛을 돌릴 수 있어요</p>
      )}

      {/* 최근 추천 */}
      {history.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold text-gray-400 mb-2">최근 추천</p>
          {history.map((h, i) => (
            <div key={i} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-800">{h.place_name}</p>
                <p className="text-xs text-gray-400">{h.category_name?.split(' > ').slice(-1)[0]}</p>
              </div>
              {h._isGeojip && h.latest_price_krw && (
                <span className="text-xs text-green-600 font-medium">{Math.round(h.latest_price_krw / 1000)}천원</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100 rounded-2xl p-4 flex items-center gap-4">
        <div className="text-3xl shrink-0">🍽️</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-orange-700 mb-0.5">자주 가는 맛집이 없나요?</p>
          <p className="text-xs text-orange-400 leading-relaxed">
            지도 탭에서 직접 식당을 등록하면<br />
            룰렛 후보에 메뉴·가격까지 표시돼요
          </p>
        </div>
        <a href="/" className="shrink-0 bg-orange-500 text-white text-xs font-bold px-3 py-2 rounded-xl">
          등록하기
        </a>
      </div>
    </div>
  )
}
