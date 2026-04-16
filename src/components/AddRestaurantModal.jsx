import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getDeviceId } from '../lib/deviceId'
import { Search, X, Plus, Trash2, Heart, Camera } from 'lucide-react'

export default function AddRestaurantModal({ onClose }) {
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(null)
  const [menus, setMenus] = useState([{ name: '', price: '', calories: '' }])
  const [image, setImage] = useState(null)      // File 객체
  const [imagePreview, setImagePreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const fileInputRef = useRef(null)
  const previewUrlRef = useRef(null)

  function processImage(file) {
    return new Promise((resolve) => {
      const img = new window.Image()
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
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.drawImage(img, 0, 0, width, height)
        URL.revokeObjectURL(url)
        
        if (canvas.toBlob) {
          canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', 0.85)
        } else {
          // toBlob 미지원 브라우저(일부 모바일) 대응
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
          const byteString = atob(dataUrl.split(',')[1])
          const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0]
          const ab = new ArrayBuffer(byteString.length)
          const ia = new Uint8Array(ab)
          for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i)
          resolve(new Blob([ab], { type: mimeString }))
        }
      }
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
      img.src = url
    })
  }

  function handleImageChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      alert('5MB 이하 이미지만 업로드 가능해요')
      return
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    const url = URL.createObjectURL(file)
    previewUrlRef.current = url
    setImage(file)
    setImagePreview(url)
  }

  function searchPlaces() {
    if (!keyword.trim() || !window.kakao) return
    const ps = new window.kakao.maps.services.Places()
    ps.keywordSearch(
      keyword,
      (data, status) => {
        if (status === window.kakao.maps.services.Status.OK) setResults(data.slice(0, 6))
        else setResults([])
      },
 { category_group_code: 'FD6' }
    )
  }

  async function save() {
    if (!selected) return alert('식당을 선택해주세요')
    if (saving) return
    setSaving(true)

    try {
      let imageUrl = null
      if (image) {
        const blob = await processImage(image)
        const path = `${selected.id}_${Date.now()}.jpg`
        const { error: uploadError } = await supabase.storage
          .from('restaurant-images')
          .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })

        if (uploadError) {
          console.error('Storage upload error:', uploadError)
          // 사진 업로드 실패해도 식당 등록은 계속 진행하도록 alert만 표시
          alert('사진 업로드 중 오류가 발생했습니다. (식당 정보만 등록됩니다)')
        } else {
          const { data: urlData } = supabase.storage
            .from('restaurant-images')
            .getPublicUrl(path)
          if (urlData) imageUrl = urlData.publicUrl
        }
 }

      const payload = {
        kakao_id: selected.id,
        name: selected.place_name,
        address: selected.road_address_name || selected.address_name,
        category: selected.category_name,
        lat: selected.y,
        lng: selected.x,
        ...(selected.place_url && { place_url: selected.place_url }),
        ...(imageUrl && { image_url: imageUrl }),
      }

      // 1. 식당 중복 확인 및 등록
      const { data: existing } = await supabase
        .from('restaurants')
        .select('id')
        .eq('kakao_id', selected.id)
        .maybeSingle()

      if (!existing) {
        // 존재하지 않을 때만 등록
        const { error: insError } = await supabase
          .from('restaurants')
          .insert(payload)
        
        if (insError && insError.code !== '23505') { // 23505: 중복 키 에러 (타이밍 이슈 대비)
          throw insError
        }
      }

      if (imageUrl) {
        await supabase.from('restaurant_photos').insert({
          kakao_id: selected.id,
          url: imageUrl,
          device_id: getDeviceId(),
        })
      }

      const validMenus = menus.filter((m) => m.name.trim())
      if (validMenus.length) {
        await supabase.from('restaurant_menus').insert(
          validMenus.map((m) => ({
            kakao_id: selected.id,
            menu_name: m.name,
            price: m.price ? Number(m.price) : null,
            calories: m.calories ? Number(m.calories) : null,
          }))
        )
      }

      setDone(true)
      setTimeout(onClose, 1500)
    } catch (err) {
      console.error('Restaurant save error:', err)
      alert('오류가 발생했습니다: ' + (err.message || '알 수 없는 오류'))
    } finally {
      setSaving(false)
    }
  }

  function addMenuRow() {
    if (menus.length >= 5) return
    setMenus([...menus, { name: '', price: '', calories: '' }])
  }

  function updateMenu(idx, field, value) {
    setMenus(menus.map((m, i) => (i === idx ? { ...m, [field]: value } : m)))
  }

  function removeMenu(idx) {
    if (menus.length <= 1) return
    setMenus(menus.filter((_, i) => i !== idx))
  }

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4 pt-10 pb-20 sm:p-0"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl w-full max-w-md max-h-full overflow-y-auto shadow-2xl relative flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="font-bold text-gray-900 text-lg">식당 등록</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 p-1">
            <X size={20} />
          </button>
        </div>

        {/* 유도 문구 */}
        {!done && (
          <div className="mx-5 mb-4 bg-orange-50 rounded-xl px-4 py-3 flex items-start gap-3">
            <Heart size={18} className="text-orange-400 shrink-0 mt-0.5" fill="currentColor" />
            <div>
              <p className="text-sm font-semibold text-orange-700">여러분의 맛집을 공유해주세요!</p>
              <p className="text-xs text-orange-400 mt-0.5">
                한 분의 등록이 수많은 직장인의 점심 선택지를 넓혀줘요.
                내가 자주 가는 식당을 공유해서 더 많은 사람들이 알게 해보세요 🍽️
              </p>
            </div>
          </div>
        )}

        <div className="px-5 pb-5">
          {done ? (
            <div className="text-center py-10">
              <div className="text-5xl mb-3">🎉</div>
              <p className="font-bold text-gray-800 text-lg">등록 완료!</p>
              <p className="text-sm text-gray-400 mt-2">
                소중한 맛집 정보를 공유해주셔서 감사해요.<br />
                더 많은 분들이 맛있는 점심을 먹을 수 있어요!
              </p>
            </div>
          ) : !selected ? (
            <>
              <p className="text-sm text-gray-500 mb-3">식당 이름으로 검색해서 등록해요</p>
              <div className="flex gap-2 mb-4">
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchPlaces()}
                  placeholder="식당명 검색 (예: 홍길동 순대국)"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                />
                <button
                  onClick={searchPlaces}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-4 rounded-xl"
                >
                  <Search size={16} />
                </button>
              </div>
              <div className="space-y-2">
                {results.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className="w-full text-left bg-gray-50 hover:bg-orange-50 rounded-xl px-4 py-3 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-800">{r.place_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {r.category_name?.split(' > ').slice(-1)[0]} · {r.road_address_name || r.address_name}
                    </p>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="bg-orange-50 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{selected.place_name}</p>
                  <p className="text-xs text-gray-400">{selected.road_address_name}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 ml-2">
                  <X size={16} />
                </button>
              </div>

              {/* 이미지 업로드 */}
              <p className="text-sm font-semibold text-gray-700 mb-2">
                식당 사진 <span className="text-xs font-normal text-gray-400">(선택사항)</span>
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
              {imagePreview ? (
                <div className="relative mb-4">
                  <img src={imagePreview} alt="preview" className="w-full h-40 object-cover rounded-xl" />
                  <button
                    onClick={() => { if (previewUrlRef.current) { URL.revokeObjectURL(previewUrlRef.current); previewUrlRef.current = null } setImage(null); setImagePreview(null) }}
                    className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-28 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-orange-300 hover:text-orange-400 transition-colors mb-4"
                >
                  <Camera size={24} />
                  <span className="text-sm">사진 추가하기</span>
                </button>
              )}

              {/* 메뉴 정보 */}
              <p className="text-sm font-semibold text-gray-700 mb-2">
                메뉴 정보 <span className="text-xs font-normal text-gray-400">(선택사항)</span>
              </p>
              <div className="space-y-3 mb-3">
                {menus.map((m, i) => (
                  <div key={i} className="flex flex-col gap-1.5">
                    <div className="flex gap-1.5 items-center">
                      <input
                        value={m.name}
                        onChange={(e) => updateMenu(i, 'name', e.target.value)}
                        placeholder="메뉴명"
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-orange-400 min-w-0"
                      />
                      <button onClick={() => removeMenu(i)} className="text-gray-300 hover:text-red-400 shrink-0 p-2">
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        value={m.price}
                        onChange={(e) => updateMenu(i, 'price', e.target.value)}
                        placeholder="가격 (원)"
                        type="number"
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                      />
                      <input
                        value={m.calories}
                        onChange={(e) => updateMenu(i, 'calories', e.target.value)}
                        placeholder="칼로리 (kcal)"
                        type="number"
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {menus.length < 5 && (
                <button
                  onClick={addMenuRow}
                  className="w-full flex items-center justify-center gap-1 text-xs text-orange-500 hover:text-orange-600 py-2 border border-dashed border-orange-300 hover:border-orange-400 rounded-xl mb-4 transition-colors"
                >
                  <Plus size={13} /> 메뉴 추가
                </button>
              )}

              <button
                onClick={save}
                disabled={saving}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3.5 rounded-xl font-bold disabled:opacity-50 transition-colors"
              >
                {saving ? '등록 중...' : '🍽️ 등록하기'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
