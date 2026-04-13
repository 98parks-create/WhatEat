import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getDeviceId } from '../lib/deviceId'
import { isFavorite, toggleFavorite } from '../lib/favorites'
import { estimatePriceRange } from '../lib/price'
import { X, ThumbsUp, ThumbsDown, Star, Flame, Bookmark, Plus, Trash2, MessageSquare, Send } from 'lucide-react'

export default function RestaurantDrawer({ restaurant: r, onClose, myLocation }) {
  const [votes, setVotes] = useState({ up: r.votes_up || 0, down: r.votes_down || 0 })
  const [myVote, setMyVote] = useState(null)
  const [menus, setMenus] = useState(null)
  const [fav, setFav] = useState(isFavorite(r.kakao_id || r.id))
  const [added, setAdded] = useState(false)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [newMenu, setNewMenu] = useState({ name: '', price: '', calories: '' })
  const [savingMenu, setSavingMenu] = useState(false)
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

  useEffect(() => {
    setMenus(null)
    setShowAddMenu(false)
    setComments([])
    setNewComment('')
    fetchMenus()
    fetchComments()
    setFav(isFavorite(r.kakao_id || r.id))
  }, [r])

  async function fetchMenus() {
    const kakaoId = r.kakao_id || r.id
    if (!kakaoId) return
    const { data } = await supabase
      .from('restaurant_menus')
      .select('*')
      .eq('kakao_id', kakaoId)
      .order('created_at', { ascending: true })
      .limit(10)
    setMenus(data || [])
  }

  async function fetchComments() {
    const kakaoId = r.kakao_id || r.id
    if (!kakaoId) return
    const { data } = await supabase
      .from('reviews')
      .select('*')
      .eq('kakao_id', kakaoId)
      .order('created_at', { ascending: false })
      .limit(20)
    setComments(data || [])
  }

  async function submitComment() {
    const text = newComment.trim()
    if (!text) return
    setSubmittingComment(true)
    const kakaoId = r.kakao_id || r.id
    const { data } = await supabase.from('reviews').insert({
      kakao_id: kakaoId,
      restaurant_name: r.place_name || r.name,
      content: text,
      device_id: getDeviceId(),
    }).select().single()
    if (data) {
      setComments((prev) => [data, ...prev])
      setNewComment('')
    }
    setSubmittingComment(false)
  }

  async function saveMenu() {
    if (!newMenu.name.trim()) return
    setSavingMenu(true)
    const kakaoId = r.kakao_id || r.id
    await supabase.from('restaurants').upsert({
      kakao_id: kakaoId,
      name: r.place_name || r.name,
      address: r.road_address_name || r.address_name || r.address,
      category: r.category_name || r.category,
      lat: r.y || r.lat,
      lng: r.x || r.lng,
      ...(r.place_url && { place_url: r.place_url }),
    })
    await supabase.from('restaurant_menus').insert({
      kakao_id: kakaoId,
      menu_name: newMenu.name,
      price: newMenu.price ? Number(newMenu.price) : null,
      calories: newMenu.calories ? Number(newMenu.calories) : null,
    })
    setSavingMenu(false)
    setShowAddMenu(false)
    setNewMenu({ name: '', price: '', calories: '' })
    fetchMenus()
  }

  async function deleteMenu(id) {
    await supabase.from('restaurant_menus').delete().eq('id', id)
    setMenus((p) => p.filter((m) => m.id !== id))
  }

  async function vote(type) {
    if (myVote === type) return
    setMyVote(type)
    const newVotes = {
      up: type === 'up' ? votes.up + 1 : votes.up,
      down: type === 'down' ? votes.down + 1 : votes.down,
    }
    setVotes(newVotes)
    await supabase.from('restaurants').upsert({
      kakao_id: r.kakao_id || r.id,
      name: r.place_name || r.name,
      address: r.road_address_name || r.address_name || r.address,
      category: r.category_name || r.category,
      lat: r.y || r.lat,
      lng: r.x || r.lng,
      votes_up: newVotes.up,
      votes_down: newVotes.down,
      ...(r.place_url && { place_url: r.place_url }),
    })
  }

  async function addToRecord() {
    if (added) return
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('meal_records').insert({
      kakao_id: r.kakao_id || r.id,
      restaurant_name: r.place_name || r.name,
      category: r.category_name || r.category,
      date: today,
      device_id: getDeviceId(),
    })
    setAdded(true)
  }

  function handleFav() {
    const result = toggleFavorite(r)
    setFav(result)
  }

  function timeAgo(d) {
    const m = Math.floor((Date.now() - new Date(d)) / 60000)
    if (m < 1) return '방금'
    if (m < 60) return `${m}분 전`
    if (m < 1440) return `${Math.floor(m / 60)}시간 전`
    return `${Math.floor(m / 1440)}일 전`
  }

  const distance = r.distance ? `${r.distance}m` : ''
  const categoryLabel = (r.category_name || r.category)?.split(' > ').slice(-1)[0]
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  const detailHref = (() => {
    const kakaoId = r.kakao_id || r.id
    const q = encodeURIComponent((r.place_name || r.name) + ' ' + (r.road_address_name || r.address_name || ''))
    if (isMobile) {
      if (r.place_url) return r.place_url
      if (kakaoId && !String(kakaoId).startsWith('geojip_')) {
        return `https://place.map.kakao.com/${kakaoId}`
      }
    }
    return `https://map.naver.com/p/search/${q}`
  })()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto shadow-2xl">

        {/* 헤더 */}
        <div className="flex items-start justify-between px-5 pt-5 pb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg text-gray-900 leading-tight">{r.place_name || r.name}</h3>
              {r._isGeojip && <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full shrink-0">💰 가성비</span>}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {categoryLabel && (
                <span className="text-xs bg-orange-50 text-orange-500 font-medium px-2 py-0.5 rounded-full">{categoryLabel}</span>
              )}
              {distance && <span className="text-xs text-gray-400">{distance}</span>}
            </div>
          </div>
          <div className="flex items-center gap-0.5 ml-2 shrink-0">
            <button onClick={handleFav} className={`p-2 rounded-full transition-colors ${fav ? 'text-yellow-400' : 'text-gray-300 hover:text-gray-400'}`}>
              <Bookmark size={20} fill={fav ? 'currentColor' : 'none'} />
            </button>
            <button onClick={onClose} className="p-2 text-gray-300 hover:text-gray-500">
              <X size={20} />
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-400 px-5 pb-2">{r.road_address_name || r.address_name || r.address}</p>
        {r._isGeojip && r.note && (
          <p className="text-xs text-green-700 bg-green-50 mx-5 mb-3 px-3 py-2 rounded-lg leading-relaxed">💬 {r.note}</p>
        )}

        <div className="px-5 pb-5 space-y-3">
          {/* 메뉴 정보 */}
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1">
                <Flame size={13} className="text-orange-500" />
                <span className="text-xs font-semibold text-gray-700">메뉴 · 가격</span>
              </div>
              <button
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="flex items-center gap-0.5 text-xs text-orange-500 bg-orange-50 px-2 py-1 rounded-lg"
              >
                <Plus size={11} /> 메뉴 추가
              </button>
            </div>

            {menus === null ? (
              <p className="text-xs text-gray-400 text-center py-2">불러오는 중...</p>
            ) : menus.length > 0 ? (
              <div>
                {menus.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0 group">
                    <span className="text-sm text-gray-800 font-medium">{m.menu_name}</span>
                    <div className="flex items-center gap-2">
                      {m.price && <span className="text-sm text-blue-500 font-semibold">{Number(m.price).toLocaleString()}원</span>}
                      {m.calories && <span className="text-xs text-orange-500 font-bold">{m.calories}kcal</span>}
                      <button onClick={() => deleteMenu(m.id)} className="text-gray-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-2">
                <p className="text-xs text-gray-400">아직 메뉴 정보가 없어요</p>
                <p className="text-xs text-gray-300 mt-0.5">
                  예상 가격대: <span className="text-blue-400 font-medium">{estimatePriceRange(r.category_name || r.category)}</span>
                </p>
              </div>
            )}

            {showAddMenu && (
              <div className="mt-2 pt-2 border-t border-gray-200 flex flex-col gap-2">
                <input
                  value={newMenu.name}
                  onChange={(e) => setNewMenu({ ...newMenu, name: e.target.value })}
                  placeholder="메뉴명 (예: 김치찌개)"
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-orange-400"
                />
                <div className="flex gap-2">
                  <input
                    value={newMenu.price}
                    onChange={(e) => setNewMenu({ ...newMenu, price: e.target.value })}
                    placeholder="가격 (원)"
                    type="number"
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-orange-400"
                  />
                  <input
                    value={newMenu.calories}
                    onChange={(e) => setNewMenu({ ...newMenu, calories: e.target.value })}
                    placeholder="칼로리"
                    type="number"
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-orange-400"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowAddMenu(false)} className="flex-1 py-2.5 text-sm text-gray-400 border border-gray-200 rounded-lg">취소</button>
                  <button
                    onClick={saveMenu}
                    disabled={savingMenu || !newMenu.name.trim()}
                    className="flex-1 py-2.5 text-sm bg-orange-500 text-white rounded-lg disabled:opacity-50"
                  >
                    {savingMenu ? '저장 중...' : '저장'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 가성비 투표 */}
          <div className="flex gap-2">
            <button
              onClick={() => vote('up')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                myVote === 'up' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              <ThumbsUp size={15} /> 가성비 좋아요 {votes.up}
            </button>
            <button
              onClick={() => vote('down')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                myVote === 'down' ? 'bg-red-400 text-white border-red-400' : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              <ThumbsDown size={15} /> 별로예요 {votes.down}
            </button>
          </div>

          {/* 액션 버튼 */}
          <div className="flex gap-2">
            <button
              onClick={addToRecord}
              disabled={added}
              className={`flex-1 py-3 rounded-xl font-medium text-sm transition-colors ${
                added ? 'bg-green-100 text-green-600' : 'bg-orange-500 text-white'
              }`}
            >
              {added ? '✓ 기록 완료' : '오늘 먹었어요'}
            </button>
            <a
              href={detailHref}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-4 py-3 rounded-xl border-2 border-gray-200 text-sm text-gray-600 font-medium hover:border-orange-300 hover:text-orange-500 transition-colors"
            >
              <Star size={15} /> 상세정보
            </a>
          </div>

          {/* 댓글 */}
          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center gap-1.5 mb-3">
              <MessageSquare size={14} className="text-gray-400" />
              <span className="text-xs font-semibold text-gray-600">한 줄 후기 {comments.length > 0 ? `(${comments.length})` : ''}</span>
            </div>

            {comments.length > 0 && (
              <div className="space-y-2 mb-3">
                {comments.map((c) => (
                  <div key={c.id} className="bg-gray-50 rounded-xl px-3 py-2.5">
                    <p className="text-sm text-gray-800 leading-relaxed">{c.content}</p>
                    <p className="text-xs text-gray-400 mt-1">{timeAgo(c.created_at)}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitComment()}
                placeholder="이 식당 어떠셨나요?"
                maxLength={80}
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-orange-400"
              />
              <button
                onClick={submitComment}
                disabled={submittingComment || !newComment.trim()}
                className="bg-orange-500 text-white px-3 rounded-xl disabled:opacity-40"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
