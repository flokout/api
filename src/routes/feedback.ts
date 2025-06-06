import { Router } from 'express';
import { FeedbackController } from '../controllers/feedbackController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All feedback routes require authentication
router.use(authenticate);

/**
 * @route POST /api/feedback
 * @desc Submit new feedback
 * @access Private
 */
router.post('/', FeedbackController.submitFeedback);

/**
 * @route GET /api/feedback
 * @desc Get user's feedback history
 * @access Private
 */
router.get('/', FeedbackController.getUserFeedback);

/**
 * @route GET /api/feedback/:id
 * @desc Get feedback by ID (user's own feedback only)
 * @access Private
 */
router.get('/:id', FeedbackController.getFeedbackById);

/**
 * @route PUT /api/feedback/:id
 * @desc Update feedback (user's own feedback only)
 * @access Private
 */
router.put('/:id', FeedbackController.updateFeedback);

/**
 * @route DELETE /api/feedback/:id
 * @desc Delete feedback (user's own feedback only)
 * @access Private
 */
router.delete('/:id', FeedbackController.deleteFeedback);

/**
 * @route GET /api/feedback/admin/all
 * @desc Get all feedback (admin only)
 * @access Private (Admin)
 */
router.get('/admin/all', FeedbackController.getAllFeedback);

export default router; 