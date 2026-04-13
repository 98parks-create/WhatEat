// 네이버 지도 스크립트 로드 (지도 표시용)
export function loadNaverMapScript() {
  return new Promise((resolve, reject) => {
    if (window.naver?.maps) { resolve(); return }
    const script = document.createElement('script')
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${import.meta.env.VITE_NAVER_MAP_CLIENT_ID}`
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
}
