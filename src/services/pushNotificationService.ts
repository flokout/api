import { Expo, ExpoPushMessage, ExpoPushReceipt, ExpoPushToken } from 'expo-server-sdk';
import { supabaseClient } from '../config/database';

/**
 * Push Notification Service
 * Handles sending push notifications via Expo Push API
 */

export class PushNotificationService {
  private static expo = new Expo({
    accessToken: process.env.EXPO_ACCESS_TOKEN, // Optional, for more requests per hour
    useFcmV1: true, // Use FCM v1 API
  });

  /**
   * Send push notification to specific user
   */
  static async sendToUser(
    userId: string, 
    title: string, 
    body: string, 
    data?: any
  ): Promise<boolean> {
    try {
      console.log(`🔔 Looking for push token for user: ${userId}`);
      
      // Get user's push token from database
      const { data: user, error } = await supabaseClient
        .from('profiles')
        .select('push_token, platform')
        .eq('id', userId)
        .single();

      if (error) {
        console.error(`🔔 Database error getting push token for user ${userId}:`, error);
        return false;
      }

      if (!user?.push_token) {
        console.log(`🔔 No push token found for user ${userId}`);
        return false;
      }

      console.log(`🔔 Found push token for user ${userId}, platform: ${user.platform}`);
      return await this.sendNotification(user.push_token, title, body, data);
    } catch (error) {
      console.error('🔔 Error sending push notification to user:', error);
      return false;
    }
  }

  /**
   * Send push notification to multiple users
   */
  static async sendToUsers(
    userIds: string[], 
    title: string, 
    body: string, 
    data?: any
  ): Promise<number> {
    try {
      // Get push tokens for all users
      const { data: users, error } = await supabaseClient
        .from('profiles')
        .select('push_token, platform')
        .in('id', userIds)
        .not('push_token', 'is', null);

      if (error || !users) {
        console.error('Error fetching user push tokens:', error);
        return 0;
      }

      const messages: ExpoPushMessage[] = users
        .filter(user => Expo.isExpoPushToken(user.push_token))
        .map(user => ({
          to: user.push_token,
          title,
          body,
          data: data || {},
          sound: 'default',
          badge: 1,
        }));

      if (messages.length === 0) {
        console.log('No valid push tokens found');
        return 0;
      }

      const chunks = this.expo.chunkPushNotifications(messages);
      let successCount = 0;

      for (const chunk of chunks) {
        try {
          const receipts = await this.expo.sendPushNotificationsAsync(chunk);
          
          // Count successful sends
          receipts.forEach(receipt => {
            if (receipt.status === 'ok') {
              successCount++;
            } else {
              console.error('Push notification error:', receipt);
            }
          });
        } catch (error) {
          console.error('Error sending push notification chunk:', error);
        }
      }

      console.log(`✅ Sent ${successCount}/${messages.length} push notifications`);
      return successCount;
    } catch (error) {
      console.error('Error sending push notifications to users:', error);
      return 0;
    }
  }

  /**
   * Send push notification to specific token
   */
  private static async sendNotification(
    pushToken: string, 
    title: string, 
    body: string, 
    data?: any
  ): Promise<boolean> {
    try {
      if (!Expo.isExpoPushToken(pushToken)) {
        console.error('Invalid push token:', pushToken);
        return false;
      }

      const message: ExpoPushMessage = {
        to: pushToken,
        title,
        body,
        data: data || {},
        sound: 'default',
        badge: 1,
      };

      const receipt = await this.expo.sendPushNotificationsAsync([message]);
      
      if (receipt[0].status === 'ok') {
        console.log('✅ Push notification sent successfully');
        return true;
      } else {
        console.error('Push notification failed:', receipt[0]);
        return false;
      }
    } catch (error) {
      console.error('Error sending push notification:', error);
      return false;
    }
  }

  /**
   * Send notification when new flokout is created
   */
  static async notifyFlokoutCreated(flokoutId: string, flokMembers: string[]) {
    await this.sendToUsers(
      flokMembers,
      'New Flokout! 🎾',
      'A new flokout has been created for your group',
      { flokout_id: flokoutId, type: 'flokout_created' }
    );
  }

  /**
   * Send notification when flokout is confirmed
   */
  static async notifyFlokoutConfirmed(flokoutId: string, flokMembers: string[]) {
    await this.sendToUsers(
      flokMembers,
      'Flokout Confirmed! ✅',
      'Your flokout is confirmed and ready to go!',
      { flokout_id: flokoutId, type: 'flokout_confirmed' }
    );
  }

  /**
   * Send notification when flokout is cancelled
   */
  static async notifyFlokoutCancelled(flokoutId: string, flokMembers: string[]) {
    await this.sendToUsers(
      flokMembers,
      'Flokout Cancelled ❌',
      'Unfortunately, your flokout has been cancelled',
      { flokout_id: flokoutId, type: 'flokout_cancelled' }
    );
  }

  /**
   * Send expense reminder notification
   */
  static async notifyExpenseReminder(userId: string, amount: number) {
    await this.sendToUser(
      userId,
      'Expense Reminder 💰',
      `You have pending expenses totaling $${amount.toFixed(2)}`,
      { type: 'expense_reminder', route: '/(tabs)/expenses' }
    );
  }
} 