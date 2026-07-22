const express = require('express');
const router = express.Router();
const PushToken = require('../models/PushToken'); // Assuming a model is created

// Register push token
router.post('/register-token', async (req, res) => {
  try {
    const { userId, token } = req.body;
    const existingToken = await PushToken.findOne({ where: { userId } });
    
    if (existingToken) {
      // Update existing token
      existingToken.token = token;
      existingToken.expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      await existingToken.save();
    } else {
      // Create new token
      const newToken = await PushToken.create({
        userId,
        token,
        expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });
    }
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Token registration failed' });
  }
});

// Get all active tokens (for testing)
router.get('/tokens', async (req, res) => {
  const tokens = await PushToken.findAll({ where: { expiry: { [Op.gt]: new Date() } } });
  res.json(tokens);
});

module.exports = router;