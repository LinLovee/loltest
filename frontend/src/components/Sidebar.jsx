import { useState, useEffect } from 'react'
import { searchUsers, getConversations, deleteAccount } from '../utils/api'

function Sidebar({ user, onLogout, onSelectUser, onlineUsers, conversations, setConversations, hidden }) {
  const [view, setView] = useState('conversations') // 'conversations' or 'search'
  const [searchResults, setSearchResults] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    loadConversations()
  }, [])

  const loadConversations = async () => {
    try {
      const data = await getConversations()
      setConversations(data)
    } catch (error) {
      console.error('Failed to load conversations:', error)
    }
  }

  const handleSearch = async (query) => {
    setSearchQuery(query)
    
    if (query.trim() === '') {
      setSearchResults([])
      setView('conversations')
      return
    }

    setView('search')
    setLoading(true)
    try {
      const data = await searchUsers(query)
      setSearchResults(data)
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount()
      localStorage.removeItem('token')
      window.location.reload()
    } catch (error) {
      console.error('Failed to delete account:', error)
      alert('Не удалось удалить аккаунт')
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
        <div className="sidebar-user">
          <div className="user-avatar">{user.displayName?.[0]?.toUpperCase() || '👤'}</div>
          <div className="user-info">
            <div className="user-display-name">{user.displayName}</div>
            <div className="user-username">@{user.username}</div>
          </div>
        </div>
        <button onClick={() => setShowSettings(!showSettings)} className="settings-btn">
          ⚙️
        </button>
      </div>

      {showSettings && (
        <div className="settings-dropdown">
          <button onClick={onLogout} className="settings-item">
            <span>🚪</span> Выйти
          </button>
          <button 
            onClick={() => {
              setShowSettings(false)
              setShowDeleteConfirm(true)
            }} 
            className="settings-item danger"
          >
            <span>🗑️</span> Удалить аккаунт
          </button>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Удалить аккаунт?</h3>
            <p>Это действие нельзя отменить. Все ваши сообщения будут удалены.</p>
            <div className="modal-buttons">
              <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary">
                Отмена
              </button>
              <button onClick={handleDeleteAccount} className="btn-danger">
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="🔍 Поиск по username..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      <div className="sidebar-content">
        {view === 'conversations' ? (
          <div className="conversations-list">
            {conversations.length === 0 ? (
              <div className="empty-state-small">
                <div className="empty-icon">💬</div>
                <p>Нет чатов</p>
                <small>Найдите пользователя через поиск</small>
              </div>
            ) : (
              conversations.map(conv => (
                <div
                  key={conv.other_user_id}
                  className="conversation-item"
                  onClick={() => {
                    onSelectUser({ 
                      id: conv.other_user_id, 
                      username: conv.other_username,
                      displayName: conv.other_display_name
                    })
                    setSearchQuery('')
                    setView('conversations')
                  }}
                >
                  <div className="conv-avatar">
                    {conv.other_display_name?.[0]?.toUpperCase() || '👤'}
                    {onlineUsers.has(conv.other_user_id) && (
                      <span className="online-dot"></span>
                    )}
                  </div>
                  <div className="conv-info">
                    <div className="conv-header">
                      <span className="conv-name">{conv.other_display_name}</span>
                      <span className="conv-time">{formatTime(conv.last_message_time)}</span>
                    </div>
                    <div className="conv-preview">
                      <span className="conv-message">{conv.last_message}</span>
                      {conv.unread_count > 0 && (
                        <span className="unread-badge">{conv.unread_count}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="search-results">
            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Поиск...</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="empty-state-small">
                <div className="empty-icon">🔍</div>
                <p>Пользователи не найдены</p>
              </div>
            ) : (
              searchResults.map(u => (
                <div
                  key={u.id}
                  className="search-result-item"
                  onClick={() => {
                    onSelectUser(u)
                    setSearchQuery('')
                    setView('conversations')
                  }}
                >
                  <div className="search-avatar">
                    {u.displayName?.[0]?.toUpperCase() || '👤'}
                    {onlineUsers.has(u.id) && (
                      <span className="online-dot"></span>
                    )}
                  </div>
                  <div className="search-info">
                    <div className="search-display-name">{u.displayName}</div>
                    <div className="search-username">@{u.username}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Sidebar
