// server.js - Node.js Backend with Redis and Socket.IO - Room Support
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const redis = require('redis');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Redis client setup
const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
  }
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.on('connect', () => console.log('Redis Client Connected'));

// Connect to Redis
(async () => {
  await redisClient.connect();
})();

const GRID_SIZE = 8;
const MAX_TURNS = 8;

// Generate 6-digit room ID
function generateRoomId() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Initialize game state
function createInitialGameState() {
  return {
    grid: Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null)),
    currentPlayer: 0,
    scores: [0, 0, 0],
    turns: [0, 0, 0],
    circledAreas: [],
    gameOver: false,
    players: {},
    hasPlaced: false,
    roomId: null,
    createdAt: Date.now()
  };
}

// Helper function to get game state from Redis by room ID
async function getGameState(roomId) {
  try {
    const state = await redisClient.get(`room:${roomId}`);
    return state ? JSON.parse(state) : null;
  } catch (error) {
    console.error('Error getting game state:', error);
    return null;
  }
}

// Helper function to save game state to Redis
async function saveGameState(roomId, state) {
  try {
    await redisClient.set(`room:${roomId}`, JSON.stringify(state), {
      EX: 86400 // Expire after 24 hours
    });
    return true;
  } catch (error) {
    console.error('Error saving game state:', error);
    return false;
  }
}

// Helper function to check if room exists
async function roomExists(roomId) {
  try {
    const exists = await redisClient.exists(`room:${roomId}`);
    return exists === 1;
  } catch (error) {
    console.error('Error checking room:', error);
    return false;
  }
}

// Helper function to get all rooms
async function getAllRooms() {
  try {
    const keys = await redisClient.keys('room:*');
    const rooms = [];
    
    for (const key of keys) {
      const state = await redisClient.get(key);
      if (state) {
        const parsedState = JSON.parse(state);
        const playerList = Object.values(parsedState.players).map(p => ({
          name: p.name,
          playerIndex: p.playerIndex
        }));
        
        rooms.push({
          roomId: parsedState.roomId,
          playerCount: Object.keys(parsedState.players).length,
          maxPlayers: 3,
          players: playerList,
          gameStarted: parsedState.turns.some(t => t > 0),
          gameOver: parsedState.gameOver,
          createdAt: parsedState.createdAt
        });
      }
    }
    
    return rooms.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error('Error getting all rooms:', error);
    return [];
  }
}

// REST API Endpoints
app.get('/api/rooms', async (req, res) => {
  const rooms = await getAllRooms();
  const totalPlayers = rooms.reduce((sum, room) => sum + room.playerCount, 0);
  
  res.json({
    rooms,
    totalRooms: rooms.length,
    totalPlayers
  });
});

app.get('/api/room/:roomId', async (req, res) => {
  const { roomId } = req.params;
  const state = await getGameState(roomId);
  
  if (!state) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  res.json(state);
});

app.post('/api/room/create', async (req, res) => {
  let roomId = generateRoomId();
  
  // Ensure unique room ID
  while (await roomExists(roomId)) {
    roomId = generateRoomId();
  }
  
  const initialState = createInitialGameState();
  initialState.roomId = roomId;
  
  await saveGameState(roomId, initialState);
  
  res.json({ roomId, state: initialState });
});

app.post('/api/room/:roomId/reset', async (req, res) => {
  const { roomId } = req.params;
  const state = await getGameState(roomId);
  
  if (!state) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  const resetState = createInitialGameState();
  resetState.roomId = roomId;
  
  await saveGameState(roomId, resetState);
  io.to(roomId).emit('gameStateUpdate', resetState);
  
  res.json({ success: true, state: resetState });
});

app.delete('/api/room/:roomId', async (req, res) => {
  const { roomId } = req.params;
  
  try {
    await redisClient.del(`room:${roomId}`);
    io.to(roomId).emit('roomClosed');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

// Socket.IO connection handling
io.on('connection', async (socket) => {
  console.log('New client connected:', socket.id);
  
  let currentRoomId = null;

  // Join room
  socket.on('joinRoom', async (roomId) => {
    const exists = await roomExists(roomId);
    
    if (!exists) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    const state = await getGameState(roomId);
    
    // Check if room is full
    const playerCount = Object.keys(state.players).length;
    if (playerCount >= 3) {
      socket.emit('error', { message: 'Room is full (3/3 players)' });
      return;
    }
    
    // Join the socket.io room
    socket.join(roomId);
    currentRoomId = roomId;
    
    // Send current game state
    socket.emit('gameStateUpdate', state);
    socket.emit('roomJoined', { roomId });
    
    console.log(`Socket ${socket.id} joined room ${roomId}`);
  });

  // Register player in room
  socket.on('registerPlayer', async (data) => {
    const { playerName, roomId } = data;
    
    if (!currentRoomId && roomId) {
      currentRoomId = roomId;
      socket.join(roomId);
    }
    
    if (!currentRoomId) {
      socket.emit('error', { message: 'No room selected' });
      return;
    }
    
    const state = await getGameState(currentRoomId);
    
    if (!state) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    if (!state.players[socket.id]) {
      // Find available player slot
      const assignedSlots = Object.values(state.players).map(p => p.playerIndex);
      let playerIndex = -1;
      
      for (let i = 0; i < 3; i++) {
        if (!assignedSlots.includes(i)) {
          playerIndex = i;
          break;
        }
      }

      if (playerIndex !== -1) {
        state.players[socket.id] = {
          playerIndex,
          name: playerName || `Player ${playerIndex + 1}`,
          socketId: socket.id
        };
        
        await saveGameState(currentRoomId, state);
        io.to(currentRoomId).emit('gameStateUpdate', state);
        io.to(currentRoomId).emit('playerJoined', {
          playerIndex,
          name: state.players[socket.id].name,
          totalPlayers: Object.keys(state.players).length,
          roomId: currentRoomId
        });
      } else {
        socket.emit('error', { message: 'Room is full' });
      }
    }
  });

  // Place number on grid
  socket.on('placeNumber', async ({ row, col, value }) => {
    if (!currentRoomId) {
      socket.emit('error', { message: 'Not in a room' });
      return;
    }
    
    const state = await getGameState(currentRoomId);
    const player = state.players[socket.id];

    if (!player) {
      socket.emit('error', { message: 'Player not registered' });
      return;
    }

    if (player.playerIndex !== state.currentPlayer) {
      socket.emit('error', { message: 'Not your turn' });
      return;
    }

    if (state.gameOver || state.grid[row][col] !== null || state.hasPlaced) {
      socket.emit('error', { message: 'Invalid move' });
      return;
    }

    // Place the number
    state.grid[row][col] = {
      value: value,
      player: state.currentPlayer
    };
    state.hasPlaced = true;

    await saveGameState(currentRoomId, state);
    io.to(currentRoomId).emit('gameStateUpdate', state);
    io.to(currentRoomId).emit('numberPlaced', {
      row,
      col,
      value,
      player: state.currentPlayer,
      playerName: player.name
    });
  });

  // Circle area
  socket.on('circleArea', async ({ minRow, maxRow, minCol, maxCol }) => {
    if (!currentRoomId) {
      socket.emit('error', { message: 'Not in a room' });
      return;
    }
    
    const state = await getGameState(currentRoomId);
    const player = state.players[socket.id];

    if (!player) {
      socket.emit('error', { message: 'Player not registered' });
      return;
    }

    if (player.playerIndex !== state.currentPlayer) {
      socket.emit('error', { message: 'Not your turn' });
      return;
    }

    if (!state.hasPlaced) {
      socket.emit('error', { message: 'Must place a number first' });
      return;
    }

    const width = maxCol - minCol + 1;
    const height = maxRow - minRow + 1;

    // Validate square shape
    if (width !== height || width < 2) {
      socket.emit('error', { message: 'Invalid square area' });
      return;
    }

    // Calculate sum and ownership
    let sum = 0;
    const playerCounts = [0, 0, 0];
    let totalCells = 0;

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const cell = state.grid[r][c];
        if (cell !== null) {
          sum += cell.value;
          playerCounts[cell.player]++;
          totalCells++;
        }
      }
    }

    // Validate sum is perfect square
    const sqrt = Math.sqrt(sum);
    if (sqrt !== Math.floor(sqrt)) {
      socket.emit('error', { message: `Sum ${sum} is not a perfect square` });
      return;
    }

    if (totalCells === 0) {
      socket.emit('error', { message: 'No numbers in selected area' });
      return;
    }

    // Find winners
    const maxCount = Math.max(...playerCounts);
    const winners = [];
    for (let i = 0; i < 3; i++) {
      if (playerCounts[i] === maxCount && playerCounts[i] > 0) {
        winners.push(i);
      }
    }

    // Update scores
    const scorePerWinner = sum / winners.length;
    winners.forEach(p => {
      state.scores[p] += scorePerWinner;
    });

    // Add circled area
    state.circledAreas.push({
      minRow, maxRow, minCol, maxCol, sum, winners, playerCounts
    });

    // Next turn
    state.turns[state.currentPlayer]++;
    state.currentPlayer = (state.currentPlayer + 1) % 3;
    state.gameOver = state.turns.every(t => t >= MAX_TURNS);
    state.hasPlaced = false;

    await saveGameState(currentRoomId, state);
    io.to(currentRoomId).emit('gameStateUpdate', state);
    io.to(currentRoomId).emit('areaCircled', {
      minRow, maxRow, minCol, maxCol, sum, winners, playerCounts,
      playerName: player.name
    });

    if (state.gameOver) {
      const maxScore = Math.max(...state.scores);
      // Find all players with the max score (handle ties)
      const gameWinners = state.scores
        .map((score, idx) => score === maxScore ? idx : -1)
        .filter(idx => idx !== -1);
      // If there's a tie, pick the first one (or you could return all winners)
      const winnerIndex = gameWinners[0];
      io.to(currentRoomId).emit('gameOver', {
        winner: winnerIndex,
        winners: gameWinners, // Send all winners in case of tie
        scores: state.scores
      });
    }
  });

  // Skip turn
  socket.on('skipTurn', async () => {
    if (!currentRoomId) {
      socket.emit('error', { message: 'Not in a room' });
      return;
    }
    
    const state = await getGameState(currentRoomId);
    const player = state.players[socket.id];

    if (!player) {
      socket.emit('error', { message: 'Player not registered' });
      return;
    }

    if (player.playerIndex !== state.currentPlayer) {
      socket.emit('error', { message: 'Not your turn' });
      return;
    }

    if (!state.hasPlaced) {
      socket.emit('error', { message: 'Must place a number first' });
      return;
    }

    state.turns[state.currentPlayer]++;
    state.currentPlayer = (state.currentPlayer + 1) % 3;
    state.gameOver = state.turns.every(t => t >= MAX_TURNS);
    state.hasPlaced = false;

    await saveGameState(currentRoomId, state);
    io.to(currentRoomId).emit('gameStateUpdate', state);
    io.to(currentRoomId).emit('turnSkipped', {
      player: player.playerIndex,
      playerName: player.name
    });

    if (state.gameOver) {
      const maxScore = Math.max(...state.scores);
      // Find all players with the max score (handle ties)
      const gameWinners = state.scores
        .map((score, idx) => score === maxScore ? idx : -1)
        .filter(idx => idx !== -1);
      // If there's a tie, pick the first one (or you could return all winners)
      const winnerIndex = gameWinners[0];
      io.to(currentRoomId).emit('gameOver', {
        winner: winnerIndex,
        winners: gameWinners, // Send all winners in case of tie
        scores: state.scores
      });
    }
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    console.log('Client disconnected:', socket.id);
    
    if (currentRoomId) {
      const state = await getGameState(currentRoomId);
      
      if (state && state.players[socket.id]) {
        const player = state.players[socket.id];
        delete state.players[socket.id];
        await saveGameState(currentRoomId, state);
        
        io.to(currentRoomId).emit('playerLeft', {
          playerIndex: player.playerIndex,
          name: player.name,
          totalPlayers: Object.keys(state.players).length
        });
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});