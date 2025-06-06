import { Router } from 'express';
import { NotificationController } from '../controllers/notificationController';
import { authenticate } from '../middleware/auth';

/**
 * Notification Routes - Works with Supabase notifications table
 * 
 * ⚠️  IMPORTANT: These routes use the notifications table you just created
 * Requires authentication for all endpoints
 */

const router = Router();

// All notification routes require authentication
router.use(authenticate);

// GET /api/notifications - Get all notifications for authenticated user
router.get('/', NotificationController.getUserNotifications);

// GET /api/notifications/unread-count - Get count of unread notifications
router.get('/unread-count', NotificationController.getUnreadCount);

// PUT /api/notifications/:id/read - Mark specific notification as read
router.put('/:id/read', NotificationController.markAsRead);

// PUT /api/notifications/mark-all-read - Mark all notifications as read for user
router.put('/mark-all-read', NotificationController.markAllAsRead);

// POST /api/notifications/create - Create notification (for testing)
router.post('/create', NotificationController.createNotification);

// POST /api/notifications/register-token - Register push token
router.post('/register-token', NotificationController.registerPushToken);

// DELETE /api/notifications/:id - Delete specific notification (optional)
router.delete('/:id', NotificationController.deleteNotification);

export default router; 