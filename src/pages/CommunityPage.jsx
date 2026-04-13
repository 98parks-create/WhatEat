import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getDeviceId } from '../lib/deviceId'
import { MessageSquare, Star, MapPin, PenLine, Heart, Utensils, LocateFixed, Loader, Send, ThumbsUp, ThumbsDown, Plus } from 'lucide-react'
import RestaurantDetailModal from '../components/RestaurantDetailModal'
import AddRestaurantModal from '../components/AddRestaurantModal'

const CATEGORIES = ['전체', '한식', '중식', '일식', '양식', '분식']
const SORTS = [
  { key: 'votes', label: '추천순' },
  { key: 'latest', label: '최신순' },
]

const PROVINCE_LIST = ['전체', '내 주변', '서울', '경기', '부산', '인천', '대구', '대전', '광주', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주']

// 각 시/도별 주소에 포함될 수 있는 키워드 (full명 + 약칭 모두 커버)
const PROVINCE_SEARCH = {
  '서울': ['서울특별시', '서울'],
  '경기': ['경기도', '경기'],
  '부산': ['부산광역시', '부산'],
  '인천': ['인천광역시', '인천'],
  '대구': ['대구광역시', '대구'],
  '대전': ['대전광역시', '대전'],
  '광주': ['광주광역시'],  // 경기 광주시와 구별하기 위해 광역시만
  '울산': ['울산광역시', '울산'],
  '세종': ['세종특별자치시', '세종'],
  '강원': ['강원특별자치도', '강원도', '강원'],
  '충북': ['충청북도', '충북'],
  '충남': ['충청남도', '충남'],
  '전북': ['전북특별자치도', '전라북도', '전북'],
  '전남': ['전라남도', '전남'],
  '경북': ['경상북도', '경북'],
  '경남': ['경상남도', '경남'],
  '제주': ['제주특별자치도', '제주'],
}

const CITIES = {
  '서울': ['전체', '강남구', '강북구', '강서구', '관악구', '광진구', '구로구', '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구', '성북구', '송파구', '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구'],
  '경기': ['전체', '수원', '성남', '의정부', '안양', '부천', '광명', '평택', '안산', '고양', '과천', '구리', '남양주', '오산', '시흥', '군포', '하남', '용인', '파주', '이천', '김포', '화성', '광주시', '양주', '포천', '여주'],
  '부산': ['전체', '강서구', '금정구', '기장군', '남구', '동구', '동래구', '부산진구', '북구', '사상구', '사하구', '서구', '수영구', '연제구', '영도구', '중구', '해운대구'],
  '인천': ['전체', '계양구', '남동구', '동구', '미추홀구', '부평구', '서구', '연수구', '중구', '강화군'],
  '대구': ['전체', '남구', '달서구', '달성군', '동구', '북구', '서구', '수성구', '중구'],
  '대전': ['전체', '대덕구', '동구', '서구', '유성구', '중구'],
  '광주': ['전체', '광산구', '남구', '동구', '북구', '서구'],
  '울산': ['전체', '남구', '동구', '북구', '울주군', '중구'],
  '강원': ['전체', '춘천', '원주', '강릉', '동해', '태백', '속초', '삼척', '홍천', '횡성', '영월', '평창', '정선', '고성', '양양'],
  '충북': ['전체', '청주', '충주', '제천', '보은', '옥천', '영동', '진천', '괴산', '음성', '단양'],
  '충남': ['전체', '천안', '공주', '보령', '아산', '서산', '논산', '계룡', '당진', '부여', '서천', '청양', '홍성', '예산', '태안'],
  '전북': ['전체', '전주', '군산', '익산', '정읍', '남원', '김제', '완주', '진안', '무주', '장수', '임실', '순창', '고창', '부안'],
  '전남': ['전체', '목포', '여수', '순천', '나주', '광양', '담양', '곡성', '고흥', '보성', '화순', '장흥', '강진', '해남', '영암', '무안', '함평', '영광', '완도', '진도'],
  '경북': ['전체', '포항', '경주', '김천', '안동', '구미', '영주', '영천', '상주', '문경', '경산', '의성', '청송', '영덕', '고령', '성주', '칠곡', '예천', '봉화', '울진'],
  '경남': ['전체', '창원', '진주', '통영', '사천', '김해', '밀양', '거제', '양산', '의령', '함안', '창녕', '고성', '남해', '하동', '산청', '함양', '거창', '합천'],
  '제주': ['전체', '제주시', '서귀포시'],
}

function getDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

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

// ─── 맛집 공유 컬럼 ──────────────────────────────────────────────────────
function RestaurantColumn() {
  const [restaurants, setRestaurants] = useState([])
  const [reviews, setReviews] = useState({})
  const [category, setCategory] = useState('전체')
  const [sort, setSort] = useState('votes')
  const [loading, setLoading] = useState(true)
  const [myVotes, setMyVotes] = useState({})
  const [myLocation, setMyLocation] = useState(null)
  const [locating, setLocating] = useState(false)
  const [radius, setRadius] = useState(1)
  const [selectedProvince, setSelectedProvince] = useState('전체')
  const [selectedCity, setSelectedCity] = useState('전체')
  const [detailRestaurant, setDetailRestaurant] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)

  useEffect(() => { fetchRestaurants() }, [category, sort, selectedProvince, selectedCity, radius, myLocation])

  async function fetchRestaurants() {
    setLoading(true)
    try {
      let query = supabase.from('restaurants').select('*').not('kakao_id', 'like', 'geojip_%')
      if (category !== '전체') query = query.ilike('category', `%${category}%`)

      // 지역 필터
      if (selectedProvince === '내 주변') {
        // 위치 기반 필터는 클라이언트에서 처리
      } else if (selectedProvince !== '전체') {
        if (selectedCity !== '전체') {
          query = query.ilike('address', `%${selectedCity}%`)
        } else {
          const keys = PROVINCE_SEARCH[selectedProvince] || [selectedProvince]
          query = query.or(keys.map((k) => `address.ilike.%${k}%`).join(','))
        }
      }

      query = sort === 'votes'
        ? query.order('votes_up', { ascending: false })
        : query.order('created_at', { ascending: false })
      const { data, error } = await query.limit(200)
      if (error) throw error
      let list = data || []

      // 내 주변 모드: 클라이언트 거리 필터
      if (selectedProvince === '내 주변' && myLocation) {
        list = list.filter((r) => {
          if (!r.lat || !r.lng) return false
          return getDistanceKm(myLocation.lat, myLocation.lng, Number(r.lat), Number(r.lng)) <= radius
        })
      }

      setRestaurants(list)
      if (list.length) {
        const { data: rv } = await supabase.from('reviews').select('*')
          .in('kakao_id', list.map((r) => r.kakao_id))
          .order('created_at', { ascending: false })
        const grouped = {}
        rv?.forEach((r) => { if (!grouped[r.kakao_id]) grouped[r.kakao_id] = []; grouped[r.kakao_id].push(r) })
        setReviews(grouped)
      } else {
        setReviews({})
      }
    } catch (e) {
      console.error('맛집 목록 불러오기 실패:', e)
    } finally {
      setLoading(false)
    }
  }

  async function getMyLocation() {
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
      },
      () => { alert('위치 권한을 허용해주세요'); setLocating(false) }
    )
  }

  function selectProvince(p) {
    setSelectedProvince(p)
    setSelectedCity('전체')
    if (p === '내 주변' && !myLocation) getMyLocation()
  }

  async function voteRestaurant(r, type) {
    if (myVotes[r.kakao_id]) return
    setMyVotes((p) => ({ ...p, [r.kakao_id]: type }))
    const up = type === 'up' ? (r.votes_up || 0) + 1 : (r.votes_up || 0)
    const down = type === 'down' ? (r.votes_down || 0) + 1 : (r.votes_down || 0)
    setRestaurants((p) => p.map((x) => x.kakao_id === r.kakao_id ? { ...x, votes_up: up, votes_down: down } : x))
    await supabase.from('restaurants').update({ votes_up: up, votes_down: down }).eq('kakao_id', r.kakao_id)
  }


  return (
    <div className="flex flex-col h-full">
      {/* 컬럼 헤더 */}
      <div className="bg-orange-500 px-3 py-3 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Utensils size={14} className="text-white" />
            <span className="text-sm font-bold text-white">맛집 공유</span>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1 px-2.5 py-1 bg-white/20 text-white text-xs rounded-full font-medium border border-white/30"
          >
            <Plus size={11} /> 맛집 제보
          </button>
        </div>

        {/* 시/도 선택 */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide mb-1.5">
          {PROVINCE_LIST.map((p) => (
            <button key={p} onClick={() => selectProvince(p)}
              className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedProvince === p ? 'bg-white text-orange-600 font-bold' : 'bg-white/20 text-white'
              }`}>
              {p === '내 주변' && (locating ? <Loader size={10} className="animate-spin" /> : <LocateFixed size={10} />)}
              {p}
            </button>
          ))}
        </div>

        {/* 내 주변 반경 선택 */}
        {selectedProvince === '내 주변' && myLocation && (
          <div className="flex gap-1 overflow-x-auto scrollbar-hide mb-1.5">
            {[1, 3, 5, 10].map((km) => (
              <button key={km} onClick={() => setRadius(km)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  radius === km ? 'bg-white text-orange-600 font-bold' : 'bg-white/20 text-white'
                }`}>
                {km}km
              </button>
            ))}
          </div>
        )}

        {/* 시/군/구 선택 */}
        {selectedProvince !== '전체' && selectedProvince !== '내 주변' && CITIES[selectedProvince] && (
          <div className="flex gap-1 overflow-x-auto scrollbar-hide mb-1.5">
            {CITIES[selectedProvince].map((c) => (
              <button key={c} onClick={() => setSelectedCity(c)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedCity === c ? 'bg-white text-orange-600 font-bold' : 'bg-white/20 text-white'
                }`}>
                {c}
              </button>
            ))}
          </div>
        )}

        {/* 카테고리 + 정렬 */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategory(c)}
              className={`shrink-0 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                category === c ? 'bg-white text-orange-600 font-bold' : 'bg-white/20 text-white'
              }`}>
              {c}
            </button>
          ))}
          <div className="ml-auto flex shrink-0 bg-white/20 rounded-lg overflow-hidden">
            {SORTS.map((s) => (
              <button key={s.key} onClick={() => setSort(s.key)}
                className={`px-2 py-1 text-xs font-semibold transition-colors ${
                  sort === s.key ? 'bg-white text-orange-600' : 'text-white'
                }`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 목록 */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading && (
          <div className="text-center py-10">
            <div className="text-3xl mb-2">🍽️</div>
            <p className="text-gray-400 text-xs">불러오는 중...</p>
          </div>
        )}
        {!loading && restaurants.length === 0 && (
          <div className="text-center py-10">
            <div className="text-4xl mb-2">🗺️</div>
            <p className="text-gray-600 font-semibold text-sm mb-1">
              {selectedProvince === '내 주변'
                ? `${radius}km 내 맛집이 없어요`
                : selectedProvince !== '전체'
                  ? `${selectedCity !== '전체' ? selectedCity : selectedProvince} 맛집이 아직 없어요`
                  : '아직 등록된 맛집이 없어요'}
            </p>
            <p className="text-gray-400 text-xs">지도 탭에서 등록해보세요!</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {restaurants.map((r) => {
          const rviews = reviews[r.kakao_id] || []
          const myVote = myVotes[r.kakao_id]
          const catLabel = r.category?.split(' > ').slice(-1)[0] || '기타'
          const totalVotes = (r.votes_up || 0) + (r.votes_down || 0)
          const upPct = totalVotes ? Math.round(((r.votes_up || 0) / totalVotes) * 100) : 0

          return (
            <div key={r.kakao_id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden cursor-pointer active:opacity-80"
              onClick={() => setDetailRestaurant(r)}>
              {r.image_url && (
                <div className="w-full overflow-hidden bg-gray-100">
                  <img
                    src={r.image_url}
                    alt={r.name}
                    className="w-full h-auto"
                    onError={(e) => { e.currentTarget.parentElement.style.display = 'none' }}
                  />
                </div>
              )}
              <div className="p-3">
                <div className="flex items-start justify-between mb-1.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <h3 className="font-bold text-gray-900 text-sm">{r.name}</h3>
                      {(r.votes_up || 0) >= 5 && (
                        <span className="bg-yellow-400 text-white text-xs px-1.5 py-0.5 rounded-full flex items-center gap-0.5 font-semibold">
                          <Star size={9} fill="white" /> 인기
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getCatColor(r.category)}`}>{catLabel}</span>
                      <span className="text-xs text-gray-400 flex items-center gap-0.5 truncate">
                        <MapPin size={10} /> {r.address}
                      </span>
                    </div>
                  </div>
                </div>

                {totalVotes > 0 && (
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-blue-500 font-semibold">👍 {r.votes_up || 0}</span>
                      <span className="text-gray-400">{totalVotes}명</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${upPct}%` }} />
                    </div>
                  </div>
                )}

                {rviews.length > 0 && (
                  <div className="bg-orange-50 border border-orange-100 rounded-lg px-2.5 py-2 mb-2">
                    <p className="text-xs text-gray-700 leading-relaxed line-clamp-2">
                      <span className="text-orange-400 font-bold">" </span>{rviews[0].content}<span className="text-orange-400 font-bold"> "</span>
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => voteRestaurant(r, 'up')} disabled={!!myVote}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      myVote === 'up' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-600 border-gray-200'
                    } disabled:cursor-default`}>
                    👍 {r.votes_up || 0}
                  </button>
                  <button onClick={() => voteRestaurant(r, 'down')} disabled={!!myVote}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      myVote === 'down' ? 'bg-red-400 text-white border-red-400' : 'bg-white text-gray-600 border-gray-200'
                    } disabled:cursor-default`}>
                    👎 {r.votes_down || 0}
                  </button>
                  <button onClick={() => setDetailRestaurant(r)}
                    className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-orange-500">
                    <MessageSquare size={13} />
                    {rviews.length > 0 && <span className="bg-orange-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold">{rviews.length}</span>}
                  </button>
                </div>
              </div>

            </div>
          )
        })}
        </div>
      </div>

      {detailRestaurant && (
        <RestaurantDetailModal
          restaurant={detailRestaurant}
          onClose={() => setDetailRestaurant(null)}
          onVote={(kakaoId, newVotes) => {
            setRestaurants((p) => p.map((x) =>
              x.kakao_id === kakaoId ? { ...x, votes_up: newVotes.up, votes_down: newVotes.down } : x
            ))
          }}
        />
      )}
      {showAddModal && (
        <AddRestaurantModal
          onClose={() => { setShowAddModal(false); fetchRestaurants() }}
        />
      )}
    </div>
  )
}

// ─── 자유게시판 컬럼 ──────────────────────────────────────────────────────
function FreeBoardColumn() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showWrite, setShowWrite] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [comments, setComments] = useState({})
  const [newComment, setNewComment] = useState({})
  const [submittingComment, setSubmittingComment] = useState(null)
  const [myLikes, setMyLikes] = useState({})

  useEffect(() => { fetchPosts() }, [])

  async function fetchPosts() {
    setLoading(true)
    const { data } = await supabase.from('free_posts').select('*')
      .order('created_at', { ascending: false }).limit(50)
    setPosts(data || [])
    setLoading(false)
  }

  async function submitPost() {
    if (!title.trim() || !content.trim()) return
    setSubmitting(true)
    const { data } = await supabase.from('free_posts').insert({
      title: title.trim(), content: content.trim(), device_id: getDeviceId(), likes: 0,
    }).select().single()
    if (data) { setPosts((p) => [data, ...p]); setTitle(''); setContent(''); setShowWrite(false) }
    setSubmitting(false)
  }

  async function fetchComments(postId) {
    const { data } = await supabase.from('post_comments').select('*')
      .eq('post_id', postId).order('created_at', { ascending: true })
    setComments((p) => ({ ...p, [postId]: data || [] }))
  }

  async function submitComment(postId) {
    const text = newComment[postId]?.trim()
    if (!text) return
    setSubmittingComment(postId)
    const { data } = await supabase.from('post_comments').insert({
      post_id: postId, content: text, device_id: getDeviceId(),
    }).select().single()
    if (data) {
      setComments((p) => ({ ...p, [postId]: [...(p[postId] || []), data] }))
      setNewComment((p) => ({ ...p, [postId]: '' }))
      setPosts((p) => p.map((post) => post.id === postId ? { ...post, comment_count: (post.comment_count || 0) + 1 } : post))
    }
    setSubmittingComment(null)
  }

  async function likePost(postId, currentLikes) {
    if (myLikes[postId]) return
    setMyLikes((p) => ({ ...p, [postId]: true }))
    const newLikes = (currentLikes || 0) + 1
    setPosts((p) => p.map((post) => post.id === postId ? { ...post, likes: newLikes } : post))
    await supabase.from('free_posts').update({ likes: newLikes }).eq('id', postId)
  }

  function toggleExpand(postId) {
    if (expandedId === postId) { setExpandedId(null) } else {
      setExpandedId(postId)
      if (!comments[postId]) fetchComments(postId)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* 컬럼 헤더 */}
      <div className="bg-blue-500 px-3 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <PenLine size={14} className="text-white" />
            <span className="text-sm font-bold text-white">자유게시판</span>
          </div>
          <button onClick={() => setShowWrite(!showWrite)}
            className="flex items-center gap-1 px-2.5 py-1 bg-white/20 text-white text-xs rounded-full font-medium">
            <PenLine size={11} /> 글쓰기
          </button>
        </div>
      </div>

      {showWrite && (
        <div className="bg-white border-b border-gray-200 p-3 shrink-0">
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="제목" maxLength={50}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400 mb-1.5" />
          <textarea value={content} onChange={(e) => setContent(e.target.value)}
            placeholder="내용을 입력하세요" maxLength={500} rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400 resize-none mb-2" />
          <div className="flex gap-1.5">
            <button onClick={() => setShowWrite(false)}
              className="flex-1 py-2 rounded-lg text-xs text-gray-400 border border-gray-200">취소</button>
            <button onClick={submitPost} disabled={submitting || !title.trim() || !content.trim()}
              className="flex-1 py-2 rounded-lg text-xs font-bold bg-blue-500 text-white disabled:opacity-50">
              {submitting ? '등록 중...' : '등록'}
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {loading && (
          <div className="text-center py-10">
            <div className="text-3xl mb-2">💬</div>
            <p className="text-gray-400 text-xs">불러오는 중...</p>
          </div>
        )}
        {!loading && posts.length === 0 && (
          <div className="text-center py-10">
            <div className="text-4xl mb-2">📝</div>
            <p className="text-gray-600 font-semibold text-sm mb-1">아직 게시글이 없어요</p>
            <p className="text-gray-400 text-xs">첫 번째 글을 작성해보세요!</p>
          </div>
        )}

        {posts.map((post) => {
          const isExpanded = expandedId === post.id
          const postComments = comments[post.id] || []
          const isMyPost = post.device_id === getDeviceId()

          return (
            <div key={post.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-3">
                <p className="font-bold text-gray-900 text-sm leading-tight mb-1">{post.title}</p>
                <p className="text-xs text-gray-600 leading-relaxed line-clamp-2 mb-2">{post.content}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{timeAgo(post.created_at)}</span>
                  {isMyPost && <span className="text-xs text-blue-400 font-medium">내 글</span>}
                  <div className="ml-auto flex items-center gap-2">
                    <button onClick={() => likePost(post.id, post.likes)}
                      className={`flex items-center gap-0.5 text-xs transition-colors ${myLikes[post.id] ? 'text-red-400' : 'text-gray-400'}`}>
                      <Heart size={12} fill={myLikes[post.id] ? 'currentColor' : 'none'} />
                      <span className="font-medium">{post.likes || 0}</span>
                    </button>
                    <button onClick={() => toggleExpand(post.id)}
                      className="flex items-center gap-0.5 text-xs text-gray-400 hover:text-blue-500">
                      <MessageSquare size={12} />
                      <span className="font-medium">{post.comment_count || 0}</span>
                    </button>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50 p-3">
                  {postComments.length > 0 && (
                    <div className="space-y-1.5 mb-2">
                      {postComments.map((c) => (
                        <div key={c.id} className="bg-white rounded-lg px-3 py-2 border border-gray-100">
                          <p className="text-xs text-gray-800">{c.content}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{timeAgo(c.created_at)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-1.5">
                    <input value={newComment[post.id] || ''}
                      onChange={(e) => setNewComment((p) => ({ ...p, [post.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && submitComment(post.id)}
                      placeholder="댓글을 남겨보세요"
                      maxLength={100}
                      className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" />
                    <button onClick={() => submitComment(post.id)}
                      disabled={submittingComment === post.id || !newComment[post.id]?.trim()}
                      className="bg-blue-500 text-white px-3 rounded-lg disabled:opacity-40">
                      <Send size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── 메인 페이지 ────────────────────────────────────────────────────────
export default function CommunityPage() {
  return (
    <div className="flex flex-col h-full min-h-0">
      <RestaurantColumn />
    </div>
  )
}
