require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { AccessToken } = require('livekit-server-sdk');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/api/token', async (req, res) => {
  const { roomName, participantName } = req.query;
  
  if (!roomName || !participantName) {
    return res.status(400).json({ error: 'roomName y participantName son requeridos' });
  }

  try {
    const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
      identity: participantName,
      name: participantName,
    });
    
    at.addGrant({ 
      roomJoin: true, 
      room: roomName,
      canPublish: true,
      canSubscribe: true
    });
    
    // Set TTL (e.g. 1 hour)
    at.ttl = '1h';
    const token = await at.toJwt();
    
    res.json({ token });
  } catch (error) {
    console.error("Error creating token:", error);
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
