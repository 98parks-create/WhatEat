export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'id required' })

  try {
    // Naver Place 모바일 페이지 - Next.js SSR, __NEXT_DATA__ 포함
    const response = await fetch(
      `https://m.place.naver.com/restaurant/${id}/menu/list`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'ko-KR,ko;q=0.9',
          'Referer': 'https://m.place.naver.com/',
        },
      }
    )

    const html = await response.text()

    // __NEXT_DATA__ 에서 메뉴 데이터 추출
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
    if (!match) return res.status(404).json({ menus: [] })

    const nextData = JSON.parse(match[1])

    // 메뉴 데이터 경로 탐색
    const pageProps = nextData?.props?.pageProps
    const menuList =
      pageProps?.initialState?.menuList?.menuList ||
      pageProps?.menuList ||
      pageProps?.initialProps?.menuList ||
      []

    const menus = menuList.map((m) => ({
      name: m.menuName || m.name || '',
      price: m.price || m.menuPrice || '',
      image: m.image || m.menuImage || '',
      description: m.description || '',
    })).filter((m) => m.name)

    res.status(200).json({ menus, placeId: id })
  } catch (e) {
    res.status(500).json({ error: e.message, menus: [] })
  }
}
