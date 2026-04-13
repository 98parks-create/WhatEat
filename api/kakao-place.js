export default async function handler(req, res) {
  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'id required' })

  try {
    const response = await fetch(`https://place.map.kakao.com/m/main/v/${id}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        'Referer': 'https://map.kakao.com/',
        'Accept': 'application/json, text/plain, */*',
      },
    })

    if (!response.ok) {
      return res.status(response.status).json({ menuList: [] })
    }

    const data = await response.json()

    // 카카오 Place API 응답에서 메뉴 추출 (응답 구조 여러 경로 시도)
    const menuList =
      data?.menuInfo?.menuList ||
      data?.basicInfo?.menuInfo?.menuList ||
      data?.menuinfo?.menuList ||
      []

    const cleaned = menuList.map((m) => ({
      name: m.menu || m.name || '',
      price: m.price || '',
    })).filter((m) => m.name)

    res.setHeader('Access-Control-Allow-Origin', '*')
    res.json({ menuList: cleaned })
  } catch (e) {
    res.status(500).json({ menuList: [], error: e.message })
  }
}
