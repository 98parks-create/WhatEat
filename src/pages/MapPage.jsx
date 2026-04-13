import { useEffect, useRef, useState, useCallback } from 'react'
import { loadKakaoMapScript, searchNearbyRestaurants } from '../lib/kakao'
import { filterByPrice } from '../lib/price'
import { supabase } from '../lib/supabase'
import RestaurantDrawer from '../components/RestaurantDrawer'
import { LocateFixed, Plus, RefreshCw, Download, X, Trophy } from 'lucide-react'
import AddRestaurantModal from '../components/AddRestaurantModal'

const CATEGORIES = ['전체', '한식', '중식', '일식', '양식', '분식', '카페']
const PRICE_RANGES = ['전체', '~8천원', '~10천원', '~15천원', '~25천원']

export default function MapPage() {
  const mapRef = useRef(null)
  const kakaoMap = useRef(null)
  const overlaysRef = useRef([])
  const myMarkerRef = useRef(null)
  const [selected, setSelected] = useState(null)
  const [category, setCategory] = useState('전체')
  const categoryRef = useRef('전체')
  const [priceRange, setPriceRange] = useState('전체')
  const priceRangeRef = useRef('전체')
  const [loading, setLoading] = useState(true)
  const [mapError, setMapError] = useState(null)
  const [searching, setSearching] = useState(false)
  const [myLocation, setMyLocation] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [lunchOnly, setLunchOnly] = useState(true)
  const lunchOnlyRef = useRef(true)
  const [geojipOnly, setGeojipOnly] = useState(false)
  const geojipOnlyRef = useRef(false)
  const selectedRef = useRef(null)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [installed, setInstalled] = useState(false)
  const [showIosGuide, setShowIosGuide] = useState(false)
  const [top10, setTop10] = useState([])
  const [showTop10, setShowTop10] = useState(false)

  const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isIosChrome = /CriOS/i.test(navigator.userAgent)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true
  const showInstallBtn = !isStandalone && !installed && (installPrompt || isIos)

  useEffect(() => {
    initMap()
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => setInstalled(true))
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function initMap() {
    try {
      await loadKakaoMapScript()
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude
          const lng = pos.coords.longitude
          setMyLocation({ lat, lng })
          setupMap(lat, lng)
        },
        () => setupMap(37.5665, 126.9780)
      )
    } catch (e) {
      console.error(e)
      setMapError(e.message || '지도 로드 실패')
      setLoading(false)
    }
  }

  function setupMap(lat, lng) {
    const { kakao } = window
    kakaoMap.current = new kakao.maps.Map(mapRef.current, {
      center: new kakao.maps.LatLng(lat, lng),
      level: 4,
    })

    const myEl = document.createElement('div')
    myEl.style.cssText = 'width:14px;height:14px;background:#4A90E2;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.35)'
    myMarkerRef.current = new kakao.maps.CustomOverlay({
      map: kakaoMap.current,
      position: new kakao.maps.LatLng(lat, lng),
      content: myEl,
      zIndex: 10,
    })

    kakao.maps.event.addListener(kakaoMap.current, 'dragend', () => {
      const center = kakaoMap.current.getCenter()
      fetchRestaurants(center.getLat(), center.getLng())
    })
    kakao.maps.event.addListener(kakaoMap.current, 'zoom_changed', () => {
      const center = kakaoMap.current.getCenter()
      fetchRestaurants(center.getLat(), center.getLng())
    })

    fetchRestaurants(lat, lng)
    setLoading(false)
  }

  async function fetchGeojipNearby() {
    if (!kakaoMap.current) return []
    const bounds = kakaoMap.current.getBounds()
    const sw = bounds.getSouthWest()
    const ne = bounds.getNorthEast()

    let query = supabase
      .from('restaurants')
      .select('*')
      .like('kakao_id', 'geojip_%')
      .gte('lat', String(sw.getLat()))
      .lte('lat', String(ne.getLat()))
      .gte('lng', String(sw.getLng()))
      .lte('lng', String(ne.getLng()))

    if (categoryRef.current !== '전체') {
      query = query.ilike('category', `%${categoryRef.current}%`)
    }

    // 바운딩박스 내 전체 가져온 뒤 중심에서 가까운 순 50개
    const { data } = await query.limit(200)
    const center = kakaoMap.current.getCenter()
    const clat = center.getLat()
    const clng = center.getLng()
    const sorted = (data || [])
      .map((r) => {
        const dlat = Number(r.lat) - clat
        const dlng = Number(r.lng) - clng
        return { ...r, _dist: dlat * dlat + dlng * dlng }
      })
      .sort((a, b) => a._dist - b._dist)
      .slice(0, 50)
    return sorted.map((r) => ({
      ...r,
      place_name: r.name,
      y: r.lat,
      x: r.lng,
      road_address_name: r.address,
      category_name: r.category,
      _isGeojip: true,
    }))
  }

  async function fetchRegisteredNearby() {
    if (!kakaoMap.current) return []
    const bounds = kakaoMap.current.getBounds()
    const sw = bounds.getSouthWest()
    const ne = bounds.getNorthEast()

    let query = supabase
      .from('restaurants')
      .select('*')
      .not('kakao_id', 'like', 'geojip_%')
      .gte('lat', String(sw.getLat()))
      .lte('lat', String(ne.getLat()))
      .gte('lng', String(sw.getLng()))
      .lte('lng', String(ne.getLng()))

    if (categoryRef.current !== '전체') {
      query = query.ilike('category', `%${categoryRef.current}%`)
    }

    const { data } = await query.limit(500)
    return (data || []).map((r) => ({
      ...r,
      place_name: r.name,
      y: r.lat,
      x: r.lng,
      road_address_name: r.address,
      category_name: r.category,
    }))
  }

  async function fetchTop10InArea() {
    if (!kakaoMap.current) return
    const bounds = kakaoMap.current.getBounds()
    const sw = bounds.getSouthWest()
    const ne = bounds.getNorthEast()

    const { data } = await supabase
      .from('restaurants')
      .select('*')
      .not('kakao_id', 'like', 'geojip_%')
      .gte('lat', String(sw.getLat()))
      .lte('lat', String(ne.getLat()))
      .gte('lng', String(sw.getLng()))
      .lte('lng', String(ne.getLng()))
      .order('votes_up', { ascending: false })
      .limit(10)

    const top = (data || []).filter((r) => (r.votes_up || 0) > 0)
    setTop10(top)
    setShowTop10(top.length > 0)
  }

  async function fetchRestaurants(lat, lng) {
    setSearching(true)
    try {
      const [geojipList, registeredList] = await Promise.all([
        fetchGeojipNearby(),
        fetchRegisteredNearby(),
      ])

      let merged

      if (geojipOnlyRef.current) {
        // 가성비만: geojip + 직접 등록 식당 중 메인 메뉴 8천원 이하
        const registeredIds = registeredList.map((r) => r.kakao_id)
        const { data: menuData } = registeredIds.length
          ? await supabase.from('restaurant_menus').select('*').in('kakao_id', registeredIds)
          : { data: [] }

        const menuMap = {}
        menuData?.forEach((m) => {
          if (!menuMap[m.kakao_id]) menuMap[m.kakao_id] = []
          menuMap[m.kakao_id].push(m)
        })

        const cheapRegistered = registeredList.filter((r) => {
          const menus = menuMap[r.kakao_id]?.filter((m) => m.price)
          return menus?.length && menus[0].price <= 8000
        }).map((r) => {
          const menus = menuMap[r.kakao_id]?.filter((m) => m.price) || []
          return { ...r, _menus: menuMap[r.kakao_id] || [], _isCheap: true, _cheapPrice: menus[0]?.price }
        })

        const geojipFiltered = filterByPrice(geojipList, priceRangeRef.current, {})
        merged = [...geojipFiltered, ...cheapRegistered]
      } else {
        const keyword = categoryRef.current === '전체' ? '음식점' : categoryRef.current
        const results = await searchNearbyRestaurants({
          lat, lng, keyword, dinnerMode: !lunchOnlyRef.current,
          mapInstance: kakaoMap.current,
        })

        // 카테고리 선택 시 클라이언트 사이드도 추가 필터링
        const categoryFiltered = categoryRef.current === '전체'
          ? results
          : results.filter((r) => (r.category_name || '').includes(categoryRef.current))

        const kakaoIdsSet = new Set(categoryFiltered.map((r) => r.id))
        const placeIds = [...kakaoIdsSet]

        // DB에는 있지만 Kakao API 결과에 없는 등록 식당 (반경 밖, 지방 등)
        const uniqueRegistered = registeredList.filter((r) => !kakaoIdsSet.has(r.kakao_id))
        const uniqueRegisteredIds = uniqueRegistered.map((r) => r.kakao_id)
        const allMenuIds = [...placeIds, ...uniqueRegisteredIds]

        const [{ data: dbData }, { data: menuData }] = await Promise.all([
          placeIds.length ? supabase.from('restaurants').select('*').in('kakao_id', placeIds) : Promise.resolve({ data: [] }),
          allMenuIds.length ? supabase.from('restaurant_menus').select('*').in('kakao_id', allMenuIds) : Promise.resolve({ data: [] }),
        ])

        const menuMap = {}
        menuData?.forEach((m) => {
          if (!menuMap[m.kakao_id]) menuMap[m.kakao_id] = []
          menuMap[m.kakao_id].push(m)
        })

        const kakaoMerged = categoryFiltered.map((r) => {
          const extra = dbData?.find((d) => d.kakao_id === r.id)
          const menus = menuMap[r.id]?.filter((m) => m.price) || []
          const cheapMenu = menus.find((m) => m.price <= 8000)
          return {
            ...r,
            ...extra,
            place_url: extra?.place_url || r.place_url,
            kakao_id: r.id,
            _menus: menuMap[r.id] || [],
            ...(cheapMenu && { _isCheap: true, _cheapPrice: cheapMenu.price }),
          }
        })

        const registeredMerged = uniqueRegistered.map((r) => {
          const menus = menuMap[r.kakao_id]?.filter((m) => m.price) || []
          const cheapMenu = menus.find((m) => m.price <= 8000)
          return { ...r, _menus: menuMap[r.kakao_id] || [], ...(cheapMenu && { _isCheap: true, _cheapPrice: cheapMenu.price }) }
        })

        merged = filterByPrice([...kakaoMerged, ...geojipList, ...registeredMerged], priceRangeRef.current, menuMap)
      }

      updateOverlays(merged)
      fetchTop10InArea()
    } catch (e) {
      console.error(e)
    }
    setSearching(false)
  }

  function updateOverlays(list) {
    const { kakao } = window
    if (!kakaoMap.current) return

    overlaysRef.current.forEach((o) => o.setMap(null))
    overlaysRef.current = []

    list.forEach((r) => {
      const el = document.createElement('div')
      const isGeojip = r._isGeojip
      const isCheap = r._isCheap

      if (isGeojip) {
        const priceLabel = r.latest_price_krw ? ` ${Math.round(r.latest_price_krw / 1000)}천원` : ''
        el.style.cssText = 'background:#16a34a;color:white;font-size:11px;font-weight:700;padding:4px 8px;border-radius:12px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.25);cursor:pointer;transform:translateY(-100%);display:flex;align-items:center;gap:3px'
        el.innerHTML = `<span>💰</span><span>${r.place_name}${priceLabel}</span>`
      } else if (isCheap) {
        const priceLabel = r._cheapPrice ? ` ${Math.round(r._cheapPrice / 1000)}천원` : ''
        el.style.cssText = 'background:#16a34a;color:white;font-size:11px;font-weight:700;padding:4px 8px;border-radius:12px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.25);cursor:pointer;transform:translateY(-100%);display:flex;align-items:center;gap:3px'
        el.innerHTML = `<span>💰</span><span>${r.place_name}${priceLabel}</span>`
      } else {
        el.style.cssText = 'background:#FF6B35;color:white;font-size:11px;font-weight:600;padding:4px 8px;border-radius:12px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.2);cursor:pointer;transform:translateY(-100%)'
        el.textContent = r.place_name
      }

      el.addEventListener('click', () => {
        selectedRef.current = r
        setSelected(r)
      })

      const overlay = new kakao.maps.CustomOverlay({
        map: kakaoMap.current,
        position: new kakao.maps.LatLng(Number(r.y || r.lat), Number(r.x || r.lng)),
        content: el,
        zIndex: (isGeojip || isCheap) ? 6 : 5,
      })
      overlaysRef.current.push(overlay)
    })
  }

  function reloadMap() {
    if (!kakaoMap.current) return
    const center = kakaoMap.current.getCenter()
    fetchRestaurants(center.getLat(), center.getLng())
  }

  function changeCategory(c) {
    setCategory(c)
    categoryRef.current = c
    reloadMap()
  }

  function changePriceRange(p) {
    setPriceRange(p)
    priceRangeRef.current = p
    reloadMap()
  }

  function goToMyLocation() {
    if (!myLocation || !kakaoMap.current) return
    kakaoMap.current.panTo(new window.kakao.maps.LatLng(myLocation.lat, myLocation.lng))
    fetchRestaurants(myLocation.lat, myLocation.lng)
  }

  return (
    <div className="relative flex-1 min-h-0">
      {/* 필터 바 */}
      <div className="absolute top-3 left-0 right-0 z-10 px-3 flex flex-col gap-1.5">
        {/* 카테고리 */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => changeCategory(c)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors shadow-sm ${
                category === c ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 border border-gray-200'
              }`}>
              {c}
            </button>
          ))}
        </div>
        {/* 가격 */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {PRICE_RANGES.map((p) => (
            <button key={p} onClick={() => changePriceRange(p)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors shadow-sm ${
                priceRange === p ? 'bg-blue-500 text-white' : 'bg-white text-gray-500 border border-gray-200'
              }`}>
              {p}
            </button>
          ))}
        </div>
        {/* 특수 필터 */}
        <div className="flex gap-2">
          <button
            onClick={() => { const n = !lunchOnly; setLunchOnly(n); lunchOnlyRef.current = n; reloadMap() }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors shadow-sm border ${
              lunchOnly ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-500 border-gray-200'
            }`}>
            🍱 점심 간편식
          </button>
          <button
            onClick={() => { const n = !geojipOnly; setGeojipOnly(n); geojipOnlyRef.current = n; reloadMap() }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors shadow-sm border ${
              geojipOnly ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-500 border-gray-200'
            }`}>
            💰 가성비만
          </button>
        </div>
      </div>

      {/* 지도 */}
      <div ref={mapRef} className="absolute inset-0" />

      {loading && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-20">
          <div className="text-center">
            <div className="text-3xl mb-2">🍱</div>
            <p className="text-sm text-gray-500">지도 불러오는 중...</p>
          </div>
        </div>
      )}

      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-white z-20">
          <div className="text-center px-6">
            <div className="text-3xl mb-3">⚠️</div>
            <p className="text-sm font-bold text-red-500 mb-1">지도 로드 실패</p>
            <p className="text-xs text-gray-400 break-all">{mapError}</p>
          </div>
        </div>
      )}

      {searching && !loading && (
        <div className="absolute top-32 left-1/2 -translate-x-1/2 z-10 bg-white rounded-full px-3 py-1.5 shadow text-xs text-gray-500 flex items-center gap-1.5">
          <RefreshCw size={12} className="animate-spin" />
          식당 검색 중
        </div>
      )}

      {/* 이 지역 인기 TOP 10 */}
      {showTop10 && top10.length > 0 && (
        <div className="absolute top-36 right-3 z-10 bg-white rounded-2xl shadow-lg w-52 overflow-hidden border border-gray-100">
          <div className="flex items-center justify-between px-3 py-2 bg-orange-50 border-b border-orange-100">
            <div className="flex items-center gap-1.5">
              <Trophy size={13} className="text-orange-500" />
              <span className="text-xs font-bold text-orange-600">이 지역 인기 TOP {top10.length}</span>
            </div>
            <button onClick={() => setShowTop10(false)} className="text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          </div>
          <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
            {top10.map((r, i) => (
              <div key={r.kakao_id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                onClick={() => setSelected({ ...r, place_name: r.name, y: r.lat, x: r.lng, road_address_name: r.address, category_name: r.category })}>
                <span className={`text-xs font-bold w-4 shrink-0 ${i < 3 ? 'text-orange-500' : 'text-gray-400'}`}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">{r.name}</p>
                  <p className="text-xs text-gray-400 truncate">{r.category?.split(' > ').slice(-1)[0]}</p>
                </div>
                <span className="text-xs text-blue-500 font-bold shrink-0">👍{r.votes_up}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showInstallBtn && (
        <button
          onClick={async () => {
            if (isIos) { setShowIosGuide(true); return }
            installPrompt.prompt()
            const { outcome } = await installPrompt.userChoice
            if (outcome === 'accepted') setInstalled(true)
            setInstallPrompt(null)
          }}
          className="absolute bottom-32 right-4 z-10 bg-orange-500 text-white rounded-full px-3 py-2 shadow-lg flex items-center gap-1.5 text-xs font-medium"
        >
          <Download size={14} />
          앱 설치
        </button>
      )}

      {showIosGuide && (
        <div className="absolute inset-0 z-30 flex items-end justify-center pb-10 px-4" onClick={() => setShowIosGuide(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <p className="font-bold text-gray-800 mb-3 text-base">홈 화면에 추가하기</p>
            <ol className="space-y-3 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="bg-orange-100 text-orange-600 rounded-full w-5 h-5 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">1</span>
                {isIosChrome
                  ? <span><strong>우측 상단 점 3개(⋮)</strong> 메뉴 → <strong>공유</strong> 탭</span>
                  : <span>하단 중앙 <strong>공유 버튼</strong> (□↑) 탭</span>}
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-orange-100 text-orange-600 rounded-full w-5 h-5 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">2</span>
                <span>스크롤해서 <strong>"홈 화면에 추가"</strong> 탭</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-orange-100 text-orange-600 rounded-full w-5 h-5 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">3</span>
                <span>오른쪽 위 <strong>"추가"</strong> 탭</span>
              </li>
            </ol>
            <button onClick={() => setShowIosGuide(false)}
              className="mt-4 w-full bg-orange-500 text-white rounded-xl py-2.5 text-sm font-semibold">
              확인
            </button>
          </div>
        </div>
      )}

      <button onClick={goToMyLocation}
        className="absolute right-4 z-10 bg-white rounded-full p-3 shadow-lg border border-gray-100"
        style={{ bottom: 'calc(72px + env(safe-area-inset-bottom))' }}>
        <LocateFixed size={20} className="text-orange-500" />
      </button>

      <button onClick={() => setShowAddModal(true)}
        className="absolute left-4 z-10 bg-orange-500 text-white rounded-full px-4 py-2.5 shadow-lg flex items-center gap-1.5 text-sm font-medium"
        style={{ bottom: 'calc(72px + env(safe-area-inset-bottom))' }}>
        <Plus size={16} />
        식당 등록
      </button>

      {showAddModal && <AddRestaurantModal onClose={() => { setShowAddModal(false); reloadMap() }} />}

      {selected && (
        <RestaurantDrawer
          restaurant={selected}
          onClose={() => setSelected(null)}
          myLocation={myLocation}
        />
      )}
    </div>
  )
}
