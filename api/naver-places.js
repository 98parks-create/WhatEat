export default async function handler(req, res) {
  const { lat, lng, radius = 1000, keyword = '음식점' } = req.query

  try {
    const response = await fetch(
      `https://maps.apigw.ntruss.com/map-place/v1/search?query=${encodeURIComponent(keyword)}&coordinate=${lng},${lat}&radius=${radius}&language=ko`,
      {
        headers: {
          'X-NCP-APIGW-API-KEY-ID': process.env.NAVER_CLIENT_ID,
          'X-NCP-APIGW-API-KEY': process.env.NAVER_CLIENT_SECRET,
        },
      }
    )

    if (!response.ok) {
      const text = await response.text()
      console.error('Naver Places API error:', response.status, text)
      return res.status(response.status).json({ places: [] })
    }

    const data = await response.json()
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.json(data)
  } catch (e) {
    console.error('naver-places error:', e)
    res.status(500).json({ places: [], error: e.message })
  }
}
