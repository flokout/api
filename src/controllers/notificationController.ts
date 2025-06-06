import { Response } from 'express';
import { supabaseClient } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * Notification Controller - Works with Supabase notifications table
 * 
 * ⚠️  IMPORTANT: Uses the notifications table you just created in Supabase
 * All operations respect Row Level Security (RLS) policies
 */

interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'flokout_created' | 'flokout_confirmed' | 'flokout_cancelled' | 'expense_reminder' | 'general';
  read: boolean;
  data: any;
  created_at: string;
  updated_at: string;
}

export class NotificationController {
  /**
   * Get all notifications for authenticated user
   * GET /api/notifications
   */
  static async getUserNotifications(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { data: notifications, error } = await supabaseClient
        .from('notifications')
        .select('*')
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
        return;
      }

      res.json({ notifications: notifications || [] });

    } catch (error: any) {
      console.error('Get notifications error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get count of unread notifications for authenticated user
   * GET /api/notifications/unread-count
   */
  static async getUnreadCount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { count, error } = await supabaseClient
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', req.user.id)
        .eq('read', false);

      if (error) {
        console.error('Failed to get unread count:', error);
        res.status(500).json({ error: 'Failed to get unread count' });
        return;
      }

      res.json({ count: count || 0 });

    } catch (error: any) {
      console.error('Get unread count error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Mark specific notification as read
   * PUT /api/notifications/:id/read
   */
  static async markAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;

      if (!id) {
        res.status(400).json({ error: 'Notification ID is required' });
        return;
      }

      // First check if notification exists and belongs to user
      const { data: existing, error: fetchError } = await supabaseClient
        .from('notifications')
        .select('id, user_id')
        .eq('id', id)
        .eq('user_id', req.user.id)
        .single();

      if (fetchError || !existing) {
        res.status(404).json({ error: 'Notification not found' });
        return;
      }

      // Update notification as read
      const { error } = await supabaseClient
        .from('notifications')
        .update({ 
          read: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', req.user.id);

      if (error) {
        console.error('Failed to mark notification as read:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
        return;
      }

      res.json({ success: true, message: 'Notification marked as read' });

    } catch (error: any) {
      console.error('Mark as read error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Mark all notifications as read for authenticated user
   * PUT /api/notifications/mark-all-read
   */
  static async markAllAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { error } = await supabaseClient
        .from('notifications')
        .update({ 
          read: true,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', req.user.id)
        .eq('read', false);

      if (error) {
        console.error('Failed to mark all notifications as read:', error);
        res.status(500).json({ error: 'Failed to mark all notifications as read' });
        return;
      }

      res.json({ success: true, message: 'All notifications marked as read' });

    } catch (error: any) {
      console.error('Mark all as read error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Delete specific notification (optional feature)
   * DELETE /api/notifications/:id
   */
  static async deleteNotification(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;

      if (!id) {
        res.status(400).json({ error: 'Notification ID is required' });
        return;
      }

      // First check if notification exists and belongs to user
      const { data: existing, error: fetchError } = await supabaseClient
        .from('notifications')
        .select('id, user_id')
        .eq('id', id)
        .eq('user_id', req.user.id)
        .single();

      if (fetchError || !existing) {
        res.status(404).json({ error: 'Notification not found' });
        return;
      }

      // Delete notification
      const { error } = await supabaseClient
        .from('notifications')
        .delete()
        .eq('id', id)
        .eq('user_id', req.user.id);

      if (error) {
        console.error('Failed to delete notification:', error);
        res.status(500).json({ error: 'Failed to delete notification' });
        return;
      }

      res.json({ success: true, message: 'Notification deleted successfully' });

    } catch (error: any) {
      console.error('Delete notification error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Create notification (for testing purposes - usually created by triggers)
   * POST /api/notifications/create
   */
  static async createNotification(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { title, message, type = 'general', data = {} } = req.body;

      if (!title || !message) {
        res.status(400).json({ error: 'Title and message are required' });
        return;
      }

      const validTypes = ['flokout_created', 'flokout_confirmed', 'flokout_cancelled', 'expense_reminder', 'general'];
      if (!validTypes.includes(type)) {
        res.status(400).json({ error: 'Invalid notification type' });
        return;
      }

      const { data: notification, error } = await supabaseClient
        .from('notifications')
        .insert({
          user_id: req.user.id,
          title,
          message,
          type,
          data,
          read: false
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to create notification:', error);
        res.status(500).json({ error: 'Failed to create notification' });
        return;
      }

      res.status(201).json({ 
        success: true, 
        message: 'Notification created successfully',
        notification 
      });

    } catch (error: any) {
      console.error('Create notification error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Register push notification token
   * POST /api/notifications/register-token
   */
  static async registerPushToken(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { push_token, platform } = req.body;

      if (!push_token) {
        res.status(400).json({ error: 'Push token is required' });
        return;
      }

      if (!platform || !['ios', 'android'].includes(platform)) {
        res.status(400).json({ error: 'Valid platform (ios/android) is required' });
        return;
      }

      // Store or update push token in users table
      const { error: updateError } = await supabaseClient
        .from('users')
        .update({
          push_token,
          platform,
          updated_at: new Date().toISOString()
        })
        .eq('id', req.user.id);

      if (updateError) {
        console.error('Failed to update push token:', updateError);
        res.status(500).json({ error: 'Failed to register push token' });
        return;
      }

      console.log(`✅ Push token registered for user ${req.user.id} on ${platform}`);
      
      res.json({ 
        success: true, 
        message: 'Push token registered successfully' 
      });

    } catch (error: any) {
      console.error('Register push token error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
} 