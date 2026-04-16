import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getDeviceId } from '../lib/deviceId'
import { X, PenLine, Heart, MessageSquare, Send, ChevronDown, ChevronUp } from 'lucide-react'

function timeAgo(d) {
  const diff = (new Date() - new Date(d)) / 60000
  const m = Math.floor(diff)
  if (m < 1) return '방금'
  if (m < 60) return `${m}분 전`
  if (m < 1440) return `${Math.floor(m / 60)}시간 전`
  return `${Math.floor(m / 1440)}일 전`
}

export default function FreeBoardModal({ onClose }) {
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

  async function fetchPosts() {
    setLoading(true)
    const { data } = await supabase.from('free_posts').select('*')
      .order('created_at', { ascending: false }).limit(50)
    setPosts(data || [])
    setLoading(false)
  }

  useEffect(() => {
    const init = async () => {
      await fetchPosts()
    }
    init()
  }, [])

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <PenLine size={16} className="text-blue-500" />
            <span className="font-bold text-gray-800">자유게시판</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowWrite(!showWrite)}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white text-xs rounded-full font-medium">
              <PenLine size={11} /> 글쓰기
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 글쓰기 폼 */}
        {showWrite && (
          <div className="px-4 py-3 border-b border-gray-100 shrink-0 bg-blue-50">
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="제목" maxLength={50}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 mb-2 bg-white" />
            <textarea value={content} onChange={(e) => setContent(e.target.value)}
              placeholder="점심 관련 이야기를 자유롭게 써보세요" maxLength={500} rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 resize-none mb-2 bg-white" />
            <div className="flex gap-2">
              <button onClick={() => setShowWrite(false)}
                className="flex-1 py-2.5 rounded-xl text-sm text-gray-400 border border-gray-200 bg-white">취소</button>
              <button onClick={submitPost} disabled={submitting || !title.trim() || !content.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-blue-500 text-white disabled:opacity-50">
                {submitting ? '등록 중...' : '등록하기'}
              </button>
            </div>
          </div>
        )}

        {/* 게시글 목록 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">💬</div>
              <p className="text-gray-400 text-sm">불러오는 중...</p>
            </div>
          )}
          {!loading && posts.length === 0 && (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">📝</div>
              <p className="text-gray-600 font-semibold mb-1">아직 게시글이 없어요</p>
              <p className="text-gray-400 text-sm">첫 번째 글을 작성해보세요!</p>
            </div>
          )}

          {posts.map((post) => {
            const isExpanded = expandedId === post.id
            const postComments = comments[post.id] || []
            const isMyPost = post.device_id === getDeviceId()

            return (
              <div key={post.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4">
                  <p className="font-bold text-gray-900 leading-tight mb-1">{post.title}</p>
                  <p className="text-sm text-gray-600 leading-relaxed line-clamp-3 mb-3">{post.content}</p>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{timeAgo(post.created_at)}</span>
                    {isMyPost && <span className="text-xs text-blue-400 font-medium">내 글</span>}
                    <div className="ml-auto flex items-center gap-3">
                      <button onClick={() => likePost(post.id, post.likes)}
                        className={`flex items-center gap-1 text-sm transition-colors ${myLikes[post.id] ? 'text-red-400' : 'text-gray-400 hover:text-red-400'}`}>
                        <Heart size={15} fill={myLikes[post.id] ? 'currentColor' : 'none'} />
                        <span className="font-medium">{post.likes || 0}</span>
                      </button>
                      <button onClick={() => toggleExpand(post.id)}
                        className="flex items-center gap-1 text-sm text-gray-400 hover:text-blue-500">
                        <MessageSquare size={15} />
                        <span className="font-medium">{post.comment_count || 0}</span>
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 p-4">
                    {postComments.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {postComments.map((c) => (
                          <div key={c.id} className="bg-white rounded-xl px-3 py-2.5 border border-gray-100">
                            <p className="text-sm text-gray-800">{c.content}</p>
                            <p className="text-xs text-gray-400 mt-1">{timeAgo(c.created_at)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input value={newComment[post.id] || ''}
                        onChange={(e) => setNewComment((p) => ({ ...p, [post.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && submitComment(post.id)}
                        placeholder="댓글을 남겨보세요"
                        maxLength={100}
                        className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
                      <button onClick={() => submitComment(post.id)}
                        disabled={submittingComment === post.id || !newComment[post.id]?.trim()}
                        className="bg-blue-500 text-white px-4 rounded-xl disabled:opacity-40">
                        <Send size={15} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
