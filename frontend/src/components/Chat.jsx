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

    newSocket.on('new_message', (message) => {
      // Update conversations list
      setConversations(prev => {
        const updated = [...prev]
        const index = updated.findIndex(c => c.other_user_id === message.senderId)
        if (index !== -1) {
          const conv = { ...updated[index] }
          conv.last_message = message.text
          conv.last_message_time = message.timestamp
          conv.unread_count = (conv.unread_count || 0) + 1
          updated.splice(index, 1)
          updated.unshift(conv)
        }
        return updated
      })
    })

    setSocket(newSocket)

    return () => {
      newSocket.close()
    }
  }, [])

  const handleSelectUser = (user) => {
    setSelectedUser(user)
    setSidebarHidden(true)
  }

  const handleBack = () => {
    setSidebarHidden(false)
    setSelectedUser(null)
  }

  return (
    <>
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
    </>
  )
}

export default Chat
