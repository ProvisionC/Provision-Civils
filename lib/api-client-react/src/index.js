import { Notifications } from 'expo-notifications';

// ... (existing code)

// After successful login, request notification permission
export const requestNotificationPermission = async () => {
  try {
    const granted = await Notifications.requestPermission();
    if (!granted) {
      throw new Error('Notification permission denied');
    }
    return true;
  } catch (error) {
    console.error('Failed to request notification permission:', error);
    return false;
  }
};

// Get and send Expo Push Token to backend
export const registerPushToken = async () => {
  try {
    const token = await Notifications.getExpoPushTokenAsync();
    // Send token to /push-tokens endpoint using existing API client
    const response = await apiClient.post('/push-tokens', { token });
    if (!response.ok) {
      throw new Error('Failed to register push token');
    }
    return true;
  } catch (error) {
    console.error('Push token registration failed:', error);
    return false;
  }
};

// Set up notification handlers
export const setupNotificationHandlers = () => {
  Notifications.setNotificationHandler({
    handleNotification: (notification) => {
      console.log('Notification received:', notification);
      // Handle notification logic here
    },
    handleForeground: (notification) => {
      console.log('Foreground notification:', notification);
    },
    handleTap: () => {
      console.log('Notification tapped');
    }
  });
};