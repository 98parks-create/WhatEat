import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getDeviceId } from '../lib/deviceId'
import { getFavorites, toggleFavorite } from '../lib/favorites'
import { Flame, Bookmark, Trash2, MapPin, AlertCircle } from 'lucide-react'

const DAYS = ['일', '월', '화', '수', '목', '금', '토']
const WEEK_DAYS = ['월', '화', '수', '목', '금', '토', '일']

const CAT_COLORS = {
  '한식': 'bg-orange-100 text-orange-700',
  '중식': 'bg-red-100 text-red-700',
  '일식': 'bg-blue-100 text-blue-700',
  '양식': 'bg-purple-100 text-purple-700',
  '분식': 'bg-yellow-100 text-yellow-700',
  '카페': 'bg-green-100 text-green-700',
}

function getThisWeekDates() {
  const today = new Date()
  const day = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

function getCatColor(cat) {
  const key = Object.keys(CAT_COLORS).find((k) => cat?.includes(k))
  return CAT_COLORS[key] || 'bg-gray-100 text-gray-600'
}

function formatDate(dateStr) {
  const d = new Date(dateStr)
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (dateStr === today) return '오늘'
  if (dateStr === yesterday) return '어제'
  return `${d.getMonth() + 1}/${d.getDate()}(${DAYS[d.getDay()]})`
}

export default function RecordPage() {
  const [records, setRecords] = useState([])
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const weekDates = getThisWeekDates()
  const todayStr = new Date().toISOString().split('T')[0]

  useEffect(() => {
    fetchRecords()
    setFavorites(getFavorites())
  }, [])

  async function fetchRecords() {
    const { data } = await supabase
      .from('meal_records').select('*')
      .eq('device_id', getDeviceId())
      .order('date', { ascending: false }).limit(60)
    setRecords(data || [])
    setLoading(false)
  }

  async function deleteRecord(id) {
    await supabase.from('meal_records').delete().eq('id', id)
    setRecords((p) => p.filter((r) => r.id !== id))
  }

  function handleUnfav(kakaoId) {
    toggleFavorite({ kakao_id: kakaoId })
    setFavorites(getFavorites())
  }

  const grouped = records.reduce((acc, r) => {
    if (!acc[r.date]) acc[r.date] = []
    acc[r.date].push(r)
    return acc
  }, {})

  const weekData = weekDates.reduce((acc, d) => {
    acc[d] = grouped[d] || []
    return acc
  }, {})

  // 경고: 연속 같은 카테고리
  function getWarning() {
    if (records.length < 3) return null
    const recent = records.slice(0, 5).map((r) => r.category?.split(' > ').slice(-1)[0] || '기타')
    let count = 1
    for (let i = 1; i < recent.length; i++) { if (recent[i] === recent[0]) count++; else break }
    return count >= 3 ? `${count}번 연속 ${recent[0]}` : null
  }

  const warning = getWarning()
  const thisWeekRecords = records.filter((r) => weekDates.includes(r.date))
  const catCount = {}
  thisWeekRecords.forEach((r) => { const c = r.category?.split(' > ').slice(-1)[0] || '기타'; catCount[c] = (catCount[c] || 0) + 1 })
  const topCat = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <p className="text-gray-400 text-sm">불러오는 중...</p>
    </div>
  )

  return (
    <div className="flex h-full min-h-0 pb-16">

      {/* ── 기록 컬럼 ── */}
      <div className="flex flex-col w-1/3 border-r border-gray-100 min-h-0">
        <div className="bg-orange-500 px-2 py-2.5 shrink-0">
          <p className="text-xs font-bold text-white">📋 기록</p>
          <p className="text-xs text-orange-100 mt-0.5">총 {records.length}번</p>
        </div>

        {warning && (
          <div className="flex items-center gap-1.5 bg-amber-50 border-b border-amber-100 px-2 py-2 shrink-0">
            <AlertCircle size={12} className="text-amber-500 shrink-0" />
            <p className="text-xs text-amber-700 leading-tight">{warning}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {records.length === 0 ? (
            <div className="text-center py-8 px-2">
              <div className="text-3xl mb-2">🍽️</div>
              <p className="text-xs text-gray-400">아직 기록이 없어요</p>
            </div>
          ) : (
            <div>
              {Object.entries(grouped).map(([date, items]) => (
                <div key={date}>
                  <div className="px-2 py-1.5 bg-gray-50 border-b border-gray-100">
                    <span className="text-xs font-bold text-gray-500">{formatDate(date)}</span>
                  </div>
                  {items.map((r) => {
                    const catLabel = r.category?.split(' > ').slice(-1)[0] || '기타'
                    return (
                      <div key={r.id} className="flex items-center gap-1.5 px-2 py-2 border-b border-gray-50">
                        <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ${getCatColor(r.category)}`}>
                          {catLabel}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{r.restaurant_name}</p>
                          {r.calories && (
                            <p className="text-xs text-orange-400 flex items-center gap-0.5">
                              <Flame size={9} /> {r.calories}kcal
                            </p>
                          )}
                        </div>
                        <button onClick={() => deleteRecord(r.id)} className="text-gray-200 hover:text-red-400 shrink-0 p-0.5">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 이번 주 컬럼 ── */}
      <div className="flex flex-col w-1/3 border-r border-gray-100 min-h-0">
        <div className="bg-blue-500 px-2 py-2.5 shrink-0">
          <p className="text-xs font-bold text-white">📅 이번 주</p>
          <p className="text-xs text-blue-100 mt-0.5">많이 먹은: {topCat}</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {weekDates.map((date, i) => {
            const items = weekData[date] || []
            const isToday = date === todayStr
            const isFuture = date > todayStr
            return (
              <div key={date} className={`px-2 py-2 border-b border-gray-50 ${isToday ? 'bg-orange-50' : ''}`}>
                <div className="flex items-center gap-1 mb-1">
                  <span className={`text-xs font-bold w-4 ${isToday ? 'text-orange-500' : 'text-gray-400'}`}>{WEEK_DAYS[i]}</span>
                  <span className={`text-xs font-bold ${isToday ? 'text-orange-500' : 'text-gray-600'}`}>
                    {new Date(date).getDate()}
                  </span>
                  {isToday && <span className="text-xs bg-orange-500 text-white px-1 py-0.5 rounded font-bold ml-auto">오늘</span>}
                </div>
                {items.length > 0 ? items.map((item, j) => (
                  <div key={j} className="flex items-center gap-1 mb-0.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${getCatColor(item.category)}`}>
                      {item.category?.split(' > ').slice(-1)[0] || '기타'}
                    </span>
                    <span className="text-xs text-gray-700 truncate">{item.restaurant_name}</span>
                  </div>
                )) : (
                  <p className="text-xs text-gray-300">{isFuture ? '예정 없음' : '기록 없음'}</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 즐겨찾기 컬럼 ── */}
      <div className="flex flex-col w-1/3 min-h-0">
        <div className="bg-yellow-400 px-2 py-2.5 shrink-0">
          <p className="text-xs font-bold text-white">🔖 즐겨찾기</p>
          <p className="text-xs text-yellow-100 mt-0.5">{favorites.length}개</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {favorites.length === 0 ? (
            <div className="text-center py-8 px-2">
              <div className="text-3xl mb-2">🔖</div>
              <p className="text-xs text-gray-400 leading-relaxed">지도에서 식당 클릭 후 북마크 버튼을 눌러요</p>
            </div>
          ) : (
            <div>
              {favorites.map((f) => (
                <div key={f.kakao_id} className="flex items-center gap-1.5 px-2 py-2 border-b border-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-800 truncate">{f.name}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-0.5 truncate">
                      <span className={`px-1.5 py-0.5 rounded-full ${getCatColor(f.category)} shrink-0`}>
                        {f.category?.split(' > ').slice(-1)[0] || '기타'}
                      </span>
                    </p>
                    <p className="text-xs text-gray-400 flex items-center gap-0.5 truncate mt-0.5">
                      <MapPin size={9} /> {f.address}
                    </p>
                  </div>
                  <button onClick={() => handleUnfav(f.kakao_id)}
                    className="text-yellow-400 hover:text-gray-300 p-0.5 shrink-0">
                    <Bookmark size={16} fill="currentColor" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
