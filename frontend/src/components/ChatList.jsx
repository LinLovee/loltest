import React, { useState } from 'react';

export default function ChatList({ chats, onOpen, onSearch }) {
  const [q, setQ] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!q) return;
    onSearch(q);
    setQ('');
  };

  return (
    <div>
      <form onSubmit={submit} className="search">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Искать по username" />
        <button type="submit">Найти</button>
      </form>

      <div className="chats">
        {chats.map(c => (
          <div key={c._id} className="chat-item" onClick={() => onOpen(c)}>
            <div className="name">{c.name}</div>
            <div className="username">@{c.username}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
