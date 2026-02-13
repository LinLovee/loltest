import { useState } from 'react'
import { login, register } from '../utils/api'

function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true)
  const [formData, setFormData] = useState({
    username: '',
    displayName: '',
    password: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = isLogin 
        ? await login(formData.username, formData.password)
        : await register(formData.username, formData.displayName, formData.password)
      
      onLogin(response.user, response.token)
    } catch (err) {
      setError(err.response?.data?.error || 'Произошла ошибка')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <div className="auth-container">
      <div className="auth-box">
        <div className="auth-logo">💬</div>
        <h1>{isLogin ? 'Вход' : 'Регистрация'}</h1>
        <p className="auth-subtitle">
          {isLogin ? 'Добро пожаловать обратно' : 'Создайте свой аккаунт'}
        </p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="input-group">
              <label>Ваше имя</label>
              <input
                type="text"
                name="displayName"
                placeholder="Иван Петров"
                value={formData.displayName}
                onChange={handleChange}
                required
                autoComplete="name"
              />
            </div>
          )}

          <div className="input-group">
            <label>Имя пользователя</label>
            <input
              type="text"
              name="username"
              placeholder="ivan_petrov"
              value={formData.username}
              onChange={handleChange}
              required
              autoComplete="username"
              pattern="[a-zA-Z0-9_]+"
              title="Только буквы, цифры и подчеркивание"
            />
            <small className="input-hint">Только буквы, цифры и _</small>
          </div>

          <div className="input-group">
            <label>Пароль</label>
            <input
              type="password"
              name="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              required
              minLength="6"
              autoComplete={isLogin ? "current-password" : "new-password"}
            />
            {!isLogin && <small className="input-hint">Минимум 6 символов</small>}
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? (
              <span className="btn-loader">Загрузка...</span>
            ) : (
              isLogin ? 'Войти' : 'Создать аккаунт'
            )}
          </button>
        </form>

        <div className="auth-switch">
          <span>{isLogin ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}</span>
          <button 
            type="button"
            onClick={() => {
              setIsLogin(!isLogin)
              setError('')
              setFormData({ username: '', displayName: '', password: '' })
            }}
            className="switch-btn"
          >
            {isLogin ? 'Зарегистрироваться' : 'Войти'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Auth
