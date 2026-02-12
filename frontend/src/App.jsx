import { useState, useEffect } from 'react'
import Auth from './components/Auth'
import Chat from './components/Chat'
import { checkAuth } from './utils/api'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      checkAuth(token)
        .then(userData => {
          setUser(userData)
        })
        .catch(() => {
          localStorage.removeItem('token')
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      setLoading(false)
    }
  }, [])

  const handleLogin = (userData, token) => {
    localStorage.setItem('token', token)
    setUser(userData)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setUser(null)
  }

  if (loading) {
    return (
      <div className="app" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '24px', color: '#888' }}>Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="app">
      {user ? (
        <Chat user={user} onLogout={handleLogout} />
      ) : (
        <Auth onLogin={handleLogin} />
      )}
    </div>
  )
}

export default App
