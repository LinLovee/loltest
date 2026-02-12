import { useState, useEffect } from 'react'
import { getUsers, searchUsers, getConversations } from '../utils/api'

function Sidebar({ user, onLogout, onSelectUser, onlineUsers, conversations, setConversations, hidden }) {
  const [view, setView] = useState('conversations') // 'conversations' or 'users'
  const [users, setUsers] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    if (view === 'users') {
      loadUsers()
    }
  }, [view])

  const loadConversations = async () => {
    try {
      const data = await getConversations()
      setConversations(data)
    } catch (error) {
      console.error('Failed to load conversations:', error)
    }
  }

  const loadUsers = async () => {
    setLoading(true)
    try {
      const data = await getUsers()
      setUsers(data)
    } catch (error) {
      console.error('Failed to load users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (query) => {
    setSearchQuery(query)
    if (query.trim() === '') {
      if (view === 'users') {
        loadUsers()
      }
      return
    }

    if (view === 'users') {
      setLoading(true)
      try {
        const data = await searchUsers(query)
        setUsers(data)
      } catch (error) {
        console.error('Search failed:', error)
      } finally {
        setLoading(false)
      }
    }
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now - date

    if (diff < 60000) return 'только что'
    if (diff < 3600000) return `${Math.floor(diff / 60000)} мин`
    if (diff < 86400000) {
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    }
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  }

  return (
    <div className={`sidebar ${hidden ? 'hidden' : ''}`}>
      <div className="sidebar-header">
        <h2>{user.username}</h2>
        <button onClick={onLogout} className="logout-btn">
          Выйти
        </button>
      </div>

      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={() => setView('conversations')}
          style={{
            padding: '8px 16px',
            marginRight: '8px',
            background: view === 'conversations' ? 'var(--accent)' : 'transparent',
            border: '1px solid var(--border)',
            color: 'white',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Чаты
        </button>
        <button
          onClick={() => setView('users')}
          style={{
            padding: '8px 16px',
            background: view === 'users' ? 'var(--accent)' : 'transparent',
            border: '1px solid var(--border)',
            color: 'white',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Все пользователи
        </button>
      </div>

      <div className="search-box">
        <input
          type="text"
          placeholder={view === 'conversations' ? 'Поиск чатов...' : 'Поиск пользователей...'}
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      {view === 'conversations' ? (
        <div className="conversations-list">
          {conversations.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Нет чатов. Начните общение!
            </div>
          ) : (
            conversations
              .filter(conv => 
                !searchQuery || 
                conv.other_username.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map(conv => (
                <div
                  key={conv.other_user_id}
                  className="conversation-item"
                  onClick={() => onSelectUser({ 
                    id: conv.other_user_id, 
                    username: conv.other_username 
                  })}
                >
                  <div className="conversation-header">
                    <span className="conversation-name">
                      {conv.other_username}
                      {onlineUsers.has(conv.other_user_id) && (
                        <span className="online-indicator"></span>
                      )}
                    </span>
                    <span className="conversation-time">
                      {formatTime(conv.last_message_time)}
                    </span>
                  </div>
                  <div className="conversation-preview">
                    {conv.last_message}
                    {conv.unread_count > 0 && (
                      <span className="unread-badge">{conv.unread_count}</span>
                    )}
                  </div>
                </div>
              ))
          )}
        </div>
      ) : (
        <div className="users-list">
          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Загрузка...
            </div>
          ) : users.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Пользователи не найдены
            </div>
          ) : (
            users.map(u => (
              <div
                key={u.id}
                className="user-item"
                onClick={() => onSelectUser(u)}
              >
                <div className="user-name">
                  {u.username}
                  {onlineUsers.has(u.id) && (
                    <span className="online-indicator"></span>
                  )}
                </div>
                <div className="user-email">{u.email}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default Sidebar
