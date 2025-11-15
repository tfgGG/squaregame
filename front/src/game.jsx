import React, { useState, useEffect } from 'react';
import { Users, Trophy, Square, Circle } from 'lucide-react';

const GRID_SIZE = 8;
const MAX_TURNS = 10;
const PLAYERS = ['Player 1', 'Player 2', 'Player 3'];
const PLAYER_COLORS = ['bg-blue-500', 'bg-green-500', 'bg-purple-500'];
const PLAYER_BORDERS = ['border-blue-500', 'border-green-500', 'border-purple-500'];

export default function GridSquareGame() {
  const [gameState, setGameState] = useState({
    grid: Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null)),
    currentPlayer: 0,
    scores: [0, 0, 0],
    turns: [0, 0, 0],
    circledAreas: [],
    gameOver: false,
    selectedNumber: 1,
    hasPlaced: false
  });

  const [selectingArea, setSelectingArea] = useState(false);
  const [areaStart, setAreaStart] = useState(null);
  const [areaEnd, setAreaEnd] = useState(null);

  // Check if a number is a perfect square
  const isPerfectSquare = (num) => {
    const sqrt = Math.sqrt(num);
    return sqrt === Math.floor(sqrt);
  };

  // Place a number on the grid
  const placeNumber = (row, col) => {
    if (gameState.gameOver || gameState.grid[row][col] !== null || gameState.hasPlaced) return;

    const newGrid = gameState.grid.map(r => [...r]);
    newGrid[row][col] = {
      value: gameState.selectedNumber,
      player: gameState.currentPlayer
    };

    setGameState(prev => ({
      ...prev,
      grid: newGrid,
      hasPlaced: true
    }));
  };

  // Start selecting an area to circle
  const startAreaSelection = () => {
    setSelectingArea(true);
    setAreaStart(null);
    setAreaEnd(null);
  };

  // Handle cell click during area selection
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

  // Confirm the selected area
  const confirmArea = () => {
    if (!areaStart || !areaEnd) return;

    const minRow = Math.min(areaStart.row, areaEnd.row);
    const maxRow = Math.max(areaStart.row, areaEnd.row);
    const minCol = Math.min(areaStart.col, areaEnd.col);
    const maxCol = Math.max(areaStart.col, areaEnd.col);

    const width = maxCol - minCol + 1;
    const height = maxRow - minRow + 1;

    // Check if it's a square
    if (width !== height) {
      alert('Selected area must be a square shape (width must equal height)!');
      cancelAreaSelection();
      return;
    }

    // Must be at least 2x2
    if (width < 2) {
      alert('Square must be at least 2×2!');
      cancelAreaSelection();
      return;
    }

    // Calculate sum and check ownership
    let sum = 0;
    const playerCounts = [0, 0, 0];
    let totalCells = 0;

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const cell = gameState.grid[r][c];
        if (cell !== null) {
          sum += cell.value;
          playerCounts[cell.player]++;
          totalCells++;
        }
      }
    }

    // Check if there are any numbers in the square
    if (totalCells === 0) {
      alert('The selected area has no numbers!');
      cancelAreaSelection();
      return;
    }

    // Check if sum is a perfect square
    if (!isPerfectSquare(sum)) {
      alert(`Sum is ${sum}, which is NOT a perfect square!\n(Perfect squares: 1, 4, 9, 16, 25, 36, 49, 64, 81, 100...)`);
      cancelAreaSelection();
      return;
    }

    // Find players with maximum occupied cells
    const maxCount = Math.max(...playerCounts);
    
    // Only players with cells in the square can win
    if (maxCount === 0) {
      alert('No player has placed numbers in this area!');
      cancelAreaSelection();
      return;
    }

    const winners = [];
    for (let i = 0; i < 3; i++) {
      if (playerCounts[i] === maxCount && playerCounts[i] > 0) {
        winners.push(i);
      }
    }

    // Calculate scores
    const newScores = [...gameState.scores];
    const scorePerWinner = sum / winners.length;
    winners.forEach(player => {
      newScores[player] += scorePerWinner;
    });

    // Add circled area
    const newCircledAreas = [...gameState.circledAreas, {
      minRow, maxRow, minCol, maxCol, sum, winners, playerCounts: [...playerCounts]
    }];

    // Move to next player and update turns
    const newTurns = [...gameState.turns];
    newTurns[gameState.currentPlayer]++;
    const nextPlayer = (gameState.currentPlayer + 1) % 3;
    const gameOver = newTurns.every(t => t >= MAX_TURNS);

    setGameState(prev => ({
      ...prev,
      scores: newScores,
      circledAreas: newCircledAreas,
      currentPlayer: nextPlayer,
      turns: newTurns,
      gameOver,
      hasPlaced: false
    }));

    cancelAreaSelection();
  };

  const cancelAreaSelection = () => {
    setSelectingArea(false);
    setAreaStart(null);
    setAreaEnd(null);
  };

  // Skip turn without circling
  const skipTurn = () => {
    if (!gameState.hasPlaced) {
      alert('You must place a number first!');
      return;
    }

    const newTurns = [...gameState.turns];
    newTurns[gameState.currentPlayer]++;
    const nextPlayer = (gameState.currentPlayer + 1) % 3;
    const gameOver = newTurns.every(t => t >= MAX_TURNS);

    setGameState(prev => ({
      ...prev,
      currentPlayer: nextPlayer,
      turns: newTurns,
      gameOver,
      hasPlaced: false
    }));
  };

  // Check if cell is within selected area
  const isCellInSelection = (row, col) => {
    if (!areaStart) return false;
    if (!areaEnd) return row === areaStart.row && col === areaStart.col;

    const minRow = Math.min(areaStart.row, areaEnd.row);
    const maxRow = Math.max(areaStart.row, areaEnd.row);
    const minCol = Math.min(areaStart.col, areaEnd.col);
    const maxCol = Math.max(areaStart.col, areaEnd.col);

    return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
  };

  // Check if cell is in a circled area
  const isCellCircled = (row, col) => {
    return gameState.circledAreas.some(area =>
      row >= area.minRow && row <= area.maxRow &&
      col >= area.minCol && col <= area.maxCol
    );
  };

  const resetGame = () => {
    setGameState({
      grid: Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null)),
      currentPlayer: 0,
      scores: [0, 0, 0],
      turns: [0, 0, 0],
      circledAreas: [],
      gameOver: false,
      selectedNumber: 1,
      hasPlaced: false
    });
    setSelectingArea(false);
    setAreaStart(null);
    setAreaEnd(null);
  };

  const winner = gameState.gameOver
    ? gameState.scores.indexOf(Math.max(...gameState.scores))
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center justify-center gap-3">
            <Square className="w-10 h-10" />
            Grid Square Number Game
          </h1>
          <p className="text-slate-300">Place numbers, form perfect squares, and score!</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {PLAYERS.map((name, idx) => (
            <div
              key={idx}
              className={`${
                gameState.currentPlayer === idx && !gameState.gameOver
                  ? 'ring-4 ring-yellow-400'
                  : ''
              } bg-slate-800 rounded-lg p-4 transition-all`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full ${PLAYER_COLORS[idx]}`} />
                  <span className="text-white font-semibold">{name}</span>
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
          ))}
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
                    disabled={gameState.gameOver || gameState.hasPlaced}
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
                    disabled={gameState.gameOver || !gameState.hasPlaced}
                    className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Circle className="w-4 h-4" />
                    Circle Area
                  </button>
                  <button
                    onClick={skipTurn}
                    disabled={gameState.gameOver || !gameState.hasPlaced}
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
                Reset Game
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
                      disabled={gameState.gameOver || (cell !== null && !selectingArea)}
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

          {!gameState.hasPlaced && !selectingArea && !gameState.gameOver && (
            <div className="mt-4 text-cyan-400 font-semibold">
              {PLAYERS[gameState.currentPlayer]}'s turn: Place a number on the grid
            </div>
          )}

          {gameState.hasPlaced && !selectingArea && !gameState.gameOver && (
            <div className="mt-4 text-green-400 font-semibold">
              Number placed! Choose to "Circle Area" to score, or "Skip Turn" to pass
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
                        {name}: {area.playerCounts[pIdx]}
                      </span>
                    ))}
                  </div>
                  <div className="mt-1 text-sm">
                    <span className="text-yellow-400 font-semibold">
                      Winner{area.winners.length > 1 ? 's' : ''}: {area.winners.map(p => PLAYERS[p]).join(' & ')} 
                      {area.winners.length > 1 ? ` (${area.sum / area.winners.length} points each)` : ` (${area.sum} points)`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}