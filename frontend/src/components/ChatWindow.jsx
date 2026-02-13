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
  const [isRecordingVideo, setIsRecordingVideo] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(null)
  
  const messagesEndRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const fileInputRef = useRef(null)
  const imageInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const videoRecorderRef = useRef(null)
  const recordingIntervalRef = useRef(null)
  const chunksRef = useRef([])
  const videoChunksRef = useRef([])
  const videoPreviewRef = useRef(null)
  const videoCancelledRef = useRef(false)
  const voiceCancelledRef = useRef(false)

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
        // Перезагружаем все сообщения чтобы получить ID из БД
        loadMessages()
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
    socket.on('message_edited', handleMessageEdited)
    socket.on('message_deleted', handleMessageDeleted)
    socket.on('user_typing', handleUserTyping)
    socket.on('user_stop_typing', handleUserStopTyping)

    return () => {
      socket.off('new_message', handleNewMessage)
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
      const result = await sendMessage(selectedUser.id, messageText)
      // Добавляем сообщение с ID из БД
      addMessage(result)
      
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

  const handleFileUpload = async (file, messageType, duration = null) => {
    if (!file || !selectedUser || !socket) return

    setUploading(true)
    setShowAttachMenu(false)

    try {
      const result = await uploadFile(selectedUser.id, file, messageType, duration)
      
      // Добавляем сообщение с ID из БД
      addMessage(result)
      
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
      alert('Ошибка при загрузке файла')
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
      voiceCancelledRef.current = false

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop())
        
        // Проверяем флаг отмены
        if (voiceCancelledRef.current) {
          console.log('Voice recording cancelled, not sending')
          setRecordingTime(0)
          return
        }
        
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const file = new File([blob], 'voice.webm', { type: 'audio/webm' })
        const duration = recordingTime
        await handleFileUpload(file, 'voice', duration)
        
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

  const cancelVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // Устанавливаем флаг отмены ПЕРЕД остановкой
      voiceCancelledRef.current = true
      
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
      chunksRef.current = []
      
      setIsRecording(false)
      setRecordingTime(0)
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
    }
  }

  const startVideoNoteRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 384 },
          height: { ideal: 384 },
          aspectRatio: 1,
          facingMode: 'user'
        }, 
        audio: true 
      })
      
      // Show preview
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream
        videoPreviewRef.current.muted = true
        videoPreviewRef.current.playsInline = true
        await videoPreviewRef.current.play().catch(err => {
          console.log('Autoplay prevented, user needs to interact:', err)
        })
      }

      videoCancelledRef.current = false

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9,opus'
      })
      videoRecorderRef.current = mediaRecorder
      videoChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          videoChunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = async () => {
        // Stop preview
        stream.getTracks().forEach(track => track.stop())
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = null
        }
        setVideoPreviewUrl(null)
        
        // Проверяем флаг отмены
        if (videoCancelledRef.current) {
          console.log('Video recording cancelled, not sending')
          setRecordingTime(0)
          return
        }
        
        const blob = new Blob(videoChunksRef.current, { type: 'video/webm' })
        const file = new File([blob], 'video-note.webm', { type: 'video/webm' })
        const duration = recordingTime
        
        await handleFileUpload(file, 'video_note', duration)
        setRecordingTime(0)
      }

      mediaRecorder.start()
      setIsRecordingVideo(true)
      setRecordingTime(0)
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (error) {
      console.error('Failed to start video recording:', error)
      alert('Не удалось получить доступ к камере и микрофону')
    }
  }

  const stopVideoNoteRecording = () => {
    if (videoRecorderRef.current && isRecordingVideo) {
      videoRecorderRef.current.stop()
      setIsRecordingVideo(false)
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
    }
  }

  const cancelVideoNoteRecording = () => {
    if (videoRecorderRef.current && isRecordingVideo) {
      // Устанавливаем флаг отмены ПЕРЕД остановкой
      videoCancelledRef.current = true
      
      videoRecorderRef.current.stop()
      videoRecorderRef.current = null
      videoChunksRef.current = []
      
      // Stop all tracks
      if (videoPreviewRef.current && videoPreviewRef.current.srcObject) {
        videoPreviewRef.current.srcObject.getTracks().forEach(track => track.stop())
        videoPreviewRef.current.srcObject = null
      }
      
      setIsRecordingVideo(false)
      setVideoPreviewUrl(null)
      setRecordingTime(0)
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
          <>
            <div className="message-image">
              <img src={msg.file_url} alt="Изображение" loading="lazy" />
            </div>
            {isMine && (
              <div className="message-actions">
                <button onClick={() => handleDeleteMessage(msg)} className="msg-action-btn" title="Удалить">
                  🗑️
                </button>
              </div>
            )}
          </>
        )
      
      case 'video':
        return (
          <>
            <div className="message-video">
              <video controls>
                <source src={msg.file_url} />
              </video>
            </div>
            {isMine && (
              <div className="message-actions">
                <button onClick={() => handleDeleteMessage(msg)} className="msg-action-btn" title="Удалить">
                  🗑️
                </button>
              </div>
            )}
          </>
        )
      
      case 'video_note':
        return (
          <>
            <div className="message-video-note">
              <video controls className="video-note-player" playsInline>
                <source src={msg.file_url} type="video/webm" />
              </video>
              {msg.duration && <span className="video-note-duration">{formatDuration(msg.duration)}</span>}
            </div>
            {isMine && (
              <div className="message-actions">
                <button onClick={() => handleDeleteMessage(msg)} className="msg-action-btn" title="Удалить">
                  🗑️
                </button>
              </div>
            )}
          </>
        )
      
      case 'voice':
        return (
          <>
            <div className="message-voice">
              <audio controls>
                <source src={msg.file_url} type="audio/webm" />
              </audio>
              {msg.duration && <span className="voice-duration">{formatDuration(msg.duration)}</span>}
            </div>
            {isMine && (
              <div className="message-actions">
                <button onClick={() => handleDeleteMessage(msg)} className="msg-action-btn" title="Удалить">
                  🗑️
                </button>
              </div>
            )}
          </>
        )
      
      case 'file':
        return (
          <>
            <div className="message-file">
              <a href={msg.file_url} download={msg.file_name} target="_blank" rel="noopener noreferrer">
                <span className="file-icon">📎</span>
                <span className="file-name">{msg.file_name}</span>
              </a>
            </div>
            {isMine && (
              <div className="message-actions">
                <button onClick={() => handleDeleteMessage(msg)} className="msg-action-btn" title="Удалить">
                  🗑️
                </button>
              </div>
            )}
          </>
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

      {isRecordingVideo && (
        <div className="video-note-recording">
          <div className="video-note-preview">
            <video ref={videoPreviewRef} autoPlay muted playsInline />
            <div className="recording-timer">
              <span className="recording-dot-video"></span>
              <span>{formatDuration(recordingTime)}</span>
            </div>
          </div>
          <div className="video-note-controls">
            <button onClick={cancelVideoNoteRecording} className="cancel-video-btn">
              ✕ Отменить
            </button>
            <button onClick={stopVideoNoteRecording} className="send-video-btn">
              ➤ Отправить
            </button>
          </div>
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
            <button type="button" onClick={startVideoNoteRecording}>
              ⭕ Видео-кружок
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
            <button type="button" onClick={cancelVoiceRecording} className="cancel-recording-btn">
              ✕
            </button>
            <button type="button" onClick={stopVoiceRecording} className="stop-recording-btn">
              ➤
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
