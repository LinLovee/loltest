import React, { useState, useEffect } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';

export default function App() {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  });
  const [page, setPage] = useState(user ? 'chat' : 'login');

  useEffect(() => {
    if (user) { localStorage.setItem('user', JSON.stringify(user)); setPage('chat'); }
    else localStorage.removeItem('user');
  }, [user]);

  if (page === 'login') return <Login onRegister={() => setPage('register')} onLogin={(u) => setUser(u)} />;
  if (page === 'register') return <Register onBack={() => setPage('login')} onRegister={(u) => setUser(u)} />;

  return <Chat user={user} onLogout={() => { localStorage.removeItem('token'); setUser(null); setPage('login'); }} />;
}
