import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import Sidebar from './Sidebar'
import ChatWindow from './ChatWindow'

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

function Chat({ user, onLogout }) {
  const [socket, setSocket] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [onlineUsers, setOnlineUsers] = useState(new Set())
  const [conversations, setConversations] = useState([])
  const [sidebarHidden, setSidebarHidden] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const newSocket = io(SOCKET_URL, {
      auth: { token }
    })

    newSocket.on('connect', () => {
      console.log('Connected to server')
    })

    newSocket.on('user_online', ({ userId, online }) => {
      setOnlineUsers(prev => {
        const updated = new Set(prev)
        if (online) {
          updated.add(userId)
        } else {
          updated.delete(userId)
        }
        return updated
      })
    })

    // Handle new message for conversation list update
    newSocket.on('conversation_updated', ({ userId, lastMessage, lastMessageType, timestamp }) => {
      setConversations(prev => {
        const updated = [...prev]
        const index = updated.findIndex(c => c.other_user_id === userId)
        
        if (index !== -1) {
          // Update existing conversation
          const conv = { ...updated[index] }
          conv.last_message = lastMessage
          conv.last_message_type = lastMessageType
          conv.last_message_time = timestamp
          
          // If not the selected user, increment unread count
          if (!selectedUser || selectedUser.id !== userId) {
            conv.unread_count = (conv.unread_count || 0) + 1
          }
          
          // Move to top
          updated.splice(index, 1)
          updated.unshift(conv)
        } else {
          // Add new conversation to the top
          // We'll refresh conversations to get full user data
          setTimeout(() => {
            import('../utils/api').then(({ getConversations }) => {
              getConversations().then(setConversations).catch(console.error)
            })
          }, 100)
        }
        
        return updated
      })
    })

    setSocket(newSocket)

    return () => {
      newSocket.close()
    }
  }, [selectedUser])

  const handleSelectUser = (user) => {
    setSelectedUser(user)
    setSidebarHidden(true)
    
    // Mark conversation as read
    setConversations(prev => {
      const updated = [...prev]
      const index = updated.findIndex(c => c.other_user_id === user.id)
      if (index !== -1) {
        updated[index] = { ...updated[index], unread_count: 0 }
      }
      return updated
    })
  }

  const handleBack = () => {
    setSidebarHidden(false)
    setSelectedUser(null)
  }

  return (
    <div className="chat-container">
      <Sidebar 
        user={user}
        onLogout={onLogout}
        onSelectUser={handleSelectUser}
        onlineUsers={onlineUsers}
        conversations={conversations}
        setConversations={setConversations}
        hidden={sidebarHidden}
      />
      <ChatWindow 
        currentUser={user}
        selectedUser={selectedUser}
        socket={socket}
        onBack={handleBack}
        onlineUsers={onlineUsers}
      />
    </div>
  )
}

export default Chat
