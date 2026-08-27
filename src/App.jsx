import { useEffect, useState } from 'react'
import OBR from '@owlbear-rodeo/sdk'
import './App.css'

function App() {
  const [ready, setReady] = useState(false)
  const [role, setRole] = useState(null)

  useEffect(() => {
    OBR.onReady(async () => {
      setReady(true)
      const player = await OBR.player.getRole()
      setRole(player)
    })
  }, [])

  if (!ready) {
    return <div className="loading">Завантаження WarpSong...</div>
  }

  return (
    <div className="app">
      <header className="header">
        <h1>WarpSong</h1>
        <span className="role">{role === 'GM' ? 'GM' : 'Player'}</span>
      </header>

      <main className="main">
        <p>Скелет працює. Далі додамо папки, стріми і YouTube.</p>
        {role === 'GM' ? (
          <p>Ти ГМ — тут буде панель керування.</p>
        ) : (
          <p>Ти гравець — тут буде плеєр-в’ю.</p>
        )}
      </main>
    </div>
  )
}

export default App
