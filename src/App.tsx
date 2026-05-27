import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Workshop from './pages/Workshop'
import Settings from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter basename="/poiece">
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="workshop" element={<Workshop />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
