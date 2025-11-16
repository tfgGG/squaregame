import React, { useState, useEffect } from 'react';
import { Users, Trophy, Square, Plus, LogIn, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import GridSquareGame from './gamesocket';

const SOCKET_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.cardhubtw.com'
  : 'http://localhost:3001';
const PLAYER_COLORS = ['bg-blue-500', 'bg-green-500', 'bg-purple-500'];

export default function Lobby({ socket, connected, myPlayerIndex, onJoinRoom, onLeaveRoom }) {
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [mode, setMode] = useState('lobby');
  const [rooms, setRooms] = useState([]);
  const [lobbyStats, setLobbyStats] = useState({ totalRooms: 0, totalPlayers: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [notification, setNotification] = useState(null);
  const [pendingRoomId, setPendingRoomId] = useState(null);
  const [availablePositions, setAvailablePositions] = useState([0, 1, 2]);
  const [selectedPosition, setSelectedPosition] = useState(null);

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

      socket.on('availablePositions', (data) => {
        setAvailablePositions(data.availablePositions || [0, 1, 2]);
      });

      socket.on('error', (data) => {
        showNotification(data.message, 'error');
      });
    }

    return () => {
      if (socket) {
        socket.off('roomListUpdate');
        socket.off('availablePositions');
        socket.off('error');
      }
    };
  }, [socket]);

  const showPositionSelection = (targetRoomId) => {
    setPendingRoomId(targetRoomId);
    setSelectedPosition(null);
    if (socket) {
      socket.emit('getAvailablePositions', targetRoomId);
    }
    setMode('selectPosition');
  };

  const confirmPositionSelection = () => {
    if (selectedPosition === null) {
      showNotification('Please select a position', 'error');
      return;
    }

    if (!pendingRoomId) {
      showNotification('No room selected', 'error');
      return;
    }

    onJoinRoom(pendingRoomId, playerName.trim(), selectedPosition);
    setMode('game');
  };

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
      
      showPositionSelection(data.roomId);
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

    showPositionSelection(roomId.trim());
  };

  const joinRoomFromList = (selectedRoomId) => {
    if (!playerName.trim()) {
      showNotification('Please enter your name first', 'error');
      return;
    }

    showPositionSelection(selectedRoomId);
  };

  if (mode === 'game') {
    return <GridSquareGame socket={socket} roomId={roomId} connected={connected} myPlayerIndex={myPlayerIndex}  onLeaveRoom={onLeaveRoom} ></GridSquareGame> // GridSquareGame component would be rendered here
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Notification */}
        {notification && (
          <div className="fixed top-6 right-6 z-50 animate-slide-in">
            <div
              className={`px-6 py-4 rounded-xl shadow-lg text-white font-medium ${
                notification.type === 'success' ? 'bg-green-500' :
                notification.type === 'error' ? 'bg-red-500' :
                'bg-blue-500'
              }`}
            >
              {notification.message}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Square className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Square Game</h1>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 text-sm">
              <button className="text-gray-600 hover:text-gray-900 font-medium">Game</button>
              <button className="text-gray-600 hover:text-gray-900 font-medium">Rules</button>
              <button className="text-gray-600 hover:text-gray-900 font-medium">Leaderboard</button>
              <button className="text-gray-600 hover:text-gray-900 font-medium">Profile</button>
            </div>
            
            <button className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors">
              New Game
            </button>
          </div>
        </div>

        {/* Connection Status - Subtle */}
        {!connected && (
          <div className="mb-6 flex items-center justify-center gap-2 text-sm text-amber-600 bg-amber-50 py-2 rounded-lg">
            <WifiOff className="w-4 h-4" />
            <span>Connecting to server...</span>
          </div>
        )}

        {mode === 'lobby' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content - Left Side */}
            <div className="lg:col-span-2 space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-xl p-5 border border-gray-200">
                  <div className="text-sm text-gray-600 mb-1">Players Online</div>
                  <div className="text-3xl font-bold text-gray-900">{lobbyStats.totalPlayers}</div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-gray-200">
                  <div className="text-sm text-gray-600 mb-1">Active Rooms</div>
                  <div className="text-3xl font-bold text-gray-900">{lobbyStats.totalRooms}</div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-gray-200">
                  <div className="text-sm text-gray-600 mb-1">In Progress</div>
                  <div className="text-3xl font-bold text-gray-900">
                    {rooms.filter(r => r.gameStarted && !r.gameOver).length}
                  </div>
                </div>
              </div>

              {/* Room List */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900">Available Rooms</h2>
                  <button
                    onClick={fetchRooms}
                    disabled={refreshing}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="p-6">
                  {rooms.length === 0 ? (
                    <div className="text-center py-12">
                      <Square className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-gray-600 font-medium">No active rooms</p>
                      <p className="text-sm text-gray-500 mt-1">Create a room to get started!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {rooms.map((room) => (
                        <div
                          key={room.roomId}
                          className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-3">
                                <span className="text-gray-900 font-bold font-mono">
                                  #{room.roomId}
                                </span>
                                {room.gameStarted && !room.gameOver && (
                                  <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-md">
                                    In Progress
                                  </span>
                                )}
                                {room.gameOver && (
                                  <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-md">
                                    Finished
                                  </span>
                                )}
                                {!room.gameStarted && (
                                  <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-md">
                                    Waiting
                                  </span>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                                <Users className="w-4 h-4" />
                                <span>{room.playerCount}/{room.maxPlayers} Players</span>
                              </div>

                              {room.players.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {room.players.map((player, idx) => (
                                    <span
                                      key={idx}
                                      className={`px-3 py-1.5 ${PLAYER_COLORS[player.playerIndex]} text-white text-sm font-medium rounded-lg`}
                                    >
                                      {player.name}
                                    </span>
                                  ))}
                                  {room.playerCount < room.maxPlayers && (
                                    <span className="px-3 py-1.5 bg-gray-100 text-gray-500 text-sm font-medium rounded-lg border-2 border-dashed border-gray-300">
                                      Empty
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            <button
                              onClick={() => joinRoomFromList(room.roomId)}
                              disabled={!playerName.trim() || room.playerCount >= room.maxPlayers}
                              className="ml-4 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {room.playerCount >= room.maxPlayers ? 'Full' : 'Join'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar - Right Side */}
            <div className="space-y-6">
              {/* Player Name Input */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <label className="block text-sm font-semibold text-gray-900 mb-3">Your Name</label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder-gray-400"
                  onKeyPress={(e) => e.key === 'Enter' && playerName.trim() && setMode('create')}
                />
              </div>

              {/* Action Buttons */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
                <button
                  onClick={() => setMode('create')}
                  disabled={!connected || !playerName.trim()}
                  className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Create New Room
                </button>
                
                <button
                  onClick={() => setMode('join')}
                  disabled={!connected || !playerName.trim()}
                  className="w-full px-4 py-3 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-lg border-2 border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  <LogIn className="w-5 h-5" />
                  Join by Room ID
                </button>
              </div>

              {/* Connection Status Card */}
              {connected && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-green-700">
                    <Wifi className="w-5 h-5" />
                    <span className="font-medium">Connected to server</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : mode === 'create' ? (
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-xl border border-gray-200 p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Room</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Your Name</label>
                  <input
                    type="text"
                    placeholder="Enter your name"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                    onKeyPress={(e) => e.key === 'Enter' && createRoom()}
                  />
                </div>
                
                <button
                  onClick={createRoom}
                  disabled={!connected || !playerName.trim()}
                  className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Create Room & Start
                </button>
                
                <button
                  onClick={() => setMode('lobby')}
                  className="w-full px-4 py-3 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-lg border border-gray-300 transition-colors"
                >
                  Back to Lobby
                </button>
              </div>
            </div>
          </div>
        ) : mode === 'selectPosition' ? (
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-xl border border-gray-200 p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Your Position</h2>
              <p className="text-gray-600 mb-6">Room: <span className="font-mono font-semibold">#{pendingRoomId}</span></p>
              
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {[0, 1, 2].map((position) => {
                    const isAvailable = availablePositions.includes(position);
                    const isSelected = selectedPosition === position;
                    
                    return (
                      <button
                        key={position}
                        onClick={() => isAvailable && setSelectedPosition(position)}
                        disabled={!isAvailable}
                        className={`p-6 rounded-xl border-2 transition-all ${
                          isSelected
                            ? `${PLAYER_COLORS[position]} border-indigo-600 ring-4 ring-indigo-200`
                            : isAvailable
                            ? `${PLAYER_COLORS[position]} border-gray-300 hover:border-indigo-400 opacity-70 hover:opacity-100`
                            : 'bg-gray-100 border-gray-300 opacity-40 cursor-not-allowed'
                        }`}
                      >
                        <div className="text-center">
                          <div className="text-2xl font-bold text-white mb-1">
                            {position + 1}
                          </div>
                          <div className="text-sm text-white font-medium">
                            {isAvailable ? 'Available' : 'Taken'}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={confirmPositionSelection}
                  disabled={selectedPosition === null || !connected}
                  className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Confirm & Join
                </button>
                
                <button
                  onClick={() => setMode('lobby')}
                  className="w-full px-4 py-3 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-lg border border-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-xl border border-gray-200 p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Join Room by ID</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Your Name</label>
                  <input
                    type="text"
                    placeholder="Enter your name"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Room ID</label>
                  <input
                    type="text"
                    placeholder="000000"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-gray-900"
                    maxLength={6}
                    onKeyPress={(e) => e.key === 'Enter' && joinRoom()}
                  />
                </div>
                
                <button
                  onClick={joinRoom}
                  disabled={!connected || !playerName.trim() || roomId.length !== 6}
                  className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Join Room
                </button>
                
                <button
                  onClick={() => setMode('lobby')}
                  className="w-full px-4 py-3 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-lg border border-gray-300 transition-colors"
                >
                  Back to Lobby
                </button>
              </div>
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
    </div>
  );
}