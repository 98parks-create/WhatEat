import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import MapPage from './pages/MapPage'
import RoulettePage from './pages/RoulettePage'
import VotePage from './pages/VotePage'
import RecordPage from './pages/RecordPage'
import CommunityPage from './pages/CommunityPage'

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/roulette" element={<RoulettePage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/vote" element={<VotePage />} />
          <Route path="/record" element={<RecordPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
