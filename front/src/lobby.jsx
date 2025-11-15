import React, { useState, useEffect } from 'react';
import { Users, Trophy, Square, Plus, LogIn, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import GridSquareGame from './gamesocket';

const SOCKET_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.cardhubtw.com'
  : 'http://localhost:3001';
const PLAYER_COLORS = ['bg-blue-500', 'bg-green-500', 'bg-purple-500'];

export default function Lobby({ socket, connected, myPlayerIndex ,onJoinRoom, onLeaveRoom }) {
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [mode, setMode] = useState('lobby'); // 'lobby', 'create', 'join',game
  const [rooms, setRooms] = useState([]);
  const [lobbyStats, setLobbyStats] = useState({ totalRooms: 0, totalPlayers: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [notification, setNotification] = useState(null);

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchRooms = async () => {
    setRefreshing(true);
    try {
      const response = await fetch(`${SOCKET_URL}/api/rooms`);
      const data = await response.json();
      setRooms(data.rooms);
      setLobbyStats({ totalRooms: data.totalRooms, totalPlayers: data.totalPlayers });
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
      showNotification('Failed to fetch rooms', 'error');
    }
    setRefreshing(false);
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('roomListUpdate', (updatedRooms) => {
        setRooms(updatedRooms);
      });
    }
  }, [socket]);

  const createRoom = async () => {
    if (!playerName.trim()) {
      showNotification('Please enter your name', 'error');
      return;
    }

    try {
      const response = await fetch(`${SOCKET_URL}/api/room/create`, {
        method: 'POST'
      });
      const data = await response.json();
      
      onJoinRoom(data.roomId, playerName.trim());
      setMode('game');
    } catch (error) {
      showNotification('Failed to create room', 'error');
    }
  };

  const joinRoom = () => {
    if (!playerName.trim()) {
      showNotification('Please enter your name', 'error');
      return;
    }

    if (!roomId.trim() || roomId.length !== 6) {
      showNotification('Please enter a valid 6-digit room ID', 'error');
      return;
    }

    onJoinRoom(roomId.trim(), playerName.trim());
    setMode('game');
  };

  const joinRoomFromList = (selectedRoomId) => {
    if (!playerName.trim()) {
      showNotification('Please enter your name first', 'error');
      return;
    }

    onJoinRoom(selectedRoomId, playerName.trim());
    setMode('game')
  };




  return (mode === 'game' ? 
    <>
    <GridSquareGame socket={socket} roomId={roomId}  connected={connected} myPlayerIndex={myPlayerIndex} onLeaveRoom={onLeaveRoom} />
    </>:(
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div>
        {/* Notification */}
        {notification && (
          <div className="fixed top-4 right-4 z-50 animate-slide-in">
            <div
              className={`px-6 py-3 rounded-lg shadow-lg text-white ${
                notification.type === 'success' ? 'bg-green-600' :
                notification.type === 'error' ? 'bg-red-600' :
                'bg-blue-600'
              }`}
            >
              {notification.message}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-8">
          <Square className="w-16 h-16 mx-auto text-blue-500 mb-4" />
          <h1 className="text-4xl font-bold text-white mb-2">Grid Square Game</h1>
          <p className="text-slate-300">Multiplayer Game Lobby</p>
        </div>

        {/* Connection Status */}
        <div className="flex items-center justify-center mb-8">
          {connected ? (
            <div className="flex items-center gap-2 text-green-400">
              <Wifi className="w-5 h-5" />
              <span>Connected to server</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-400">
              <WifiOff className="w-5 h-5" />
              <span>Connecting to server...</span>
            </div>
          )}
        </div>

        {mode === 'lobby' ? (
          <>
            {/* Stats Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-slate-800 rounded-lg p-6 text-center">
                <Users className="w-8 h-8 mx-auto text-blue-400 mb-2" />
                <div className="text-3xl font-bold text-white">{lobbyStats.totalPlayers}</div>
                <div className="text-sm text-slate-400">Players Online</div>
              </div>
              <div className="bg-slate-800 rounded-lg p-6 text-center">
                <Square className="w-8 h-8 mx-auto text-green-400 mb-2" />
                <div className="text-3xl font-bold text-white">{lobbyStats.totalRooms}</div>
                <div className="text-sm text-slate-400">Active Rooms</div>
              </div>
              <div className="bg-slate-800 rounded-lg p-6 text-center">
                <Trophy className="w-8 h-8 mx-auto text-yellow-400 mb-2" />
                <div className="text-3xl font-bold text-white">
                  {rooms.filter(r => r.gameStarted && !r.gameOver).length}
                </div>
                <div className="text-sm text-slate-400">Games in Progress</div>
              </div>
            </div>

            {/* Player Name Input */}
            <div className="bg-slate-800 rounded-lg p-6 mb-6">
              <label className="block text-white font-semibold mb-2">Your Name</label>
              <input
                type="text"
                placeholder="Enter your name to join or create a room"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && playerName.trim() && setMode('create')}
              />
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <button
                onClick={() => setMode('create')}
                disabled={!connected || !playerName.trim()}
                className="px-6 py-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create New Room
              </button>
              
       
              <button
                onClick={() => setMode('join')}
                disabled={!connected || !playerName.trim()}
                className="px-6 py-4 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <LogIn className="w-5 h-5" />
                Join by Room ID
              </button>
            </div>

            {/* Room List */}
            <div className="bg-slate-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-white">Available Rooms</h2>
                <button
                  onClick={fetchRooms}
                  disabled={refreshing}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {rooms.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Square className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">No active rooms</p>
                  <p className="text-sm mt-2">Be the first to create one!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rooms.map((room) => (
                    <div
                      key={room.roomId}
                      className="bg-slate-700 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between hover:bg-slate-600 transition-colors gap-4"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <span className="text-white font-mono font-bold text-lg">
                            #{room.roomId}
                          </span>
                          {room.gameStarted && !room.gameOver && (
                            <span className="px-2 py-1 bg-yellow-500 text-black text-xs font-semibold rounded">
                              In Progress
                            </span>
                          )}
                          {room.gameOver && (
                            <span className="px-2 py-1 bg-gray-500 text-white text-xs font-semibold rounded">
                              Finished
                            </span>
                          )}
                          {!room.gameStarted && (
                            <span className="px-2 py-1 bg-green-500 text-white text-xs font-semibold rounded">
                              Waiting
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm mb-2">
                          <Users className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-300">
                            {room.playerCount}/{room.maxPlayers} Players
                          </span>
                        </div>

                        {room.players.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {room.players.map((player, idx) => (
                              <span
                                key={idx}
                                className={`px-3 py-1 ${PLAYER_COLORS[player.playerIndex]} text-white text-sm rounded-full`}
                              >
                                {player.name}
                              </span>
                            ))}
                            {room.playerCount < room.maxPlayers && (
                              <span className="px-3 py-1 bg-slate-600 text-slate-400 text-sm rounded-full border-2 border-dashed border-slate-500">
                                Empty Slot
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => { joinRoomFromList(room.roomId)}}
                        disabled={!playerName.trim() || room.playerCount >= room.maxPlayers}
                        className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                      >
                        {room.playerCount >= room.maxPlayers ? 'Full' : 'Join Room'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : mode === 'create' ? (
          <div className="max-w-md mx-auto bg-slate-800 rounded-lg p-8">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">Create New Room</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-white font-semibold mb-2">Your Name</label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyPress={(e) => e.key === 'Enter' && createRoom()}
                />
              </div>
              
              <button
                onClick={()=>{createRoom()}}
                disabled={!connected || !playerName.trim()}
                className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Create Room & Start
              </button>
              
              <button
                onClick={() => setMode('lobby')}
                className="w-full px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
              >
                Back to Lobby
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-md mx-auto bg-slate-800 rounded-lg p-8">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">Join Room by ID</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-white font-semibold mb-2">Your Name</label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              
              <div>
                <label className="block text-white font-semibold mb-2">Room ID</label>
                <input
                  type="text"
                  placeholder="Enter 6-digit room ID"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-green-500 font-mono"
                  maxLength={6}
                  onKeyPress={(e) => e.key === 'Enter' && joinRoom()}
                />
              </div>
              
              <button
                onClick={()=>{ joinRoom()}}
                disabled={!connected || !playerName.trim() || roomId.length !== 6}
                className="w-full px-4 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Join Room
              </button>
              
              <button
                onClick={() => setMode('lobby')}
                className="w-full px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
              >
                Back to Lobby
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>)
  );
}