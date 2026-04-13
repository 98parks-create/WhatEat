import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { MapPin, Shuffle, Users, BookOpen, X, Utensils, PenLine } from 'lucide-react'
import FreeBoardModal from './FreeBoardModal'

const navItems = [
  { to: '/', icon: MapPin, label: '지도' },
  { to: '/roulette', icon: Shuffle, label: '룰렛' },
  { to: '/community', icon: Utensils, label: '맛집' },
  { to: '/vote', icon: Users, label: '팀투표' },
  { to: '/record', icon: BookOpen, label: '기록' },
]

function useLunchBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const h = new Date().getHours()
    const m = new Date().getMinutes()
    const isLunchTime = (h === 11 && m >= 30) || h === 12 || (h === 13 && m <= 30)
    const dismissed = sessionStorage.getItem('whateat_banner_dismissed')
    if (isLunchTime && !dismissed) setShow(true)
  }, [])

  function dismiss() {
    sessionStorage.setItem('whateat_banner_dismissed', '1')
    setShow(false)
  }

  return { show, dismiss }
}

export default function Layout({ children }) {
  const { show: showBanner, dismiss } = useLunchBanner()
  const [showFreeBoard, setShowFreeBoard] = useState(false)

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-50">
        <div className="flex items-center justify-between mb-1.5">
          <NavLink to="/" className="text-lg font-bold text-orange-500 active:opacity-70">
            🍱 WhatEat
          </NavLink>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFreeBoard(true)}
              className="flex items-center gap-1.5 text-sm bg-blue-500 text-white px-3 py-2 rounded-full font-bold active:opacity-70 shadow-sm">
              <PenLine size={13} /> 자유게시판
            </button>
            <NavLink to="/community"
              className="flex items-center gap-1.5 text-sm bg-orange-500 text-white px-3 py-2 rounded-full font-bold active:opacity-70 shadow-sm">
              ✍️ 맛집 제보하기
            </NavLink>
          </div>
        </div>
        <p className="text-sm text-gray-400 leading-snug">
          📍 우리 회사 근처 맛집을 공유해서 동료들의 점심 고민을 해결해줘요
        </p>
      </header>

      {/* 점심시간 배너 */}
      {showBanner && (
        <div className="bg-orange-500 text-white px-4 py-2.5 flex items-center justify-between z-40">
          <div className="flex items-center gap-2">
            <span className="text-lg">🕛</span>
            <p className="text-sm font-medium">점심시간이에요! 오늘 뭐 먹을지 골라봐요</p>
          </div>
          <button onClick={dismiss} className="text-orange-200 ml-2 shrink-0">
            <X size={16} />
          </button>
        </div>
      )}

      {/* 본문 */}
      <main className="flex-1 flex flex-col min-h-0">{children}</main>

      {/* 하단 네비게이션 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex z-50">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2 gap-0.5 text-xs transition-colors ${
                isActive ? 'text-orange-500' : 'text-gray-400'
              }`
            }
          >
            <Icon size={22} />
            {label}
          </NavLink>
        ))}
      </nav>

      {showFreeBoard && <FreeBoardModal onClose={() => setShowFreeBoard(false)} />}
    </div>
  )
}
