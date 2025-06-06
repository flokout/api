import { Response } from 'express';
import { supabaseAdmin, supabaseClient } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * Flokouts Controller - Events Management
 */

export class FlokoutsController {
  /**
   * Get flokouts with optional filters
   */
  static async getFlokouts(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { flok_id, status, limit = 50, offset = 0 } = req.query;

      // Get user's floks to filter flokouts
      const { data: userFloks } = await supabaseClient
        .from('flokmates')
        .select('flok_id')
        .eq('user_id', req.user.id);

      const userFlokIds = userFloks?.map(f => f.flok_id) || [];
      console.log(`[DEBUG] User ${req.user.id} belongs to ${userFlokIds.length} floks:`, userFlokIds);

      if (userFlokIds.length === 0) {
        res.json({ flokouts: [] });
        return;
      }

      let query = supabaseClient
        .from('flokouts')
        .select(`
          *,
          floks!inner(
            id,
            name
          ),
          spots(
            id,
            name,
            address
          )
        `)
        .in('flok_id', userFlokIds)
        .order('date', { ascending: true });
        
      // Only apply range if limit is reasonable (< 1000)
      if (Number(limit) < 1000) {
        query = query.range(Number(offset), Number(offset) + Number(limit) - 1);
      }

      if (flok_id) {
        query = query.eq('flok_id', flok_id as string);
      }

      if (status) {
        query = query.eq('status', status as string);
      }

      const { data: flokouts, error: flokoutsError } = await query;

      if (flokoutsError) {
        console.error('[DEBUG] Error fetching flokouts:', flokoutsError);
        res.status(500).json({ error: 'Failed to fetch flokouts' });
        return;
      }

      console.log(`[DEBUG] Found ${flokouts?.length || 0} flokouts for user ${req.user.id}`);
      if (flokouts && flokouts.length > 0) {
        const statusCounts = flokouts.reduce((acc: any, f: any) => {
          acc[f.status] = (acc[f.status] || 0) + 1;
          return acc;
        }, {});
        console.log('[DEBUG] Flokouts by status:', statusCounts);
      }

      // For each flokout, get RSVP data and flok members (for poll status)
      const flokoutsWithRSVPData = await Promise.all(
        (flokouts || []).map(async (flokout) => {
          console.log(`[DEBUG] Processing flokout ${flokout.id}: ${flokout.title}`);
          
          // Get RSVP data
          const { data: attendances, error: attendanceError } = await supabaseClient
            .from('attendances')
            .select(`
              id,
              user_id,
              rsvp_status,
              attended,
              profiles!attendances_user_id_fkey(
                id,
                full_name,
                avatar_url
              )
            `)
            .eq('flokout_id', flokout.id);

          if (attendanceError) {
            console.error(`[DEBUG] Error fetching attendances for flokout ${flokout.id}:`, attendanceError);
          } else {
            console.log(`[DEBUG] Found ${attendances?.length || 0} attendances for flokout ${flokout.id}:`, attendances);
          }

          // Get flok members for poll status flokouts
          let flokMembers: any[] = [];
          if (flokout.status === 'poll') {
            const { data: members } = await supabaseClient
              .from('flokmates')
              .select(`
                id,
                user_id,
                role,
                profiles!inner(
                  id,
                  full_name,
                  avatar_url
                )
              `)
              .eq('flok_id', flokout.flok_id);
            flokMembers = members || [];
            console.log(`[DEBUG] Found ${flokMembers.length} flok members for flokout ${flokout.id}`);
          }

          const result = {
            ...flokout,
            attendees: attendances || [],
            flok_members: flokMembers,
            rsvp_count: attendances?.filter(a => a.rsvp_status === 'yes').length || 0,
            attendance_count: attendances?.filter(a => a.attended === true).length || 0
          };
          
          console.log(`[DEBUG] Final flokout data for ${flokout.id}:`, {
            id: result.id,
            title: result.title,
            attendees_count: result.attendees.length,
            rsvp_count: result.rsvp_count
          });

          return result;
        })
      );

      res.json({ flokouts: flokoutsWithRSVPData });
    } catch (error: any) {
      console.error('Get flokouts error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Create new flokout
   */
  static async createFlokout(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { 
        title, 
        description, 
        date, 
        flok_id, 
        spot_id, 
        min_people_required = 2,
        status = 'poll' 
      } = req.body;

      if (!title || !date || !flok_id) {
        res.status(400).json({ error: 'Title, date, and flok_id are required' });
        return;
      }

      // Check if user is a member of this flok
      const { data: membership } = await supabaseClient
        .from('flokmates')
        .select('role')
        .eq('flok_id', flok_id)
        .eq('user_id', req.user.id)
        .single();

      if (!membership) {
        res.status(403).json({ error: 'Access denied. You are not a member of this flok.' });
        return;
      }

      // If spot_id is provided, verify it exists and user has access
      if (spot_id) {
        const { data: spot, error: spotError } = await supabaseClient
          .from('spots')
          .select('id, flok_id')
          .eq('id', spot_id)
          .single();

        if (spotError) {
          res.status(400).json({ error: 'Invalid spot ID' });
          return;
        }

        // If spot belongs to a flok, make sure it's the same flok
        if (spot.flok_id && spot.flok_id !== flok_id) {
          res.status(400).json({ error: 'Spot does not belong to this flok' });
          return;
        }
      }

      const { data: flokout, error: flokoutError } = await supabaseClient
        .from('flokouts')
        .insert({
          title,
          description,
          date,
          flok_id,
          spot_id,
          min_people_required: Number(min_people_required),
          status,
          created_by: req.user.id,
          last_updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (flokoutError) {
        res.status(400).json({ error: flokoutError.message });
        return;
      }

      // Automatically create attendance records for all flok members
      const { data: flokMembers, error: membersError } = await supabaseClient
        .from('flokmates')
        .select('user_id')
        .eq('flok_id', flok_id);

      if (membersError) {
        console.error('Failed to fetch flok members for attendance creation:', membersError);
      } else if (flokMembers && flokMembers.length > 0) {
        // Create attendance records for all flok members with null RSVP status
        const attendanceRecords = flokMembers.map(member => ({
          flokout_id: flokout.id,
          user_id: member.user_id,
          rsvp_status: null,
          attended: false
        }));

        const { error: attendanceError } = await supabaseClient
          .from('attendances')
          .insert(attendanceRecords);

        if (attendanceError) {
          console.error('Failed to create attendance records:', attendanceError);
          // Don't fail the flokout creation if attendance records fail
        } else {
          console.log(`Created ${attendanceRecords.length} attendance records for flokout ${flokout.id}`);
        }
      }

      res.status(201).json({
        message: 'Flokout created successfully',
        flokout
      });
    } catch (error: any) {
      console.error('Create flokout error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get flokout by ID
   */
  static async getFlokoutById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;

      const { data: flokout, error: flokoutError } = await supabaseClient
        .from('flokouts')
        .select(`
          *,
          floks!inner(
            id,
            name
          ),
          spots(
            id,
            name,
            address,
            cost_per_hour,
            contact_number
          )
        `)
        .eq('id', id)
        .single();

      if (flokoutError) {
        res.status(404).json({ error: 'Flokout not found' });
        return;
      }

      // Check if user is a member of this flok
      const { data: membership } = await supabaseClient
        .from('flokmates')
        .select('role')
        .eq('flok_id', flokout.flok_id)
        .eq('user_id', req.user.id)
        .single();

      if (!membership) {
        res.status(403).json({ error: 'Access denied. You are not a member of this flok.' });
        return;
      }

      // Get attendances/RSVPs for this flokout
      const { data: attendances, error: attendanceError } = await supabaseClient
        .from('attendances')
        .select(`
          id,
          user_id,
          rsvp_status,
          attended,
          created_at,
          user:profiles!attendances_user_id_fkey(
            id,
            email,
            full_name,
            avatar_url
          )
        `)
        .eq('flokout_id', id);

      if (attendanceError) {
        console.error('Failed to fetch attendances:', attendanceError);
      }

      // Get all flok members to show who hasn't RSVPed
      const { data: flokMembers, error: membersError } = await supabaseClient
        .from('flokmates')
        .select(`
          user_id,
          role,
          user:profiles!flokmates_user_id_fkey(
            id,
            email,
            full_name,
            avatar_url
          )
        `)
        .eq('flok_id', flokout.flok_id);

      if (membersError) {
        console.error('Failed to fetch flok members:', membersError);
      }

      // Create attendance data with all members
      const attendanceUserIds = attendances?.map(a => a.user_id) || [];
      const membersWithoutRSVP = flokMembers?.filter(m => !attendanceUserIds.includes(m.user_id)) || [];

      const flokoutWithAttendances = {
        ...flokout,
        attendees: attendances || [],
        flok_members: flokMembers || [],
        rsvp_count: attendances?.filter(a => a.rsvp_status === 'yes').length || 0,
        attendance_count: attendances?.filter(a => a.attended === true).length || 0,
        yes_count: attendances?.filter(a => a.rsvp_status === 'yes').length || 0,
        no_count: attendances?.filter(a => a.rsvp_status === 'no').length || 0,
        maybe_count: attendances?.filter(a => a.rsvp_status === 'maybe').length || 0,
        no_response_count: membersWithoutRSVP.length
      };

      res.json({ 
        flokout: flokoutWithAttendances,
        user_role: membership.role 
      });
    } catch (error: any) {
      console.error('Get flokout error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Update flokout
   */
  static async updateFlokout(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      const { title, description, date, spot_id, min_people_required } = req.body;

      // Get current flokout to check permissions
      const { data: currentFlokout, error: getError } = await supabaseClient
        .from('flokouts')
        .select('created_by, flok_id')
        .eq('id', id)
        .single();

      if (getError) {
        res.status(404).json({ error: 'Flokout not found' });
        return;
      }

      // Check if user can update this flokout (creator or flok admin)
      let canUpdate = currentFlokout.created_by === req.user.id;

      if (!canUpdate) {
        const { data: membership } = await supabaseClient
          .from('flokmates')
          .select('role')
          .eq('flok_id', currentFlokout.flok_id)
          .eq('user_id', req.user.id)
          .single();

        canUpdate = membership?.role === 'admin';
      }

      if (!canUpdate) {
        res.status(403).json({ error: 'Access denied. You can only update flokouts you created or if you are a flok admin.' });
        return;
      }

      const updateData: any = {
        last_updated_at: new Date().toISOString()
      };

      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (date !== undefined) updateData.date = date;
      if (spot_id !== undefined) updateData.spot_id = spot_id;
      if (min_people_required !== undefined) updateData.min_people_required = Number(min_people_required);

      const { data: flokout, error: updateError } = await supabaseClient
        .from('flokouts')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        res.status(400).json({ error: updateError.message });
        return;
      }

      res.json({
        message: 'Flokout updated successfully',
        flokout
      });
    } catch (error: any) {
      console.error('Update flokout error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Delete flokout
   */
  static async deleteFlokout(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;

      // Get current flokout to check permissions
      const { data: currentFlokout, error: getError } = await supabaseClient
        .from('flokouts')
        .select('created_by, flok_id')
        .eq('id', id)
        .single();

      if (getError) {
        res.status(404).json({ error: 'Flokout not found' });
        return;
      }

      // Check if user can delete this flokout (creator or flok admin)
      let canDelete = currentFlokout.created_by === req.user.id;

      if (!canDelete) {
        const { data: membership } = await supabaseClient
          .from('flokmates')
          .select('role')
          .eq('flok_id', currentFlokout.flok_id)
          .eq('user_id', req.user.id)
          .single();

        canDelete = membership?.role === 'admin';
      }

      if (!canDelete) {
        res.status(403).json({ error: 'Access denied. You can only delete flokouts you created or if you are a flok admin.' });
        return;
      }

      const { error: deleteError } = await supabaseClient
        .from('flokouts')
        .delete()
        .eq('id', id);

      if (deleteError) {
        res.status(400).json({ error: deleteError.message });
        return;
      }

      res.json({ message: 'Flokout deleted successfully' });
    } catch (error: any) {
      console.error('Delete flokout error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Update flokout status
   */
  static async updateFlokoutStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      const { status } = req.body;

      const validStatuses = ['poll', 'confirmed', 'completed', 'cancelled'];
      if (!status || !validStatuses.includes(status)) {
        res.status(400).json({ error: 'Valid status is required (poll, confirmed, completed, cancelled)' });
        return;
      }

      // Get current flokout to check permissions
      const { data: currentFlokout, error: getError } = await supabaseClient
        .from('flokouts')
        .select('created_by, flok_id, status')
        .eq('id', id)
        .single();

      if (getError) {
        res.status(404).json({ error: 'Flokout not found' });
        return;
      }

      // Check if user can update this flokout (creator or flok admin)
      let canUpdate = currentFlokout.created_by === req.user.id;

      if (!canUpdate) {
        const { data: membership } = await supabaseClient
          .from('flokmates')
          .select('role')
          .eq('flok_id', currentFlokout.flok_id)
          .eq('user_id', req.user.id)
          .single();

        canUpdate = membership?.role === 'admin';
      }

      if (!canUpdate) {
        res.status(403).json({ error: 'Access denied. You can only update flokouts you created or if you are a flok admin.' });
        return;
      }

      const { data: flokout, error: updateError } = await supabaseClient
        .from('flokouts')
        .update({
          status,
          last_updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        res.status(400).json({ error: updateError.message });
        return;
      }

      res.json({
        message: 'Flokout status updated successfully',
        flokout
      });
    } catch (error: any) {
      console.error('Update flokout status error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Confirm flokout (change status to confirmed)
   */
  static async confirmFlokout(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;

      // Get current flokout to check permissions and status
      const { data: currentFlokout, error: getError } = await supabaseClient
        .from('flokouts')
        .select('created_by, flok_id, status, min_people_required')
        .eq('id', id)
        .single();

      if (getError) {
        res.status(404).json({ error: 'Flokout not found' });
        return;
      }

      // Check if user can confirm this flokout (creator or flok admin)
      let canConfirm = currentFlokout.created_by === req.user.id;

      if (!canConfirm) {
        const { data: membership } = await supabaseClient
          .from('flokmates')
          .select('role')
          .eq('flok_id', currentFlokout.flok_id)
          .eq('user_id', req.user.id)
          .single();

        canConfirm = membership?.role === 'admin';
      }

      if (!canConfirm) {
        res.status(403).json({ error: 'Access denied. You can only confirm flokouts you created or if you are a flok admin.' });
        return;
      }

      if (currentFlokout.status !== 'poll') {
        res.status(400).json({ error: 'Only flokouts in poll status can be confirmed' });
        return;
      }

      // Check if minimum people requirement is met
      const { data: yesResponses } = await supabaseClient
        .from('attendances')
        .select('id')
        .eq('flokout_id', id)
        .eq('response', 'yes');

      const yesCount = yesResponses?.length || 0;

      if (yesCount < currentFlokout.min_people_required) {
        res.status(400).json({ 
          error: `Cannot confirm flokout. Minimum ${currentFlokout.min_people_required} people required, but only ${yesCount} confirmed.`
        });
        return;
      }

      const { data: flokout, error: updateError } = await supabaseClient
        .from('flokouts')
        .update({
          status: 'confirmed',
          last_updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        res.status(400).json({ error: updateError.message });
        return;
      }

      res.json({
        message: 'Flokout confirmed successfully',
        flokout
      });
    } catch (error: any) {
      console.error('Confirm flokout error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get flokouts for specific flok
   */
  static async getFlokoutsByFlok(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { flokId } = req.params;
      const { status, limit = 50, offset = 0 } = req.query;

      // Check if user is a member of this flok
      const { data: membership } = await supabaseClient
        .from('flokmates')
        .select('role')
        .eq('flok_id', flokId)
        .eq('user_id', req.user.id)
        .single();

      if (!membership) {
        res.status(403).json({ error: 'Access denied. You are not a member of this flok.' });
        return;
      }

      let query = supabaseClient
        .from('flokouts')
        .select(`
          *,
          spots(
            id,
            name,
            address
          )
        `)
        .eq('flok_id', flokId)
        .order('date', { ascending: true })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (status) {
        query = query.eq('status', status as string);
      }

      const { data: flokouts, error: flokoutsError } = await query;

      if (flokoutsError) {
        res.status(500).json({ error: 'Failed to fetch flok flokouts' });
        return;
      }

      res.json({ flokouts });
    } catch (error: any) {
      console.error('Get flok flokouts error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get user's created flokouts
   */
  static async getUserCreatedFlokouts(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { status, limit = 50, offset = 0 } = req.query;

      let query = supabaseClient
        .from('flokouts')
        .select(`
          *,
          floks!inner(
            id,
            name
          ),
          spots(
            id,
            name,
            address
          )
        `)
        .eq('created_by', req.user.id)
        .order('created_at', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (status) {
        query = query.eq('status', status as string);
      }

      const { data: flokouts, error: flokoutsError } = await query;

      if (flokoutsError) {
        res.status(500).json({ error: 'Failed to fetch user created flokouts' });
        return;
      }

      res.json({ flokouts });
    } catch (error: any) {
      console.error('Get user created flokouts error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get flokouts user is attending
   */
  static async getUserAttendingFlokouts(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { response, limit = 50, offset = 0 } = req.query;

      // Get flokouts where user has RSVPed
      const { data: attendances, error: attendanceError } = await supabaseClient
        .from('attendances')
        .select(`
          response,
          created_at,
          flokouts!inner(
            *,
            floks!inner(
              id,
              name
            ),
            spots(
              id,
              name,
              address
            )
          )
        `)
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (attendanceError) {
        res.status(500).json({ error: 'Failed to fetch user attending flokouts' });
        return;
      }

      let flokouts = attendances?.map(a => ({
        ...a.flokouts,
        user_response: a.response,
        user_response_date: a.created_at
      })) || [];

      // Filter by response if specified
      if (response) {
        flokouts = flokouts.filter(f => f.user_response === response);
      }

      res.json({ flokouts });
    } catch (error: any) {
      console.error('Get user attending flokouts error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Utility: Create missing attendance records for existing flokouts
   * This helps fix flokouts created before we implemented auto-attendance creation
   */
  static async createMissingAttendanceRecords(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      console.log('[UTIL] Starting to create missing attendance records...');

      // Get all flokouts
      const { data: allFlokouts, error: flokoutsError } = await supabaseClient
        .from('flokouts')
        .select('id, flok_id, title, status');

      if (flokoutsError) {
        res.status(500).json({ error: 'Failed to fetch flokouts' });
        return;
      }

      let totalCreated = 0;
      const results = [];

      for (const flokout of allFlokouts || []) {
        console.log(`[UTIL] Processing flokout ${flokout.id}: ${flokout.title}`);

        // Check if attendance records exist
        const { data: existingAttendances } = await supabaseClient
          .from('attendances')
          .select('id')
          .eq('flokout_id', flokout.id);

        if (existingAttendances && existingAttendances.length > 0) {
          console.log(`[UTIL] Flokout ${flokout.id} already has ${existingAttendances.length} attendance records`);
          results.push({ flokout_id: flokout.id, status: 'has_records', count: existingAttendances.length });
          continue;
        }

        // Get flok members
        const { data: flokMembers, error: membersError } = await supabaseClient
          .from('flokmates')
          .select('user_id')
          .eq('flok_id', flokout.flok_id);

        if (membersError || !flokMembers || flokMembers.length === 0) {
          console.log(`[UTIL] No members found for flok ${flokout.flok_id}`);
          results.push({ flokout_id: flokout.id, status: 'no_members', count: 0 });
          continue;
        }

        // Create attendance records
        const attendanceRecords = flokMembers.map(member => ({
          flokout_id: flokout.id,
          user_id: member.user_id,
          rsvp_status: null,
          attended: false
        }));

        const { error: attendanceError } = await supabaseClient
          .from('attendances')
          .insert(attendanceRecords);

        if (attendanceError) {
          console.error(`[UTIL] Failed to create attendance records for flokout ${flokout.id}:`, attendanceError);
          results.push({ flokout_id: flokout.id, status: 'error', error: attendanceError.message });
        } else {
          console.log(`[UTIL] Created ${attendanceRecords.length} attendance records for flokout ${flokout.id}`);
          totalCreated += attendanceRecords.length;
          results.push({ flokout_id: flokout.id, status: 'created', count: attendanceRecords.length });
        }
      }

      res.json({
        message: 'Missing attendance records creation completed',
        total_created: totalCreated,
        processed_flokouts: results.length,
        results
      });
    } catch (error: any) {
      console.error('Create missing attendance records error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
} 