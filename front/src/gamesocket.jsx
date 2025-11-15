import React, { useState, useEffect } from 'react';
import { Users, Trophy, Square, Circle, Wifi, WifiOff, Plus, LogIn, Copy, Check } from 'lucide-react';
import io from 'socket.io-client';

const GRID_SIZE = 8;
const MAX_TURNS = 10;
const PLAYERS = ['Player 1', 'Player 2', 'Player 3'];
const PLAYER_COLORS = ['bg-blue-500', 'bg-green-500', 'bg-purple-500'];
const PLAYER_BORDERS = ['border-blue-500', 'border-green-500', 'border-purple-500'];

// Connect to backend
const SOCKET_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.cardhubtw.com'
  : 'http://localhost:3001';

export default function GridSquareGame({socket,roomId,connected,myPlayerIndex,onLeaveRoom}) {
  const [playerName, setPlayerName] = useState('');
  const [currentRoomId, setCurrentRoomId] = useState(roomId);
  const [joined, setJoined] = useState(false);
  const [copied, setCopied] = useState(false);

  const [gameState, setGameState] = useState({
    grid: Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null)),
    currentPlayer: 0,
    scores: [0, 0, 0],
    turns: [0, 0, 0],
    circledAreas: [],
    gameOver: false,
    selectedNumber: 1,
    hasPlaced: false,
    players: {}
  });

  const [selectingArea, setSelectingArea] = useState(false);
  const [areaStart, setAreaStart] = useState(null);
  const [areaEnd, setAreaEnd] = useState(null);
  const [notifications, setNotifications] = useState([]);

  // Initialize socket connection
  useEffect(() => {
    if (!socket) return;

    const handleRoomJoined = (data) => {
      setCurrentRoomId(data.roomId);
      addNotification(`Joined room ${data.roomId}`, 'success');
    };

    const handleGameStateUpdate = (state) => {
      setGameState(prevState => ({
        ...state,
        selectedNumber: prevState.selectedNumber
      }));
    };

    const handlePlayerJoined = (data) => {
      addNotification(`${data.name} joined the game! (${data.totalPlayers}/3)`, 'success');
    };

    const handlePlayerLeft = (data) => {
      addNotification(`${data.name} left the game`, 'warning');
    };

    const handleNumberPlaced = (data) => {
      addNotification(`${data.playerName} placed ${data.value} at (${data.row}, ${data.col})`, 'info');
    };

    const handleAreaCircled = (data) => {
      setGameState(prevState => {
        const winnerNames = data.winners.map(idx => {
          const playerEntries = Object.entries(prevState.players);
          const playerEntry = playerEntries.find(([_, p]) => p.playerIndex === idx);
          return playerEntry ? playerEntry[1].name : `Player ${idx + 1}`;
        }).join(' & ');
        addNotification(`${data.playerName} scored! Winners: ${winnerNames} (${data.sum} points)`, 'success');
        return prevState;
      });
    };

    const handleTurnSkipped = (data) => {
      addNotification(`${data.playerName} skipped their turn`, 'info');
    };

    const handleGameOver = (data) => {
      setGameState(prevState => {
        const playerEntries = Object.entries(prevState.players);
        const winnerEntry = playerEntries.find(([_, p]) => p.playerIndex === data.winner);
        const winnerName = winnerEntry ? winnerEntry[1].name : `Player ${data.winner + 1}`;
        addNotification(`Game Over! ${winnerName} wins!`, 'success');
        return prevState;
      });
    };

    const handleError = (data) => {
      addNotification(data.message, 'error');
    };

    socket.on('roomJoined', handleRoomJoined);
    socket.on('gameStateUpdate', handleGameStateUpdate);
    socket.on('playerJoined', handlePlayerJoined);
    socket.on('playerLeft', handlePlayerLeft);
    socket.on('numberPlaced', handleNumberPlaced);
    socket.on('areaCircled', handleAreaCircled);
    socket.on('turnSkipped', handleTurnSkipped);
    socket.on('gameOver', handleGameOver);
    socket.on('error', handleError);

    return () => {
      // Remove all event listeners but don't close the socket
      // The socket is managed by App.jsx and should remain open
      socket.off('roomJoined', handleRoomJoined);
      socket.off('gameStateUpdate', handleGameStateUpdate);
      socket.off('playerJoined', handlePlayerJoined);
      socket.off('playerLeft', handlePlayerLeft);
      socket.off('numberPlaced', handleNumberPlaced);
      socket.off('areaCircled', handleAreaCircled);
      socket.off('turnSkipped', handleTurnSkipped);
      socket.off('gameOver', handleGameOver);
      socket.off('error', handleError);
    };
  }, [socket]);

  const addNotification = (message, type) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(currentRoomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addNotification('Room ID copied to clipboard!', 'success');
  };

  const placeNumber = (row, col) => {
    if (!isMyTurn() || gameState.gameOver || gameState.grid[row][col] !== null || gameState.hasPlaced) {
      return;
    }

    if (socket) {
      socket.emit('placeNumber', {
        row,
        col,
        value: gameState.selectedNumber
      });
    }
  };

  const startAreaSelection = () => {
    if (!isMyTurn() || !gameState.hasPlaced) return;
    setSelectingArea(true);
    setAreaStart(null);
    setAreaEnd(null);
  };

  const handleCellClick = (row, col) => {
    if (selectingArea) {
      if (!areaStart) {
        setAreaStart({ row, col });
      } else {
        setAreaEnd({ row, col });
      }
    } else {
      placeNumber(row, col);
    }
  };

  const confirmArea = () => {
    if (!areaStart || !areaEnd || !socket) return;

    const minRow = Math.min(areaStart.row, areaEnd.row);
    const maxRow = Math.max(areaStart.row, areaEnd.row);
    const minCol = Math.min(areaStart.col, areaEnd.col);
    const maxCol = Math.max(areaStart.col, areaEnd.col);

    socket.emit('circleArea', {
      minRow, maxRow, minCol, maxCol
    });

    cancelAreaSelection();
  };

  const cancelAreaSelection = () => {
    setSelectingArea(false);
    setAreaStart(null);
    setAreaEnd(null);
  };

  const skipTurn = () => {
    if (!isMyTurn() || !gameState.hasPlaced || !socket) return;
    socket.emit('skipTurn');
  };

  const resetGame = async () => {
    if (!currentRoomId) return;
    
    try {
      await fetch(`${SOCKET_URL}/api/room/${currentRoomId}/reset`, {
        method: 'POST'
      });
      cancelAreaSelection();
    } catch (error) {
      console.error('Error resetting game:', error);
    }
  };

  const isMyTurn = () => {
    return myPlayerIndex !== null && gameState.currentPlayer === myPlayerIndex;
  };

  const isCellInSelection = (row, col) => {
    if (!areaStart) return false;
    if (!areaEnd) return row === areaStart.row && col === areaStart.col;

    const minRow = Math.min(areaStart.row, areaEnd.row);
    const maxRow = Math.max(areaStart.row, areaEnd.row);
    const minCol = Math.min(areaStart.col, areaEnd.col);
    const maxCol = Math.max(areaStart.col, areaEnd.col);

    return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
  };

  const isCellCircled = (row, col) => {
    return gameState.circledAreas.some(area =>
      row >= area.minRow && row <= area.maxRow &&
      col >= area.minCol && col <= area.maxCol
    );
  };

  const winner = gameState.gameOver
    ? gameState.scores.indexOf(Math.max(...gameState.scores))
    : null;

  const getPlayerName = (playerIndex) => {
    const playerEntry = Object.entries(gameState.players).find(([_, p]) => p.playerIndex === playerIndex);
    return playerEntry ? playerEntry[1].name : `Player ${playerIndex + 1}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Notifications */}
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {notifications.map(notif => (
            <div
              key={notif.id}
              className={`px-4 py-3 rounded-lg shadow-lg text-white animate-slide-in ${
                notif.type === 'success' ? 'bg-green-600' :
                notif.type === 'error' ? 'bg-red-600' :
                notif.type === 'warning' ? 'bg-yellow-600' :
                'bg-blue-600'
              }`}
            >
              {notif.message}
            </div>
          ))}
        </div>

        {/* Header with Room ID */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center justify-center gap-3">
            <Square className="w-10 h-10" />
            Grid Square Number Game
            {connected ? (
              <Wifi className="w-6 h-6 text-green-400" />
            ) : (
              <WifiOff className="w-6 h-6 text-red-400" />
            )}
          </h1>
          
          <div className="flex items-center justify-center gap-3 mt-4">
            <div className="bg-slate-700 px-6 py-2 rounded-lg">
              <span className="text-slate-400 text-sm">Room ID: </span>
              <span className="text-white font-mono text-xl tracking-wider">{currentRoomId}</span>
            </div>
            <button
              onClick={copyRoomId}
              className="p-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
              title="Copy Room ID"
            >
              {copied ? <Check className="w-5 h-5 text-white" /> : <Copy className="w-5 h-5 text-white" />}
            </button>
          </div>
          
          <p className="text-slate-300 mt-2">
            You are: <span className={`font-bold ${myPlayerIndex !== null ? `text-${PLAYER_COLORS[myPlayerIndex].split('-')[1]}-400` : ''}`}>
              {getPlayerName(myPlayerIndex)}
            </span>
          </p>
          {isMyTurn() && (
            <p className="text-yellow-400 font-semibold mt-2 animate-pulse">
              🎮 It's your turn!
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {PLAYERS.map((name, idx) => {
            const playerName = getPlayerName(idx);
            const isActive = Object.values(gameState.players).some(p => p.playerIndex === idx);
            
            return (
              <div
                key={idx}
                className={`${
                  gameState.currentPlayer === idx && !gameState.gameOver
                    ? 'ring-4 ring-yellow-400'
                    : ''
                } ${
                  idx === myPlayerIndex ? 'ring-2 ring-white' : ''
                } ${
                  !isActive ? 'opacity-50' : ''
                } bg-slate-800 rounded-lg p-4 transition-all`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full ${PLAYER_COLORS[idx]}`} />
                    <span className="text-white font-semibold">
                      {playerName}
                      {idx === myPlayerIndex && ' (You)'}
                    </span>
                    {!isActive && <span className="text-xs text-slate-500">(Waiting)</span>}
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-white">{gameState.scores[idx]}</div>
                    <div className="text-xs text-slate-400">
                      {gameState.turns[idx]}/{MAX_TURNS} turns
                    </div>
                  </div>
                </div>
                {winner === idx && (
                  <div className="mt-2 text-center bg-yellow-500 text-black font-bold py-1 rounded flex items-center justify-center gap-1">
                    <Trophy className="w-4 h-4" />
                    Winner!
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="bg-slate-800 rounded-lg p-6 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="text-white font-semibold">Select Number:</span>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                  <button
                    key={num}
                    onClick={() => setGameState(prev => ({ ...prev, selectedNumber: num }))}
                    className={`w-10 h-10 rounded ${
                      gameState.selectedNumber === num
                        ? `${PLAYER_COLORS[gameState.currentPlayer]} text-white`
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    } font-bold transition-colors`}
                    disabled={gameState.gameOver || gameState.hasPlaced || !isMyTurn()}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              {!selectingArea ? (
                <>
                  <button
                    onClick={startAreaSelection}
                    disabled={gameState.gameOver || !gameState.hasPlaced || !isMyTurn()}
                    className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Circle className="w-4 h-4" />
                    Circle Area
                  </button>
                  <button
                    onClick={skipTurn}
                    disabled={gameState.gameOver || !gameState.hasPlaced || !isMyTurn()}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Skip Turn
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={confirmArea}
                    disabled={!areaStart || !areaEnd}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={cancelAreaSelection}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded transition-colors"
                  >
                    Cancel
                  </button>
                </>
              )}
              <button
                onClick={resetGame}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded transition-colors"
              >
                Reset
              </button>
              <button
                onClick={onLeaveRoom}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded transition-colors"
              >
                Leave Room
              </button>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6">
          <div className="inline-block">
            {gameState.grid.map((row, rowIdx) => (
              <div key={rowIdx} className="flex">
                {row.map((cell, colIdx) => {
                  const isSelected = isCellInSelection(rowIdx, colIdx);
                  const isCircled = isCellCircled(rowIdx, colIdx);
                  return (
                    <button
                      key={colIdx}
                      onClick={() => handleCellClick(rowIdx, colIdx)}
                      disabled={gameState.gameOver || (cell !== null && !selectingArea) || !isMyTurn()}
                      className={`w-14 h-14 border-2 font-bold text-lg transition-all ${
                        cell
                          ? `${PLAYER_COLORS[cell.player]} text-white ${PLAYER_BORDERS[cell.player]}`
                          : 'bg-slate-700 border-slate-600 hover:bg-slate-600'
                      } ${isSelected ? 'ring-4 ring-yellow-400' : ''} ${
                        isCircled ? 'opacity-60' : ''
                      } disabled:cursor-not-allowed`}
                    >
                      {cell ? cell.value : ''}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {selectingArea && (
            <div className="mt-4 text-yellow-400 font-semibold">
              {!areaStart
                ? 'Click the top-left corner of your square'
                : !areaEnd
                ? 'Click the bottom-right corner of your square'
                : 'Click Confirm to score this area'}
            </div>
          )}

          {!gameState.hasPlaced && !selectingArea && !gameState.gameOver && isMyTurn() && (
            <div className="mt-4 text-cyan-400 font-semibold">
              Your turn: Place a number on the grid
            </div>
          )}

          {gameState.hasPlaced && !selectingArea && !gameState.gameOver && isMyTurn() && (
            <div className="mt-4 text-green-400 font-semibold">
              Number placed! Choose to "Circle Area" to score, or "Skip Turn" to pass
            </div>
          )}

          {!isMyTurn() && !gameState.gameOver && (
            <div className="mt-4 text-slate-400 font-semibold">
              Waiting for {getPlayerName(gameState.currentPlayer)}'s turn...
            </div>
          )}
        </div>

        {gameState.circledAreas.length > 0 && (
          <div className="mt-6 bg-slate-800 rounded-lg p-6">
            <h3 className="text-xl font-bold text-white mb-4">Scored Areas</h3>
            <div className="space-y-2">
              {gameState.circledAreas.map((area, idx) => (
                <div key={idx} className="bg-slate-700 rounded p-3 text-white">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">
                      {area.maxRow - area.minRow + 1}×{area.maxCol - area.minCol + 1} Square:
                    </span>
                    <span>Sum = {area.sum} (√{area.sum} = {Math.sqrt(area.sum)})</span>
                  </div>
                  <div className="mt-1 text-sm">
                    <span className="text-slate-300">Cells occupied: </span>
                    {PLAYERS.map((name, pIdx) => (
                      <span key={pIdx} className="ml-2">
                        <span className={`inline-block w-3 h-3 rounded-full ${PLAYER_COLORS[pIdx]} mr-1`}></span>
                        {getPlayerName(pIdx)}: {area.playerCounts[pIdx]}
                      </span>
                    ))}
                  </div>
                  <div className="mt-1 text-sm">
                    <span className="text-yellow-400 font-semibold">
                      Winner{area.winners.length > 1 ? 's' : ''}: {area.winners.map(p => getPlayerName(p)).join(' & ')} 
                      {area.winners.length > 1 ? ` (${area.sum / area.winners.length} points each)` : ` (${area.sum} points)`}
                    </span>
                  </div>
                </div>
              ))}
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
      `}</style>
    </div>
  );
}