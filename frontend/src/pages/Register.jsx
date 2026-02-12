import React, { useState } from 'react';
import API from '../api';

export default function Register({ onBack, onRegister }) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post('/auth/register', { name, username, password });
      localStorage.setItem('token', res.data.token);
      onRegister(res.data.user);
    } catch (e) { setErr(e.response?.data?.message || 'Ошибка'); }
  };

  return (
    <div className="auth">
      <h2>Регистрация</h2>
      <form onSubmit={submit}>
        <input placeholder="Имя" value={name} onChange={e => setName(e.target.value)} />
        <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
        <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
        <button type="submit">Зарегистрироваться</button>
      </form>
      <div className="muted">Уже есть аккаунт? <button onClick={onBack}>Войти</button></div>
      {err && <div className="error">{err}</div>}
    </div>
  )
}
