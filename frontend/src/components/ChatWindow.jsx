import { useState, useEffect, useRef } from 'react'
import { getConversation, sendMessage, uploadFile, editMessage, deleteMessage } from '../utils/api'

function ChatWindow({ currentUser, selectedUser, socket, onBack, onlineUsers }) {
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [editingMessage, setEditingMessage] = useState(null)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [uploading, setUploading] = useState(false)
  
  const messagesEndRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const fileInputRef = useRef(null)
  const imageInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const recordingIntervalRef = useRef(null)
  const chunksRef = useRef([])

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
        addMessage({
          sender_id: message.senderId,
          text: message.text,
          message_type: message.messageType,
          file_url: message.messageData?.fileUrl,
          file_name: message.messageData?.fileName,
          duration: message.messageData?.duration,
          created_at: message.timestamp
        })
      }
    }

    const handleMessageSent = (message) => {
      if (selectedUser && message.receiverId === selectedUser.id) {
        addMessage({
          sender_id: currentUser.id,
          text: message.text,
          message_type: message.messageType,
          file_url: message.messageData?.fileUrl,
          file_name: message.messageData?.fileName,
          duration: message.messageData?.duration,
          created_at: message.timestamp
        })
      }
    }

    const handleMessageEdited = ({ messageId, text }) => {
      setMessages(prev => prev.map(msg => 
        msg.id === parseInt(messageId) 
          ? { ...msg, text, edited: true }
          : msg
      ))
    }

    const handleMessageDeleted = ({ messageId }) => {
      setMessages(prev => prev.map(msg => 
        msg.id === parseInt(messageId)
          ? { ...msg, deleted: true, text: '', file_url: null }
          : msg
      ))
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
    socket.on('message_edited', handleMessageEdited)
    socket.on('message_deleted', handleMessageDeleted)
    socket.on('user_typing', handleUserTyping)
    socket.on('user_stop_typing', handleUserStopTyping)

    return () => {
      socket.off('new_message', handleNewMessage)
      socket.off('message_sent', handleMessageSent)
      socket.off('message_edited', handleMessageEdited)
      socket.off('message_deleted', handleMessageDeleted)
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

  const addMessage = (message) => {
    setMessages(prev => {
      // Check if message already exists
      const exists = prev.some(m => 
        m.sender_id === message.sender_id && 
        m.created_at === message.created_at &&
        m.text === message.text
      )
      if (exists) return prev
      
      return [...prev, message]
    })
    scrollToBottom()
  }

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if ((!newMessage.trim() && !editingMessage) || !selectedUser || !socket) return

    if (editingMessage) {
      // Edit message
      try {
        await editMessage(editingMessage.id, newMessage.trim())
        socket.emit('edit_message', {
          messageId: editingMessage.id,
          text: newMessage.trim(),
          receiverId: selectedUser.id
        })
        setMessages(prev => prev.map(msg =>
          msg.id === editingMessage.id
            ? { ...msg, text: newMessage.trim(), edited: true }
            : msg
        ))
        setEditingMessage(null)
        setNewMessage('')
      } catch (error) {
        console.error('Failed to edit message:', error)
      }
      return
    }

    const messageText = newMessage.trim()
    setNewMessage('')

    try {
      await sendMessage(selectedUser.id, messageText)
      socket.emit('send_message', {
        receiverId: selectedUser.id,
        text: messageText,
        messageType: 'text'
      })
      socket.emit('stop_typing', { receiverId: selectedUser.id })
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  const handleFileUpload = async (file, messageType) => {
    if (!file || !selectedUser || !socket) return

    setUploading(true)
    setShowAttachMenu(false)

    try {
      const result = await uploadFile(selectedUser.id, file, messageType)
      
      socket.emit('send_message', {
        receiverId: selectedUser.id,
        text: '',
        messageType,
        messageData: {
          fileUrl: result.file_url,
          fileName: result.file_name,
          duration: result.duration
        }
      })
    } catch (error) {
      console.error('Failed to upload file:', error)
    } finally {
      setUploading(false)
    }
  }

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const file = new File([blob], 'voice.webm', { type: 'audio/webm' })
        await handleFileUpload(file, 'voice')
        
        stream.getTracks().forEach(track => track.stop())
        setRecordingTime(0)
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (error) {
      console.error('Failed to start recording:', error)
      alert('Не удалось получить доступ к микрофону')
    }
  }

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
    }
  }

  const handleDeleteMessage = async (msg) => {
    if (!window.confirm('Удалить сообщение?')) return

    try {
      await deleteMessage(msg.id)
      socket.emit('delete_message', {
        messageId: msg.id,
        receiverId: selectedUser.id
      })
      setMessages(prev => prev.map(m =>
        m.id === msg.id ? { ...m, deleted: true, text: '', file_url: null } : m
      ))
    } catch (error) {
      console.error('Failed to delete message:', error)
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

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const renderMessage = (msg) => {
    if (msg.deleted) {
      return <div className="deleted-message">🚫 Сообщение удалено</div>
    }

    const isMine = msg.sender_id === currentUser.id

    switch (msg.message_type) {
      case 'image':
        return (
          <div className="message-image">
            <img src={msg.file_url} alt="Изображение" loading="lazy" />
          </div>
        )
      
      case 'video':
        return (
          <div className="message-video">
            <video controls>
              <source src={msg.file_url} />
            </video>
          </div>
        )
      
      case 'video_note':
        return (
          <div className="message-video-note">
            <video controls>
              <source src={msg.file_url} />
            </video>
          </div>
        )
      
      case 'voice':
        return (
          <div className="message-voice">
            <audio controls>
              <source src={msg.file_url} type="audio/webm" />
            </audio>
            {msg.duration && <span className="voice-duration">{formatDuration(msg.duration)}</span>}
          </div>
        )
      
      case 'file':
        return (
          <div className="message-file">
            <a href={msg.file_url} download={msg.file_name} target="_blank" rel="noopener noreferrer">
              <span className="file-icon">📎</span>
              <span className="file-name">{msg.file_name}</span>
            </a>
          </div>
        )
      
      default:
        return (
          <>
            <div className="message-text">{msg.text}</div>
            {isMine && msg.message_type === 'text' && (
              <div className="message-actions">
                <button onClick={() => {
                  setEditingMessage(msg)
                  setNewMessage(msg.text)
                }} className="msg-action-btn" title="Редактировать">
                  ✏️
                </button>
                <button onClick={() => handleDeleteMessage(msg)} className="msg-action-btn" title="Удалить">
                  🗑️
                </button>
              </div>
            )}
          </>
        )
    }
  }

  if (!selectedUser) {
    return (
      <div className="chat-window empty">
        <div className="empty-state">
          <div className="empty-icon">💬</div>
          <h3>Выберите чат</h3>
          <p>Найдите пользователя через поиск или выберите существующий чат</p>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-window">
      <div className="chat-header">
        <button onClick={onBack} className="back-btn">←</button>
        <div className="chat-header-user">
          <div className="chat-avatar">
            {selectedUser.displayName?.[0]?.toUpperCase() || '👤'}
            {onlineUsers.has(selectedUser.id) && <span className="online-dot"></span>}
          </div>
          <div className="chat-user-info">
            <div className="chat-user-name">{selectedUser.displayName}</div>
            <div className="chat-user-status">
              {isTyping ? (
                <span className="typing-indicator">печатает...</span>
              ) : onlineUsers.has(selectedUser.id) ? (
                <span className="online-status">в сети</span>
              ) : (
                <span className="offline-status">не в сети</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="messages-container">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Загрузка...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="empty-state-chat">
            <div className="empty-icon">👋</div>
            <p>Начните общение!</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={msg.id || index}
              className={`message ${msg.sender_id === currentUser.id ? 'sent' : 'received'} message-${msg.message_type} message-appear`}
            >
              <div className="message-content">
                {renderMessage(msg)}
              </div>
              <div className="message-meta">
                <span className="message-time">{formatMessageTime(msg.created_at)}</span>
                {msg.edited && <span className="edited-label">изменено</span>}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {uploading && (
        <div className="upload-indicator">
          <div className="spinner"></div>
          <span>Отправка файла...</span>
        </div>
      )}

      {editingMessage && (
        <div className="editing-indicator">
          <span>Редактирование сообщения</span>
          <button onClick={() => {
            setEditingMessage(null)
            setNewMessage('')
          }}>✕</button>
        </div>
      )}

      <form onSubmit={handleSendMessage} className="chat-input-container">
        <button
          type="button"
          className="attach-btn"
          onClick={() => setShowAttachMenu(!showAttachMenu)}
        >
          📎
        </button>

        {showAttachMenu && (
          <div className="attach-menu">
            <button type="button" onClick={() => imageInputRef.current?.click()}>
              🖼️ Фото
            </button>
            <button type="button" onClick={() => videoInputRef.current?.click()}>
              🎥 Видео
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()}>
              📁 Файл
            </button>
          </div>
        )}

        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFileUpload(file, 'image')
            e.target.value = ''
          }}
        />

        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFileUpload(file, 'video')
            e.target.value = ''
          }}
        />

        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFileUpload(file, 'file')
            e.target.value = ''
          }}
        />

        {isRecording ? (
          <div className="recording-indicator">
            <span className="recording-dot"></span>
            <span>{formatDuration(recordingTime)}</span>
            <button type="button" onClick={stopVoiceRecording} className="stop-recording-btn">
              Отправить
            </button>
          </div>
        ) : (
          <>
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
            {newMessage.trim() ? (
              <button type="submit" className="send-btn">
                ➤
              </button>
            ) : (
              <button type="button" onClick={startVoiceRecording} className="voice-btn">
                🎤
              </button>
            )}
          </>
        )}
      </form>
    </div>
  )
}

export default ChatWindow
