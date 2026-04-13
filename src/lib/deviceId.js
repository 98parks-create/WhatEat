// 기기별 고유 ID (로그인 없이 내 기록만 구분)
export function getDeviceId() {
  let id = localStorage.getItem('whateat_device_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('whateat_device_id', id)
  }
  return id
}
