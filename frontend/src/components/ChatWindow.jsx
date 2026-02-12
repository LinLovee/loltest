import React, { useState, useEffect, useRef } from 'react';
import API from '../api';
import { socket } from '../socket';

export default function ChatWindow({ me, other }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [editing, setEditing] = useState(null);
  const fileRef = useRef();
  const scroller = useRef();
  const [lastMsgId, setLastMsgId] = useState(null);

  useEffect(() => {
    (async () => {
      const res = await API.get('/messages/history/' + other._id);
      setMessages(res.data);
      socket.emit('join', me._id);
    })();

    const handler = (msg) => {
      const otherId = msg.sender === me._id ? msg.receiver : msg.sender;
      if (otherId === other._id || msg.sender === other._id) {
        setMessages(prev => [...prev, msg]);
        setLastMsgId(msg._id || msg.file || Date.now());
      }
    };

    const typingHandler = ({ from }) => {
      if (from === other._id) setOtherTyping(true);
    };
    const stopTypingHandler = ({ from }) => {
      if (from === other._id) setOtherTyping(false);
    };

    const editedHandler = (editedMsg) => {
      setMessages(prev => prev.map(m => m._id === editedMsg._id ? editedMsg : m));
    };

    const deletedHandler = ({ id }) => {
      setMessages(prev => prev.filter(m => m._id !== id));
    };

    socket.on('receive_message', handler);
    socket.on('typing', typingHandler);
    socket.on('stop_typing', stopTypingHandler);
    socket.on('message_edited', editedHandler);
    socket.on('message_deleted', deletedHandler);

    return () => {
      socket.off('receive_message', handler);
      socket.off('typing', typingHandler);
      socket.off('stop_typing', stopTypingHandler);
      socket.off('message_edited', editedHandler);
      socket.off('message_deleted', deletedHandler);
    };
  }, [other._id]);

  useEffect(() => { scroller.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    let t;
    if (isTyping) {
      socket.emit('typing', { from: me._id, to: other._id });
      t = setTimeout(() => {
        socket.emit('stop_typing', { from: me._id, to: other._id });
        setIsTyping(false);
      }, 2000);
    }
    return () => clearTimeout(t);
  }, [isTyping]);

  const handleInput = (val) => {
    setText(val);
    if (!isTyping) setIsTyping(true);
  };

  const sendText = async () => {
    if (!text) return;
    try {
      if (editing) {
        const res = await API.put('/messages/' + editing, { text });
        socket.emit('message_edited', res.data);
        setMessages(prev => prev.map(m => m._id === res.data._id ? res.data : m));
        setEditing(null);
        setText('');
        return;
      }

      const res = await API.post('/messages/send', { receiver: other._id, text });
      const msg = res.data;
      socket.emit('send_message', msg);
      setMessages(prev => [...prev, msg]);
      setLastMsgId(msg._id || Date.now());
      setText('');
    } catch (e) { console.error(e); }
  };

  const sendFile = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('receiver', other._id);
    const res = await API.post('/messages/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    const msg = res.data;
    socket.emit('send_message', msg);
    setMessages(prev => [...prev, msg]);
    setLastMsgId(msg._id || Date.now());
  };

  const mediaRef = useRef();
  const [recState, setRecState] = useState('idle');
  useEffect(() => {
    let mediaRecorder;
    let audioChunks = [];

    const start = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRef.current = stream;
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        audioChunks = [];
        const file = new File([audioBlob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
        setRecState('sending');
        await sendFile(file);
        setRecState('idle');
        mediaRef.current.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.start();
      setRecState('recording');
      mediaRef.mediaRecorder = mediaRecorder;
    };

    const stop = () => {
      if (mediaRef.mediaRecorder && mediaRef.mediaRecorder.state !== 'inactive') mediaRef.mediaRecorder.stop();
    };

    mediaRef.start = start;
    mediaRef.stop = stop;

    return () => {
      if (mediaRef.current) mediaRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const startRecording = () => { mediaRef.start && mediaRef.start(); };
  const stopRecording = () => { mediaRef.stop && mediaRef.stop(); };

  const deleteMessage = async (id) => {
    try {
      await API.delete('/messages/' + id);
      setMessages(prev => prev.filter(m => m._id !== id));
      socket.emit('message_deleted', { id, receiver: other._id, sender: me._id });
    } catch (e) { console.error(e); }
  };

  const startEdit = (m) => {
    setEditing(m._id);
    setText(m.text || '');
  };

  return (
    <div className="chat-window">
      <div className="chat-header">
        {other.name} (@{other.username})
        <div style={{ fontSize: 13, color: '#666', marginTop: 6 }}>{otherTyping ? 'печатает...' : ''}</div>
      </div>
      <div className="messages">
        {messages.map((m, i) => (
          <div key={m._id || i} className={`msg ${m.sender === me._id ? 'me' : 'them'} ${m._id === lastMsgId ? 'new' : ''}`}>
            {m.type === 'text' && <div className="txt">{m.text} {m.edited && <span style={{fontSize:12, color:'#444'}}> (edited)</span>}</div>}
            {m.type === 'image' && <img src={`http://localhost:5000/uploads/${m.file}`} alt="img" />}
            {m.type === 'video' && <video controls src={`http://localhost:5000/uploads/${m.file}`} />}
            {m.type === 'voice' && <audio controls src={`http://localhost:5000/uploads/${m.file}`} />}
            {m.type === 'file' && <a href={`http://localhost:5000/uploads/${m.file}`} download>Скачать файл</a>}

            {m.sender === me._id && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={() => startEdit(m)}>Ред.</button>
                <button onClick={() => deleteMessage(m._id)}>Удал.</button>
              </div>
            )}
          </div>
        ))}
        <div ref={scroller} />
      </div>

      <div className="composer">
        <input value={text} onChange={e => handleInput(e.target.value)} placeholder="Написать..." onKeyDown={e => { if (e.key === 'Enter') sendText(); }} />
        <input type="file" ref={fileRef} onChange={e => { if (e.target.files[0]) sendFile(e.target.files[0]); }} />
        <div style={{ display: 'flex', gap: 8 }}>
          {recState === 'idle' && <button onMouseDown={startRecording} onMouseUp={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording}>Hold to record</button>}
          {recState === 'recording' && <button onClick={stopRecording}>Stop</button>}
          <button onClick={sendText}>{editing ? 'Сохранить' : 'Отправить'}</button>
        </div>
      </div>
    </div>
  );
}
