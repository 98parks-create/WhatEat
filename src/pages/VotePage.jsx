import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { searchNearbyRestaurants } from '../lib/kakao'
import { Users, Plus, Copy, Check, Crown, Share2 } from 'lucide-react'

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

const TEAMS_KEY = 'whateat_saved_teams'
function getSavedTeams() { return JSON.parse(localStorage.getItem(TEAMS_KEY) || '[]') }
function saveTeam(name, nicknames) {
  const teams = getSavedTeams().filter((t) => t.name !== name)
  teams.unshift({ name, nicknames, savedAt: Date.now() })
  localStorage.setItem(TEAMS_KEY, JSON.stringify(teams.slice(0, 5)))
}

export default function VotePage() {
  const [mode, setMode] = useState('home') // home | create | join | room
  const [roomCode, setRoomCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [savedTeams, setSavedTeams] = useState(getSavedTeams())
  const [room, setRoom] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [myVote, setMyVote] = useState(null)
  const [votes, setVotes] = useState({})
  const [members, setMembers] = useState([])
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)

  function getCurrentPosition() {
    return new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        reject
      )
    )
  }

  async function fetchCandidates(roomId) {
    const { data } = await supabase
      .from('room_candidates')
      .select('*')
      .eq('room_id', roomId)
    setCandidates(data || [])
  }

  async function fetchVotes(roomId) {
    const { data } = await supabase
      .from('room_votes')
      .select('candidate_id, nickname')
      .eq('room_id', roomId)

    const tally = {}
    const memberSet = new Set()
    data?.forEach((v) => {
      tally[v.candidate_id] = (tally[v.candidate_id] || 0) + 1
      memberSet.add(v.nickname)
    })
    setVotes(tally)
    setMembers([...memberSet])
  }

  async function fetchMembers(roomId) {
    const { data } = await supabase
      .from('room_votes')
      .select('nickname')
      .eq('room_id', roomId)
    const unique = [...new Set(data?.map((v) => v.nickname) || [])]
    setMembers(unique)
  }

  async function createRoom() {
    if (!nickname.trim()) return
    setLoading(true)
    const code = generateRoomCode()

    try {
      const pos = await getCurrentPosition()
      const restaurants = await searchNearbyRestaurants({
        lat: pos.lat, lng: pos.lng, radius: 800, dinnerMode: false,
      })
      const picked = restaurants.slice(0, 6)

      const { data: roomData } = await supabase
        .from('vote_rooms')
        .insert({ code, host_nickname: nickname, status: 'voting' })
        .select()
        .single()

      await supabase.from('room_candidates').insert(
        picked.map((r) => ({
          room_id: roomData.id,
          kakao_id: r.id,
          name: r.place_name,
          category: r.category_name?.split(' > ').slice(-1)[0],
          distance: r.distance,
          address: r.road_address_name,
        }))
      )

      // 팀 저장
      saveTeam(nickname + '팀', [nickname])
      setSavedTeams(getSavedTeams())

      setRoom(roomData)
      setRoomCode(code)
      setMode('room')
    } catch {
      alert('방 생성에 실패했어요.')
    }
    setLoading(false)
  }

  async function joinRoom() {
    if (!nickname.trim() || !joinCode.trim()) return
    setLoading(true)

    const { data } = await supabase
      .from('vote_rooms')
      .select('*')
      .eq('code', joinCode.toUpperCase())
      .single()

    if (!data) {
      alert('방을 찾을 수 없어요.')
      setLoading(false)
      return
    }

    setRoom(data)
    setRoomCode(data.code)
    setMode('room')
    setLoading(false)
  }

  // 실시간 투표 구독
  useEffect(() => {
    if (!room) return

    let activeChannel = null

    const init = async () => {
      activeChannel = supabase
        .channel(`room:${room.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'room_votes',
          filter: `room_id=eq.${room.id}`,
        }, () => {
          fetchVotes(room.id)
        })
        .subscribe()

      await fetchVotes(room.id)
      await fetchCandidates(room.id)
      await fetchMembers(room.id)
    }

    init()

    return () => {
      if (activeChannel) supabase.removeChannel(activeChannel)
    }
  }, [room])

  async function castVote(candidateId) {
    if (!room || !nickname.trim()) return
    const prevVote = myVote
    setMyVote(candidateId)

    try {
      if (prevVote) {
        await supabase.from('room_votes').delete().eq('room_id', room.id).eq('nickname', nickname)
      }
      await supabase.from('room_votes').insert({
        room_id: room.id,
        candidate_id: candidateId,
        nickname: nickname,
      })
      fetchVotes(room.id)
    } catch {
      alert('투표에 실패했어요.')
      setMyVote(prevVote)
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(roomCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function shareRoom() {
    const shareUrl = `${window.location.origin}/vote?code=${roomCode}`
    if (navigator.share) {
      navigator.share({
        title: '오늘 점심 뭐 먹지? 투표참여',
        text: `[WhatEat] ${nickname}님이 초대했어요! 코드: ${roomCode}`,
        url: shareUrl,
      })
    } else {
      copyCode()
      alert('공유 링크가 클립보드에 복사되었어요.')
    }
  }


  const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0)
  const winner = candidates.reduce(
    (top, c) => (!top || (votes[c.id] || 0) > (votes[top.id] || 0) ? c : top),
    null
  )

  // 홈 화면
  if (mode === 'home') {
    return (
      <div className="p-6 max-w-md mx-auto pt-8 pb-20">
        <div className="text-center mb-8">
          <Users size={48} className="mx-auto text-orange-400 mb-3" />
          <h2 className="text-2xl font-bold text-gray-900">팀 점심 투표</h2>
          <p className="text-sm text-gray-400 mt-1">팀원들과 함께 점심을 결정해요</p>
        </div>

        <button
          onClick={() => setMode('create')}
          className="w-full bg-orange-500 text-white py-4 rounded-2xl font-bold text-base mb-3"
        >
          새 투표방 만들기
        </button>
        <button
          onClick={() => setMode('join')}
          className="w-full bg-white border-2 border-orange-200 text-orange-500 py-4 rounded-2xl font-bold text-base mb-6"
        >
          코드로 참여하기
        </button>

        {/* 저장된 팀 */}
        {savedTeams.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-2">최근 팀</p>
            <div className="space-y-2">
              {savedTeams.map((t, i) => (
                <button
                  key={i}
                  onClick={() => { setNickname(t.nicknames[0] || ''); setMode('create') }}
                  className="w-full text-left bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">{t.name}</p>
                    <p className="text-xs text-gray-400">눌러서 이 닉네임으로 시작</p>
                  </div>
                  <span className="text-orange-400 text-sm">→</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // 방 만들기
  if (mode === 'create') {
    return (
      <div className="p-6 max-w-md mx-auto pt-8 pb-20">
        <h2 className="text-xl font-bold mb-6">투표방 만들기</h2>
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-600 mb-1 block">닉네임</label>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="방장 닉네임"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400"
          />
        </div>
        <p className="text-xs text-gray-400 mb-6">
          현재 위치 기준 주변 식당 6곳을 자동으로 후보에 올려요.
        </p>
        <button
          onClick={createRoom}
          disabled={loading || !nickname.trim()}
          className="w-full bg-orange-500 text-white py-4 rounded-2xl font-bold disabled:opacity-50"
        >
          {loading ? '생성 중...' : '방 만들기'}
        </button>
        <button onClick={() => setMode('home')} className="w-full py-3 text-sm text-gray-400 mt-2">
          취소
        </button>
      </div>
    )
  }

  // 방 참여
  if (mode === 'join') {
    return (
      <div className="p-6 max-w-md mx-auto pt-8 pb-20">
        <h2 className="text-xl font-bold mb-6">투표방 참여</h2>
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-600 mb-1 block">닉네임</label>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="내 닉네임"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400"
          />
        </div>
        <div className="mb-6">
          <label className="text-sm font-medium text-gray-600 mb-1 block">방 코드</label>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="6자리 코드 입력"
            maxLength={6}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400 tracking-widest font-mono text-center text-lg"
          />
        </div>
        <button
          onClick={joinRoom}
          disabled={loading || !nickname.trim() || joinCode.length < 6}
          className="w-full bg-orange-500 text-white py-4 rounded-2xl font-bold disabled:opacity-50"
        >
          {loading ? '참여 중...' : '참여하기'}
        </button>
        <button onClick={() => setMode('home')} className="w-full py-3 text-sm text-gray-400 mt-2">
          취소
        </button>
      </div>
    )
  }

  // 투표 방
  return (
    <div className="p-4 max-w-md mx-auto pb-20">
      {/* 방 코드 공유 */}
      <div className="bg-orange-50 rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-orange-400 font-medium">방 코드</p>
            <p className="text-2xl font-bold tracking-widest text-orange-600 font-mono">{roomCode}</p>
          </div>
          <p className="text-xs text-gray-400">{members.length}명 참여중</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={shareRoom}
            className="flex-1 flex items-center justify-center gap-1.5 bg-orange-500 text-white text-sm py-2.5 rounded-xl font-medium"
          >
            <Share2 size={14} />
            카카오톡으로 초대
          </button>
          <button
            onClick={copyCode}
            className="flex items-center gap-1.5 bg-white border border-orange-200 text-orange-500 text-sm px-4 py-2.5 rounded-xl font-medium"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? '복사됨' : '코드만 복사'}
          </button>
        </div>
      </div>

      {/* 현재 결과 */}
      {winner && totalVotes > 0 && (
        <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2.5 mb-4">
          <Crown size={16} className="text-yellow-500" />
          <span className="text-sm font-semibold text-yellow-700">현재 1위: {winner.name}</span>
        </div>
      )}

      {/* 후보 목록 */}
      <div className="space-y-3">
        {candidates.map((c) => {
          const count = votes[c.id] || 0
          const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0
          const isMyVote = myVote === c.id

          return (
            <button
              key={c.id}
              onClick={() => castVote(c.id)}
              className={`w-full text-left rounded-2xl border-2 p-4 transition-all ${
                isMyVote
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-100 bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-semibold text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-400">{c.category} · {c.distance}m</p>
                </div>
                <div className="text-right">
                  <span className={`text-lg font-bold ${isMyVote ? 'text-orange-500' : 'text-gray-400'}`}>
                    {count}표
                  </span>
                </div>
              </div>
              {/* 투표 바 */}
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isMyVote ? 'bg-orange-500' : 'bg-gray-300'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
