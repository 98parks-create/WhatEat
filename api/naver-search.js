export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { name, address } = req.query
  if (!name) return res.status(400).json({ error: 'name required' })
  const query = address ? `${name} ${address}` : name

  try {
    const response = await fetch(
      `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=5`,
      {
        headers: {
          'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET,
        },
      }
    )
    const data = await response.json()
    res.status(200).json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
