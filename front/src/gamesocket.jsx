import React, { useState, useEffect, useRef } from 'react';
import { Users, Trophy, Square, Circle, Wifi, WifiOff, Copy, Check, X, Home } from 'lucide-react';

const GRID_SIZE = 8;
const MAX_TURNS = 8;
const PLAYERS = ['Player 1', 'Player 2', 'Player 3'];
const PLAYER_COLORS = ['bg-blue-500', 'bg-green-500', 'bg-purple-500'];
const PLAYER_TEXT_COLORS = ['text-blue-600', 'text-green-600', 'text-purple-600'];

const SOCKET_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.cardhubtw.com'
  : 'http://localhost:3001';

export default function GridSquareGame({socket, roomId, connected, myPlayerIndex, onLeaveRoom}) {
  const [playerName, setPlayerName] = useState('');
  const [currentRoomId, setCurrentRoomId] = useState(roomId);
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
  const [pendingCell, setPendingCell] = useState(null);
  const pendingCellRef = useRef(null);

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
      if (state.hasPlaced && pendingCellRef.current) {
        setPendingCell(null);
        pendingCellRef.current = null;
      }
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

  const placeNumber = (row, col, value) => {
    if (!isMyTurn() || gameState.gameOver || gameState.grid[row][col] !== null || gameState.hasPlaced) {
      return;
    }

    if (socket) {
      socket.emit('placeNumber', {
        row,
        col,
        value: value || gameState.selectedNumber
      });
      setPendingCell(null);
      pendingCellRef.current = null;
    }
  };

  const handleNumberSelect = (number) => {
    if (pendingCell) {
      placeNumber(pendingCell.row, pendingCell.col, number);
      setGameState(prev => ({ ...prev, selectedNumber: number }));
    }
  };

  const startAreaSelection = () => {
    if (!isMyTurn() || !gameState.hasPlaced) return;
    setSelectingArea(true);
    setAreaStart(null);
    setAreaEnd(null);
  };

  const handleCellClick = (row, col, e) => {
    if (selectingArea) {
      if (!areaStart) {
        setAreaStart({ row, col });
      } else {
        setAreaEnd({ row, col });
      }
    } else {
      // Allow changing cell selection before placing number
      if (gameState.grid[row][col] === null && isMyTurn() && !gameState.gameOver && !gameState.hasPlaced) {
        if (e) {
          e.stopPropagation();
        }
        // Always update pending cell, even if there's already one selected
        setPendingCell({ row, col });
        pendingCellRef.current = { row, col };
      }
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
    setPendingCell(null);
    pendingCellRef.current = null;
    socket.emit('skipTurn');
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pendingCell) {
        if (e.target.closest('.number-picker-overlay')) {
          return;
        }
        
        const gridContainer = e.target.closest('.grid-container');
        if (gridContainer) {
          const cellButton = e.target.closest('button');
          if (cellButton && !cellButton.disabled) {
            // Allow clicking on another empty cell to change selection
            return;
          }
        }
        
        // Close overlay for clicks outside the grid
        setPendingCell(null);
        pendingCellRef.current = null;
      }
    };

    if (pendingCell) {
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside, true);
      }, 100);
      
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside, true);
      };
    }
  }, [pendingCell]);

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

  const getCellClasses = (cell) => {
    if (!cell) {
      return 'bg-white border-gray-300 hover:bg-gray-50';
    }
    
    const player = cell.player;
    if (player === 0) {
      return 'bg-blue-500 text-white border-blue-500';
    } else if (player === 1) {
      return 'bg-green-500 text-white border-green-500';
    } else if (player === 2) {
      return 'bg-purple-500 text-white border-purple-500';
    }
    return 'bg-gray-200 text-gray-600 hover:bg-gray-300';
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

  const getWinners = () => {
    if (!gameState.gameOver) return [];
    const maxScore = Math.max(...gameState.scores);
    return gameState.scores
      .map((score, idx) => score === maxScore ? idx : -1)
      .filter(idx => idx !== -1);
  };
  
  const winners = getWinners();

  const getPlayerName = (playerIndex) => {
    const playerEntry = Object.entries(gameState.players).find(([_, p]) => p.playerIndex === playerIndex);
    return playerEntry ? playerEntry[1].name : `Player ${playerIndex + 1}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Notifications */}
        {notifications.map(notif => (
          <div key={notif.id} className="fixed top-6 right-6 z-50 animate-slide-in">
            <div className={`px-6 py-4 rounded-xl shadow-lg text-white font-medium ${
              notif.type === 'success' ? 'bg-green-500' :
              notif.type === 'error' ? 'bg-red-500' :
              notif.type === 'warning' ? 'bg-amber-500' :
              'bg-blue-500'
            }`}>
              {notif.message}
            </div>
          </div>
        ))}

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Square className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Square Game</h1>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Room: <span className="font-mono font-semibold text-gray-900">#{currentRoomId}</span></span>
                <button
                  onClick={copyRoomId}
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                  title="Copy Room ID"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-gray-600" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {connected ? (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <Wifi className="w-4 h-4" />
                <span className="hidden sm:inline">Connected</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <WifiOff className="w-4 h-4" />
                <span className="hidden sm:inline">Disconnected</span>
              </div>
            )}
            
            <button
              onClick={onLeaveRoom}
              className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-900 font-medium rounded-lg border border-gray-300 transition-colors flex items-center gap-2"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Leave Room</span>
            </button>
          </div>
        </div>

        {/* Current Turn Indicator */}
        {isMyTurn() && !gameState.gameOver && (
          <div className="mb-6 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl p-4 text-center">
            <div className="text-lg font-bold">🎮 Your Turn!</div>
            <div className="text-sm mt-1">
              {!gameState.hasPlaced ? 'Place a number on the grid' : 'Circle an area or skip your turn'}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Game Board - Left/Center */}
          <div className="xl:col-span-2 space-y-6 order-3 xl:order-1">
            {/* Game Board Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Game Board</h2>
                <div className="text-sm text-gray-600">
                  Turn: <span className="font-semibold text-gray-900">{getPlayerName(gameState.currentPlayer)}</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <div className="inline-block min-w-fit grid-container">
                  {/* Column indices */}
                  <div className="flex ml-8">
                    {Array(GRID_SIZE).fill(0).map((_, idx) => (
                      <div key={idx} className="w-12 h-6 flex items-center justify-center text-xs font-semibold text-gray-600">
                        {idx}
                      </div>
                    ))}
                  </div>

                  {/* Grid with row indices */}
                  {gameState.grid.map((row, rowIdx) => (
                    <div key={rowIdx} className="flex">
                      {/* Row index */}
                      <div className="w-8 h-12 flex items-center justify-center text-xs font-semibold text-gray-600">
                        {rowIdx}
                      </div>
                      
                      {/* Grid cells */}
                      {row.map((cell, colIdx) => {
                        const isSelected = isCellInSelection(rowIdx, colIdx);
                        const isCircled = isCellCircled(rowIdx, colIdx);
                        const isPending = pendingCell && pendingCell.row === rowIdx && pendingCell.col === colIdx;
                        
                        return (
                          <div key={colIdx} className="relative">
                            <button
                              onClick={(e) => handleCellClick(rowIdx, colIdx, e)}
                              disabled={gameState.gameOver || (cell !== null && !selectingArea) || !isMyTurn()}
                              className={`w-12 h-12 border-2 font-bold text-base transition-all rounded-lg ${getCellClasses(cell)} ${
                                isSelected ? 'ring-4 ring-amber-400 ring-offset-1' : ''
                              } ${
                                isPending ? 'ring-4 ring-indigo-500 ring-offset-1' : ''
                              } ${
                                isCircled ? 'opacity-50' : ''
                              } disabled:cursor-not-allowed`}
                            >
                              {cell ? cell.value : ''}
                            </button>
                            
                            {isPending && (
                              <div className="number-picker-overlay absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-50 bg-white rounded-xl p-4 shadow-2xl border-2 border-indigo-500">
                                <div className="text-xs font-semibold text-gray-700 mb-2 text-center">Select Number</div>
                                <div className="grid grid-cols-3 gap-2">
                                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                    <button
                                      key={num}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleNumberSelect(num);
                                      }}
                                      className={`w-10 h-10 rounded-lg font-bold text-base transition-all ${
                                        gameState.selectedNumber === num
                                          ? `${PLAYER_COLORS[gameState.currentPlayer]} text-white ring-2 ring-offset-1 ring-gray-900`
                                          : 'bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-300'
                                      }`}
                                    >
                                      {num}
                                    </button>
                                  ))}
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPendingCell(null);
                                    pendingCellRef.current = null;
                                  }}
                                  className="mt-3 w-full px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1"
                                >
                                  <X className="w-4 h-4" />
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Game Status Messages */}
              <div className="mt-4">
                {selectingArea && (
                  <div className="text-sm text-amber-600 font-medium bg-amber-50 rounded-lg p-3">
                    {!areaStart
                      ? '📍 Click the top-left corner of your square'
                      : !areaEnd
                      ? '📍 Click the bottom-right corner of your square'
                      : '✓ Click Confirm to score this area'}
                  </div>
                )}

                {!selectingArea && !gameState.gameOver && !isMyTurn() && (
                  <div className="text-sm text-gray-600 font-medium bg-gray-50 rounded-lg p-3">
                    ⏳ Waiting for {getPlayerName(gameState.currentPlayer)}'s turn...
                  </div>
                )}

                {pendingCell && (
                  <div className="text-sm text-indigo-600 font-medium bg-indigo-50 rounded-lg p-3">
                    💡 Select a number (1-9) to place at position ({pendingCell.row}, {pendingCell.col})
                  </div>
                )}
              </div>
            </div>

            {/* Scored Areas */}
            {gameState.circledAreas.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Valid Squares Found</h3>
                <div className="space-y-3">
                  {gameState.circledAreas.map((area, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-gray-900">
                          {area.maxRow - area.minRow + 1}×{area.maxCol - area.minCol + 1} Square
                        </span>
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">
                          Sum: {area.sum} (√{area.sum})
                        </span>
                      </div>
                      <div className="text-sm text-gray-700 mb-1">
                        {PLAYERS.map((name, pIdx) => (
                          <span key={pIdx} className="mr-3">
                            <span className={`inline-block w-3 h-3 rounded-full ${PLAYER_COLORS[pIdx]} mr-1`}></span>
                            {getPlayerName(pIdx)}: {area.playerCounts[pIdx]}
                          </span>
                        ))}
                      </div>
                      <div className="text-sm font-semibold text-amber-600">
                        🏆 Winner{area.winners.length > 1 ? 's' : ''}: {area.winners.map(p => getPlayerName(p)).join(' & ')}
                        {area.winners.length > 1 ? ` (${area.sum / area.winners.length} pts each)` : ` (+${area.sum} pts)`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Right */}
          <div className="space-y-6 order-1 xl:order-2">
            {/* Player Scores */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Players Score</h3>
              <div className="space-y-3">
                {PLAYERS.map((name, idx) => {
                  const playerName = getPlayerName(idx);
                  const isActive = Object.values(gameState.players).some(p => p.playerIndex === idx);
                  const isCurrentPlayer = gameState.currentPlayer === idx && !gameState.gameOver;
                  const isWinner = winners.includes(idx);
                  
                  return (
                    <div
                      key={idx}
                      className={`border-2 rounded-lg p-4 transition-all ${
                        isCurrentPlayer ? 'border-indigo-500 ring-2 ring-indigo-200' : 
                        idx === myPlayerIndex ? 'border-gray-400' :
                        'border-gray-200'
                      } ${!isActive ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full ${PLAYER_COLORS[idx]}`} />
                          <span className={`font-semibold text-gray-900 ${PLAYER_TEXT_COLORS[idx]}`}>
                            {playerName}
                          </span>
                          {idx === myPlayerIndex && (
                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-2xl font-bold text-gray-900">{gameState.scores[idx]}</div>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span>Turns: {gameState.turns[idx]}/{MAX_TURNS}</span>
                        {!isActive && <span className="text-amber-600 font-medium">Waiting...</span>}
                      </div>

                      {isWinner && (
                        <div className="mt-2 bg-gradient-to-r from-yellow-400 to-amber-500 text-white font-bold py-1.5 rounded-lg flex items-center justify-center gap-1.5 text-sm">
                          <Trophy className="w-4 h-4" />
                          {winners.length > 1 ? 'Tie!' : 'Winner!'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Actions</h3>
              
              <div className="space-y-3">
                {!selectingArea ? (
                  <div className="flex lg:flex-col flex-row gap-2">
                    <button
                      onClick={startAreaSelection}
                      disabled={gameState.gameOver || !gameState.hasPlaced || !isMyTurn()}
                      className="w-full px-4 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      <Circle className="w-5 h-5" />
                      Circle Square
                    </button>
                    
                    <button
                      onClick={skipTurn}
                      disabled={gameState.gameOver || !gameState.hasPlaced || !isMyTurn()}
                      className="w-full px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Skip Turn
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={confirmArea}
                      disabled={!areaStart || !areaEnd}
                      className="w-full px-4 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Confirm Area
                    </button>
                    
                    <button
                      onClick={cancelAreaSelection}
                      className="w-full px-4 py-3 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
                    >
                      Cancel Selection
                    </button>
                  </>
                )}
                
                <button
                  onClick={resetGame}
                  className="w-full px-4 py-3 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-lg border border-gray-300 transition-colors"
                >
                  Reset Game
                </button>
              </div>
            </div>
          </div>
        </div>
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