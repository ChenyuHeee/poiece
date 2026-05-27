import { HashRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Workshop from './pages/Workshop'
import Settings from './pages/Settings'
import Archives from './pages/Archives'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="workshop" element={<Workshop />} />
          <Route path="settings" element={<Settings />} />
          <Route path="archives" element={<Archives />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
