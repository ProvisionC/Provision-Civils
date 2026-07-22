import express from 'express';
import { Router } from 'express';
import { Expo } from 'expo-server-sdk';
import { Op } from 'sequelize';
import PushToken from '../models/PushToken';

// Initialize Expo client
const expo = new Expo();

// Update existing notification route
const router = express.Router();

router.post('/notifications', async (req: express.Request, res: express.Response) => {
  try {
    const { title, body, data, recipients } = req.body;
    
    // Fetch valid Expo tokens based on recipients
    let expoTokens;
    if (recipients === 'specific') {
      const userId = data.userId;
      expoTokens = await PushToken.findAll({ where: { userId } });
    } else if (recipients === 'supervisors') {
      // Implement supervisor token logic if needed
      expoTokens = []; // Placeholder
    } else if (recipients === 'all') {
      expoTokens = await PushToken.findAll({ where: { expiry: { [Op.gt]: new Date() } } });
    }

    if (expoTokens.length === 0) {
      return res.status(400).json({ error: 'No valid tokens found' });
    }

    // Prepare Expo message
    const message = {
      to: expoTokens.map(token => token.token),
      sound: 'default',
      title,
      body,
      data
    };

    // Send via Expo
    const response = await expo.sendPushNotificationsAsync(message);
    
    // Handle invalid tokens
    const invalidTokens = response.invalidTokens || [];
    if (invalidTokens.length > 0) {
      // Remove invalid tokens from database
      await PushToken.destroy({ where: { token: { [Op.in]: invalidTokens } } });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Expo notification error:', error);
    res.status(500).json({ error: 'Notification failed' });
  }
});

module.exports = router;