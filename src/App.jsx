import { useEffect, useState } from 'react'
import OBR from '@owlbear-rodeo/sdk'

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
    return (
      <div style={{ padding: 20, color: 'white', background: '#1a1a1a', height: '100vh' }}>
        Loading WarpSong...
      </div>
    )
  }

  return (
    <div style={{ padding: 20, color: 'white', background: '#1a1a1a', height: '100vh', fontFamily: 'sans-serif' }}>
      <h2 style={{ margin: 0, marginBottom: 12 }}>WarpSong</h2>
      <p>Role: <b>{role}</b></p>
      <p style={{ opacity: 0.7, fontSize: 14 }}>
        Базовий скелет готовий. Далі додамо папки, стріми і YouTube.
      </p>
    </div>
  )
}

export default App
