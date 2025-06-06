import { Response } from 'express';
import { supabaseAdmin, supabaseClient } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * Feedback Controller - Handle user feedback submissions
 */

export class FeedbackController {
  /**
   * Submit new feedback
   */
  static async submitFeedback(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { type, description, screen_name, emoji_rating } = req.body;

      if (!type || !description) {
        res.status(400).json({ error: 'Type and description are required' });
        return;
      }

      const validTypes = ['bug', 'feature', 'general'];
      if (!validTypes.includes(type)) {
        res.status(400).json({ error: 'Valid type is required (bug, feature, general)' });
        return;
      }

      // For bug reports, screen_name is required
      if (type === 'bug' && !screen_name) {
        res.status(400).json({ error: 'Screen name is required for bug reports' });
        return;
      }

      const { data: feedback, error: feedbackError } = await supabaseClient
        .from('feedback')
        .insert({
          user_id: req.user.id,
          type,
          description: description.trim(),
          screen_name: screen_name ? screen_name.trim() : null,
          emoji_rating: emoji_rating || null,
          status: 'open'
        })
        .select()
        .single();

      if (feedbackError) {
        console.error('Error submitting feedback:', feedbackError);
        res.status(400).json({ error: feedbackError.message });
        return;
      }

      res.status(201).json({
        message: 'Feedback submitted successfully',
        feedback
      });
    } catch (error: any) {
      console.error('Submit feedback error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get user's feedback history
   */
  static async getUserFeedback(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { limit = 50, offset = 0, type } = req.query;

      let query = supabaseClient
        .from('feedback')
        .select('*')
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (type) {
        query = query.eq('type', type as string);
      }

      const { data: feedback, error: feedbackError } = await query;

      if (feedbackError) {
        console.error('Error fetching user feedback:', feedbackError);
        res.status(500).json({ error: 'Failed to fetch feedback' });
        return;
      }

      res.json({ feedback });
    } catch (error: any) {
      console.error('Get user feedback error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get feedback by ID (for user to view their own feedback)
   */
  static async getFeedbackById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;

      const { data: feedback, error: feedbackError } = await supabaseClient
        .from('feedback')
        .select('*')
        .eq('id', id)
        .eq('user_id', req.user.id) // Users can only view their own feedback
        .single();

      if (feedbackError) {
        res.status(404).json({ error: 'Feedback not found' });
        return;
      }

      res.json({ feedback });
    } catch (error: any) {
      console.error('Get feedback error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Update feedback (user can update their own feedback if needed)
   */
  static async updateFeedback(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      const { description, screen_name, emoji_rating } = req.body;

      // Check if feedback exists and belongs to user
      const { data: existingFeedback, error: getError } = await supabaseClient
        .from('feedback')
        .select('id, type')
        .eq('id', id)
        .eq('user_id', req.user.id)
        .single();

      if (getError) {
        res.status(404).json({ error: 'Feedback not found' });
        return;
      }

      const updateData: any = {};
      if (description !== undefined) updateData.description = description.trim();
      if (screen_name !== undefined) updateData.screen_name = screen_name ? screen_name.trim() : null;
      if (emoji_rating !== undefined) updateData.emoji_rating = emoji_rating;

      const { data: feedback, error: updateError } = await supabaseClient
        .from('feedback')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', req.user.id)
        .select()
        .single();

      if (updateError) {
        res.status(400).json({ error: updateError.message });
        return;
      }

      res.json({
        message: 'Feedback updated successfully',
        feedback
      });
    } catch (error: any) {
      console.error('Update feedback error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Delete feedback (user can delete their own feedback)
   */
  static async deleteFeedback(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;

      const { error: deleteError } = await supabaseClient
        .from('feedback')
        .delete()
        .eq('id', id)
        .eq('user_id', req.user.id);

      if (deleteError) {
        res.status(400).json({ error: deleteError.message });
        return;
      }

      res.json({ message: 'Feedback deleted successfully' });
    } catch (error: any) {
      console.error('Delete feedback error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Admin: Get all feedback (for admin dashboard)
   * Note: This would require admin role checking in a real app
   */
  static async getAllFeedback(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      // TODO: Add admin role checking here
      // For now, this endpoint is available but would need proper admin authentication

      const { limit = 50, offset = 0, type, status } = req.query;

      let query = supabaseAdmin
        .from('feedback')
        .select(`
          *,
          profiles!feedback_user_id_fkey(
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (type) {
        query = query.eq('type', type as string);
      }

      if (status) {
        query = query.eq('status', status as string);
      }

      const { data: feedback, error: feedbackError } = await query;

      if (feedbackError) {
        console.error('Error fetching all feedback:', feedbackError);
        res.status(500).json({ error: 'Failed to fetch feedback' });
        return;
      }

      res.json({ feedback });
    } catch (error: any) {
      console.error('Get all feedback error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
} 