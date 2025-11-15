import React, { useState, useEffect,useRef } from 'react';
import io from 'socket.io-client';
import './App.css'
import Lobby from './lobby';
import GridSquareGame from './gamesocket'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
const SOCKET_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.cardhubtw.com'
  : 'http://localhost:3001';

function App() {
  const [count, setCount] = useState(0)
  const [connected, setConnected] = useState(false);
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [myPlayerIndex, setMyPlayerIndex] = useState(null);
  const [inGame, setInGame] = useState(false);
  const socketRef = useRef(null);


  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
    });

    newSocket.on('gameStateUpdate', (state) => {
      const myPlayer = Object.entries(state.players).find(([sid, _]) => sid === newSocket.id);
      if (myPlayer) {
        setMyPlayerIndex(myPlayer[1].playerIndex);
        setInGame(true);
      }
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const handleJoinRoom = (roomId, playerName) => {
    if (socketRef.current) {
      setCurrentRoomId(roomId);
      socketRef.current.emit('joinRoom', roomId);
      socketRef.current.emit('registerPlayer', { playerName, roomId });
    }
  };

  const handleLeaveRoom = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      // Reload page to reset everything
      window.location.reload();
    }
  };
  return (
    <>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/lobby" replace />} />
          <Route path="/lobby" element={ 
                <Lobby 
                socket={socketRef.current} 
                connected={connected} 
                onJoinRoom={handleJoinRoom}
                onLeaveRoom={handleLeaveRoom}
                myPlayerIndex={myPlayerIndex}
              />} 
          />
        </Routes>

      </Router>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
