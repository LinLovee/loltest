import React, { useState } from 'react';
import API from '../api';

export default function Login({ onRegister, onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post('/auth/login', { username, password });
      localStorage.setItem('token', res.data.token);
      onLogin(res.data.user);
    } catch (e) { setErr(e.response?.data?.message || 'Ошибка'); }
  };

  return (
    <div className="auth">
      <h2>Вход</h2>
      <form onSubmit={submit}>
        <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
        <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
        <button type="submit">Войти</button>
      </form>
      <div className="muted">Нет аккаунта? <button onClick={onRegister}>Зарегистрироваться</button></div>
      {err && <div className="error">{err}</div>}
    </div>
  )
}
