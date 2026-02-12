import React, { useState, useEffect } from 'react';
import API from '../api';
import { socket } from '../socket';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';

export default function Chat({ user, onLogout }) {
  const [selectedUser, setSelectedUser] = useState(null);
  const [chats, setChats] = useState([]);

  useEffect(() => {
    socket.emit('join', user._id);

    socket.on('receive_message', (msg) => {
      const otherId = msg.sender === user._id ? msg.receiver : msg.sender;
      setChats(prev => {
        const exists = prev.find(p => p._id === otherId);
        if (exists) return prev;
        (async () => {
          try {
            const res = await API.get('/users/search/' + (msg.sender === user._id ? msg.receiver : msg.sender));
            setChats(curr => [res.data, ...curr]);
          } catch (e) { }
        })();
        return prev;
      });
    });

    return () => { socket.off('receive_message'); };
  }, []);

  const openWith = async (username) => {
    try {
      const res = await API.get('/users/search/' + username);
      const u = res.data;
      if (!chats.find(c => c._id === u._id)) setChats([u, ...chats]);
      setSelectedUser(u);
    } catch (e) {
      alert('Пользователь не найден');
    }
  };

  return (
    <div className="app">
      <div className="sidebar">
        <div className="top">
          <div>{user.name} (@{user.username})</div>
          <div><button onClick={() => { API.delete('/auth/delete').then(()=> { onLogout(); }).catch(()=>{}); }}>Удалить аккаунт</button></div>
          <div><button onClick={onLogout}>Выйти</button></div>
        </div>
        <ChatList chats={chats} onOpen={u => setSelectedUser(u)} onSearch={openWith} />
      </div>
      <div className="main">
        {selectedUser ? <ChatWindow me={user} other={selectedUser} /> : <div className="placeholder">Выберите чат</div>}
      </div>
    </div>
  )
}
