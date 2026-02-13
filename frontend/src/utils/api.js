import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const api = axios.create({
  baseURL: API_URL,
})

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auth
export const register = async (username, displayName, password) => {
  const response = await api.post('/api/auth/register', { username, displayName, password })
  return response.data
}

export const login = async (username, password) => {
  const response = await api.post('/api/auth/login', { username, password })
  return response.data
}

export const deleteAccount = async () => {
  const response = await api.delete('/api/auth/delete-account')
  return response.data
}

export const checkAuth = async (token) => {
  const response = await api.get('/api/users/me', {
    headers: { Authorization: `Bearer ${token}` }
  })
  return response.data
}

// Users
export const searchUsers = async (query) => {
  const response = await api.get('/api/users/search', { params: { q: query } })
  return response.data
}

// Messages
export const getConversation = async (userId) => {
  const response = await api.get(`/api/messages/conversation/${userId}`)
  return response.data
}

export const sendMessage = async (receiverId, text, messageType = 'text') => {
  const response = await api.post('/api/messages/send', { receiverId, text, messageType })
  return response.data
}

export const uploadFile = async (receiverId, file, messageType, duration = null) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('receiverId', receiverId)
  formData.append('messageType', messageType)
  if (duration) {
    formData.append('duration', duration)
  }
  
  const response = await api.post('/api/messages/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
  return response.data
}

export const editMessage = async (messageId, text) => {
  const response = await api.put(`/api/messages/edit/${messageId}`, { text })
  return response.data
}

export const deleteMessage = async (messageId) => {
  const response = await api.delete(`/api/messages/delete/${messageId}`)
  return response.data
}

export const getConversations = async () => {
  const response = await api.get('/api/messages/conversations')
  return response.data
}

export default api
