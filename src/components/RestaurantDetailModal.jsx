import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getDeviceId } from '../lib/deviceId'
import { X, MapPin, Star, Send, MessageSquare, ThumbsUp, ThumbsDown, Camera, ChevronLeft, ChevronRight } from 'lucide-react'

const CAT_COLORS = {
  '한식': 'bg-orange-100 text-orange-600',
  '중식': 'bg-red-100 text-red-600',
  '일식': 'bg-blue-100 text-blue-600',
  '양식': 'bg-purple-100 text-purple-600',
  '분식': 'bg-yellow-100 text-yellow-600',
  '카페': 'bg-green-100 text-green-600',
}
function getCatColor(cat) {
  const key = Object.keys(CAT_COLORS).find((k) => cat?.includes(k))
  return CAT_COLORS[key] || 'bg-gray-100 text-gray-500'
}
function timeAgo(d) {
  const m = Math.floor((Date.now() - new Date(d)) / 60000)
  if (m < 1) return '방금'
  if (m < 60) return `${m}분 전`
  if (m < 1440) return `${Math.floor(m / 60)}시간 전`
  return `${Math.floor(m / 1440)}일 전`
}

function processImage(file) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 1200
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX }
        else { width = Math.round(width * MAX / height); height = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.85)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

export default function RestaurantDetailModal({ restaurant: r, onClose, onVote }) {
  const [reviews, setReviews] = useState([])
  const [photos, setPhotos] = useState([])
  const [photoIdx, setPhotoIdx] = useState(0)
  const [loadingReviews, setLoadingReviews] = useState(true)
  const [newReview, setNewReview] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [myVote, setMyVote] = useState(null)
  const [votes, setVotes] = useState({ up: r.votes_up || 0, down: r.votes_down || 0 })
  const fileInputRef = useRef(null)

  const catLabel = r.category?.split(' > ').slice(-1)[0] || '기타'
  const totalVotes = votes.up + votes.down
  const upPct = totalVotes ? Math.round((votes.up / totalVotes) * 100) : 0

  useEffect(() => {
    fetchReviews()
    fetchPhotos()
  }, [])

  const kakaoId = r.kakao_id || r.id

  async function fetchPhotos() {
    if (!kakaoId) return
    const { data } = await supabase
      .from('restaurant_photos')
      .select('*')
      .eq('kakao_id', kakaoId)
      .order('created_at', { ascending: false })
    if (data && data.length > 0) {
      setPhotos(data.map((p) => p.url))
    } else if (r.image_url) {
      setPhotos([r.image_url])
    }
  }

  async function fetchReviews() {
    if (!kakaoId) return
    setLoadingReviews(true)
    const { data } = await supabase
      .from('reviews')
      .select('*')
      .eq('kakao_id', kakaoId)
      .order('created_at', { ascending: false })
    setReviews(data || [])
    setLoadingReviews(false)
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file || !kakaoId) return
    if (file.size > 10 * 1024 * 1024) { alert('10MB 이하 이미지만 업로드 가능해요'); return }
    setUploadingPhoto(true)
    const blob = await processImage(file)
    const path = `${kakaoId}_${Date.now()}.jpg`
    const { error } = await supabase.storage
      .from('restaurant-images')
      .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
    if (!error) {
      const { data: urlData } = supabase.storage.from('restaurant-images').getPublicUrl(path)
      const url = urlData.publicUrl
      await supabase.from('restaurant_photos').insert({ kakao_id: kakaoId, url, device_id: getDeviceId() })
      setPhotos((prev) => [url, ...prev])
      setPhotoIdx(0)
    }
    setUploadingPhoto(false)
    e.target.value = ''
  }

  async function submitReview() {
    const text = newReview.trim()
    if (!text || !kakaoId) return
    setSubmitting(true)
    const { data } = await supabase.from('reviews').insert({
      kakao_id: kakaoId,
      restaurant_name: r.name || r.place_name,
      content: text,
      device_id: getDeviceId(),
    }).select().single()
    if (data) { setReviews((prev) => [data, ...prev]); setNewReview('') }
    setSubmitting(false)
  }

  async function vote(type) {
    if (myVote === type || !kakaoId) return
    setMyVote(type)
    const newVotes = {
      up: type === 'up' ? votes.up + 1 : votes.up,
      down: type === 'down' ? votes.down + 1 : votes.down,
    }
    setVotes(newVotes)
    await supabase.from('restaurants').update({ votes_up: newVotes.up, votes_down: newVotes.down }).eq('kakao_id', kakaoId)
    onVote?.(kakaoId, newVotes)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[82vh]">

        {/* 사진 갤러리 */}
        <div className="relative w-full shrink-0 bg-black rounded-t-2xl sm:rounded-t-2xl overflow-hidden" style={{ maxHeight: 'min(60vw, 220px)', minHeight: '160px' }}>
          {photos.length > 0 ? (
            <>
              <img
                src={photos[photoIdx]}
                alt={r.name}
                className="w-full object-contain"
                style={{ maxHeight: 'min(60vw, 220px)', minHeight: '160px' }}
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
              {/* 이전/다음 */}
              {photos.length > 1 && (
                <>
                  <button
                    onClick={() => setPhotoIdx((i) => (i - 1 + photos.length) % photos.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1.5"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={() => setPhotoIdx((i) => (i + 1) % photos.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1.5"
                  >
                    <ChevronRight size={18} />
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {photos.map((_, i) => (
                      <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === photoIdx ? 'bg-white' : 'bg-white/40'}`} />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <Camera size={40} />
            </div>
          )}
          {/* 사진 추가 버튼 */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPhoto}
            className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2.5 py-1.5 rounded-full flex items-center gap-1.5 font-medium"
          >
            <Camera size={13} />
            {uploadingPhoto ? '업로드 중...' : '사진 추가'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />

          {/* 닫기 */}
          <button onClick={onClose} className="absolute top-2 left-2 bg-black/40 text-white rounded-full p-1.5">
            <X size={18} />
          </button>
        </div>

        {/* 식당 정보 */}
        <div className="px-4 pt-3 pb-3 border-b border-gray-100 shrink-0">
          <div className="flex items-start justify-between mb-1">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h2 className="font-bold text-gray-900 text-lg leading-tight">{r.name}</h2>
                {(r.votes_up || 0) >= 5 && (
                  <span className="bg-yellow-400 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-0.5 font-semibold shrink-0">
                    <Star size={10} fill="white" /> 인기
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getCatColor(r.category)}`}>{catLabel}</span>
                {r.address && (
                  <span className="text-xs text-gray-400 flex items-center gap-1 truncate">
                    <MapPin size={11} /> {r.address}
                  </span>
                )}
              </div>
            </div>
            {photos.length > 0 && (
              <span className="text-xs text-gray-400 shrink-0 ml-2">사진 {photos.length}장</span>
            )}
          </div>

          {/* 투표 */}
          {totalVotes > 0 && (
            <div className="flex items-center justify-between text-xs mb-1 mt-2">
              <span className="text-blue-500 font-semibold">👍 {votes.up}</span>
              <span className="text-gray-400">{totalVotes}명 평가</span>
            </div>
          )}
          {totalVotes > 0 && (
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${upPct}%` }} />
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => vote('up')} disabled={!!myVote}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                myVote === 'up' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-600 border-gray-200'
              } disabled:cursor-default`}>
              <ThumbsUp size={14} /> 가성비 좋아요 {votes.up}
            </button>
            <button onClick={() => vote('down')} disabled={!!myVote}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                myVote === 'down' ? 'bg-red-400 text-white border-red-400' : 'bg-white text-gray-600 border-gray-200'
              } disabled:cursor-default`}>
              <ThumbsDown size={14} /> 별로예요 {votes.down}
            </button>
          </div>
        </div>

        {/* 리뷰 목록 */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="flex items-center gap-1.5 mb-3">
            <MessageSquare size={14} className="text-gray-400" />
            <span className="text-sm font-semibold text-gray-700">
              리뷰 {!loadingReviews && reviews.length > 0 ? `(${reviews.length})` : ''}
            </span>
          </div>
          {loadingReviews && <div className="text-center py-8 text-gray-400 text-sm">불러오는 중...</div>}
          {!loadingReviews && reviews.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm">아직 리뷰가 없어요</p>
              <p className="text-gray-300 text-xs mt-1">첫 번째 리뷰를 남겨보세요!</p>
            </div>
          )}
          <div className="space-y-2">
            {reviews.map((rv) => (
              <div key={rv.id} className="bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-sm text-gray-800 leading-relaxed">{rv.content}</p>
                <p className="text-xs text-gray-400 mt-1.5">{timeAgo(rv.created_at)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 리뷰 입력 */}
        <div className="px-4 py-3 border-t border-gray-100 shrink-0">
          <div className="flex gap-2">
            <input
              value={newReview}
              onChange={(e) => setNewReview(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitReview()}
              placeholder="한 줄 리뷰를 남겨보세요"
              maxLength={80}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400"
            />
            <button onClick={submitReview} disabled={submitting || !newReview.trim()}
              className="bg-orange-500 text-white px-4 rounded-xl disabled:opacity-40">
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
