import { Request, Response } from 'express';
import { supabaseClient } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

export class MetadataController {
  /**
   * Get metadata by type
   */
  static async getMetadataByType(req: Request, res: Response): Promise<void> {
    try {
      const { type } = req.params;
      
      const validTypes = ['expense_category', 'activity_type', 'sport_type', 'payment_method'];
      if (!validTypes.includes(type)) {
        res.status(400).json({ error: 'Invalid metadata type' });
        return;
      }

      const { data: metadata, error } = await supabaseClient
        .from('metadata')
        .select('*')
        .eq('type', type)
        .eq('is_active', true)
        .order('sort_order')
        .order('label');

      if (error) {
        console.error('Error fetching metadata:', error);
        res.status(500).json({ error: 'Failed to fetch metadata' });
        return;
      }

      res.json({
        success: true,
        metadata: metadata || []
      });

    } catch (error) {
      console.error('Error in getMetadataByType:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get all metadata types
   */
  static async getAllMetadata(req: Request, res: Response): Promise<void> {
    try {
      const { data: metadata, error } = await supabaseClient
        .from('metadata')
        .select('*')
        .eq('is_active', true)
        .order('type')
        .order('sort_order')
        .order('label');

      if (error) {
        console.error('Error fetching all metadata:', error);
        res.status(500).json({ error: 'Failed to fetch metadata' });
        return;
      }

      // Group by type
      const groupedMetadata = (metadata || []).reduce((acc, item) => {
        if (!acc[item.type]) {
          acc[item.type] = [];
        }
        acc[item.type].push(item);
        return acc;
      }, {} as Record<string, any[]>);

      res.json({
        success: true,
        metadata: groupedMetadata
      });

    } catch (error) {
      console.error('Error in getAllMetadata:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Create new metadata entry (user suggestions)
   */
  static async createMetadata(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { type, key, label, icon, description } = req.body;

      if (!type || !key || !label) {
        res.status(400).json({ error: 'type, key, and label are required' });
        return;
      }

      const validTypes = ['expense_category', 'activity_type', 'sport_type', 'payment_method'];
      if (!validTypes.includes(type)) {
        res.status(400).json({ error: 'Invalid metadata type' });
        return;
      }

      // Check if key already exists for this type
      const { data: existing } = await supabaseClient
        .from('metadata')
        .select('id')
        .eq('type', type)
        .eq('key', key)
        .single();

      if (existing) {
        res.status(409).json({ error: 'Metadata entry with this key already exists' });
        return;
      }

      // Create new metadata entry (user suggestion, not system)
      const { data: metadata, error } = await supabaseClient
        .from('metadata')
        .insert({
          type,
          key,
          label,
          icon,
          description,
          is_active: false, // New user suggestions start as inactive
          is_system: false,
          created_by: req.user.id
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating metadata:', error);
        res.status(500).json({ error: 'Failed to create metadata' });
        return;
      }

      res.status(201).json({
        success: true,
        message: 'Metadata suggestion created successfully. It will be reviewed before activation.',
        metadata
      });

    } catch (error) {
      console.error('Error in createMetadata:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Search metadata with fuzzy matching
   */
  static async searchMetadata(req: Request, res: Response): Promise<void> {
    try {
      const { type, query } = req.query;

      if (!type || !query) {
        res.status(400).json({ error: 'type and query parameters are required' });
        return;
      }

      const validTypes = ['expense_category', 'activity_type', 'sport_type', 'payment_method'];
      if (!validTypes.includes(type as string)) {
        res.status(400).json({ error: 'Invalid metadata type' });
        return;
      }

      // Search in label and description with case-insensitive matching
      const { data: metadata, error } = await supabaseClient
        .from('metadata')
        .select('*')
        .eq('type', type)
        .eq('is_active', true)
        .or(`label.ilike.%${query}%,description.ilike.%${query}%,key.ilike.%${query}%`)
        .order('sort_order')
        .order('label')
        .limit(10);

      if (error) {
        console.error('Error searching metadata:', error);
        res.status(500).json({ error: 'Failed to search metadata' });
        return;
      }

      res.json({
        success: true,
        metadata: metadata || []
      });

    } catch (error) {
      console.error('Error in searchMetadata:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
} 