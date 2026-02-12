import { useState, useEffect, useRef } from 'react'
import { getConversation, sendMessage } from '../utils/api'

function ChatWindow({ currentUser, selectedUser, socket, onBack, onlineUsers }) {
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  useEffect(() => {
    if (selectedUser) {
      loadMessages()
    } else {
      setMessages([])
    }
  }, [selectedUser])

  useEffect(() => {
    if (!socket) return

    const handleNewMessage = (message) => {
      if (selectedUser && message.senderId === selectedUser.id) {
        setMessages(prev => [...prev, {
          sender_id: message.senderId,
          text: message.text,
          created_at: message.timestamp
        }])
        scrollToBottom()
      }
    }

    const handleMessageSent = (message) => {
      if (selectedUser && message.receiverId === selectedUser.id) {
        setMessages(prev => [...prev, {
          sender_id: currentUser.id,
          text: message.text,
          created_at: message.timestamp
        }])
        scrollToBottom()
      }
    }

    const handleUserTyping = ({ userId }) => {
      if (selectedUser && userId === selectedUser.id) {
        setIsTyping(true)
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current)
        }
        typingTimeoutRef.current = setTimeout(() => {
          setIsTyping(false)
        }, 3000)
      }
    }

    const handleUserStopTyping = ({ userId }) => {
      if (selectedUser && userId === selectedUser.id) {
        setIsTyping(false)
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current)
        }
      }
    }

    socket.on('new_message', handleNewMessage)
    socket.on('message_sent', handleMessageSent)
    socket.on('user_typing', handleUserTyping)
    socket.on('user_stop_typing', handleUserStopTyping)

    return () => {
      socket.off('new_message', handleNewMessage)
      socket.off('message_sent', handleMessageSent)
      socket.off('user_typing', handleUserTyping)
      socket.off('user_stop_typing', handleUserStopTyping)
    }
  }, [socket, selectedUser, currentUser])

  const loadMessages = async () => {
    setLoading(true)
    try {
      const data = await getConversation(selectedUser.id)
      setMessages(data)
      scrollToBottom()
    } catch (error) {
      console.error('Failed to load messages:', error)
    } finally {
      setLoading(false)
    }
  }

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedUser || !socket) return

    const messageText = newMessage.trim()
    setNewMessage('')

    try {
      await sendMessage(selectedUser.id, messageText)
      socket.emit('send_message', {
        receiverId: selectedUser.id,
        text: messageText
      })
      socket.emit('stop_typing', { receiverId: selectedUser.id })
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  const handleTyping = (e) => {
    setNewMessage(e.target.value)
    
    if (!socket || !selectedUser) return

    socket.emit('typing', { receiverId: selectedUser.id })
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', { receiverId: selectedUser.id })
    }, 2000)
  }

  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }

  if (!selectedUser) {
    return (
      <div className="chat">
        <div className="empty-state">
          <div className="empty-state-icon">💬</div>
          <p>Выберите чат, чтобы начать общение</p>
        </div>
      </div>
    )
  }

  return (
    <div className="chat">
      <div className="chat-header">
        <div className="chat-header-left">
          <button onClick={onBack} className="back-btn">←</button>
          <div>
            <div className="chat-user-name">
              {selectedUser.username}
              {onlineUsers.has(selectedUser.id) && (
                <span className="online-indicator"></span>
              )}
            </div>
            {isTyping && <div className="typing-indicator">печатает...</div>}
          </div>
        </div>
      </div>

      <div className="messages-container">
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
            Загрузка сообщений...
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '20px' }}>
            Нет сообщений. Напишите первым!
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`message ${msg.sender_id === currentUser.id ? 'sent' : 'received'}`}
            >
              <div>{msg.text}</div>
              <div className="message-time">{formatMessageTime(msg.created_at)}</div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="chat-input-container">
        <textarea
          className="chat-input"
          placeholder="Написать сообщение..."
          value={newMessage}
          onChange={handleTyping}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSendMessage(e)
            }
          }}
          rows="1"
        />
        <button type="submit" className="send-btn" disabled={!newMessage.trim()}>
          Отправить
        </button>
      </form>
    </div>
  )
}

export default ChatWindow
