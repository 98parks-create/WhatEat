const KEY = 'whateat_favorites'

export function getFavorites() {
  return JSON.parse(localStorage.getItem(KEY) || '[]')
}

export function isFavorite(kakaoId) {
  return getFavorites().some((f) => f.kakao_id === kakaoId)
}

export function toggleFavorite(restaurant) {
  const favs = getFavorites()
  const exists = favs.find((f) => f.kakao_id === (restaurant.kakao_id || restaurant.id))
  if (exists) {
    localStorage.setItem(KEY, JSON.stringify(favs.filter((f) => f.kakao_id !== exists.kakao_id)))
    return false
  } else {
    favs.push({
      kakao_id: restaurant.kakao_id || restaurant.id,
      name: restaurant.place_name || restaurant.name,
      category: restaurant.category_name || restaurant.category,
      address: restaurant.road_address_name || restaurant.address,
    })
    localStorage.setItem(KEY, JSON.stringify(favs))
    return true
  }
}
