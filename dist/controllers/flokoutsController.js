"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlokoutsController = void 0;
const database_1 = require("../config/database");
/**
 * Flokouts Controller - Events Management
 */
class FlokoutsController {
    /**
     * Get flokouts with optional filters
     */
    static async getFlokouts(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { flok_id, status, limit = 50, offset = 0 } = req.query;
            // Get user's floks to filter flokouts
            const { data: userFloks } = await database_1.supabaseClient
                .from('flokmates')
                .select('flok_id')
                .eq('user_id', req.user.id);
            const userFlokIds = userFloks?.map(f => f.flok_id) || [];
            if (userFlokIds.length === 0) {
                res.json({ flokouts: [] });
                return;
            }
            let query = database_1.supabaseClient
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
                .order('date', { ascending: true })
                .range(Number(offset), Number(offset) + Number(limit) - 1);
            if (flok_id) {
                query = query.eq('flok_id', flok_id);
            }
            if (status) {
                query = query.eq('status', status);
            }
            const { data: flokouts, error: flokoutsError } = await query;
            if (flokoutsError) {
                res.status(500).json({ error: 'Failed to fetch flokouts' });
                return;
            }
            // For each flokout, get RSVP data and flok members (for poll status)
            const flokoutsWithRSVPData = await Promise.all((flokouts || []).map(async (flokout) => {
                // Get RSVP data
                const { data: attendances } = await database_1.supabaseClient
                    .from('attendances')
                    .select(`
              id,
              user_id,
              rsvp_status,
              attended,
              profiles!inner(
                id,
                full_name,
                avatar_url
              )
            `)
                    .eq('flokout_id', flokout.id);
                // Get flok members for poll status flokouts
                let flokMembers = [];
                if (flokout.status === 'poll') {
                    const { data: members } = await database_1.supabaseClient
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
                }
                return {
                    ...flokout,
                    attendees: attendances || [],
                    flok_members: flokMembers,
                    rsvp_count: attendances?.filter(a => a.rsvp_status === 'yes').length || 0,
                    attendance_count: attendances?.filter(a => a.attended === true).length || 0
                };
            }));
            res.json({ flokouts: flokoutsWithRSVPData });
        }
        catch (error) {
            console.error('Get flokouts error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Create new flokout
     */
    static async createFlokout(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { title, description, date, flok_id, spot_id, min_people_required = 2, status = 'poll' } = req.body;
            if (!title || !date || !flok_id) {
                res.status(400).json({ error: 'Title, date, and flok_id are required' });
                return;
            }
            // Check if user is a member of this flok
            const { data: membership } = await database_1.supabaseClient
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
                const { data: spot, error: spotError } = await database_1.supabaseClient
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
            const { data: flokout, error: flokoutError } = await database_1.supabaseClient
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
            res.status(201).json({
                message: 'Flokout created successfully',
                flokout
            });
        }
        catch (error) {
            console.error('Create flokout error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Get flokout by ID
     */
    static async getFlokoutById(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { id } = req.params;
            const { data: flokout, error: flokoutError } = await database_1.supabaseClient
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
            const { data: membership } = await database_1.supabaseClient
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
            const { data: attendances, error: attendanceError } = await database_1.supabaseClient
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
            const { data: flokMembers, error: membersError } = await database_1.supabaseClient
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
        }
        catch (error) {
            console.error('Get flokout error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Update flokout
     */
    static async updateFlokout(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { id } = req.params;
            const { title, description, date, spot_id, min_people_required } = req.body;
            // Get current flokout to check permissions
            const { data: currentFlokout, error: getError } = await database_1.supabaseClient
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
                const { data: membership } = await database_1.supabaseClient
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
            const updateData = {
                last_updated_at: new Date().toISOString()
            };
            if (title !== undefined)
                updateData.title = title;
            if (description !== undefined)
                updateData.description = description;
            if (date !== undefined)
                updateData.date = date;
            if (spot_id !== undefined)
                updateData.spot_id = spot_id;
            if (min_people_required !== undefined)
                updateData.min_people_required = Number(min_people_required);
            const { data: flokout, error: updateError } = await database_1.supabaseClient
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
        }
        catch (error) {
            console.error('Update flokout error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Delete flokout
     */
    static async deleteFlokout(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { id } = req.params;
            // Get current flokout to check permissions
            const { data: currentFlokout, error: getError } = await database_1.supabaseClient
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
                const { data: membership } = await database_1.supabaseClient
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
            const { error: deleteError } = await database_1.supabaseClient
                .from('flokouts')
                .delete()
                .eq('id', id);
            if (deleteError) {
                res.status(400).json({ error: deleteError.message });
                return;
            }
            res.json({ message: 'Flokout deleted successfully' });
        }
        catch (error) {
            console.error('Delete flokout error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Update flokout status
     */
    static async updateFlokoutStatus(req, res) {
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
            const { data: currentFlokout, error: getError } = await database_1.supabaseClient
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
                const { data: membership } = await database_1.supabaseClient
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
            const { data: flokout, error: updateError } = await database_1.supabaseClient
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
        }
        catch (error) {
            console.error('Update flokout status error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Confirm flokout (change status to confirmed)
     */
    static async confirmFlokout(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { id } = req.params;
            // Get current flokout to check permissions and status
            const { data: currentFlokout, error: getError } = await database_1.supabaseClient
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
                const { data: membership } = await database_1.supabaseClient
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
            const { data: yesResponses } = await database_1.supabaseClient
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
            const { data: flokout, error: updateError } = await database_1.supabaseClient
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
        }
        catch (error) {
            console.error('Confirm flokout error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Get flokouts for specific flok
     */
    static async getFlokoutsByFlok(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { flokId } = req.params;
            const { status, limit = 50, offset = 0 } = req.query;
            // Check if user is a member of this flok
            const { data: membership } = await database_1.supabaseClient
                .from('flokmates')
                .select('role')
                .eq('flok_id', flokId)
                .eq('user_id', req.user.id)
                .single();
            if (!membership) {
                res.status(403).json({ error: 'Access denied. You are not a member of this flok.' });
                return;
            }
            let query = database_1.supabaseClient
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
                query = query.eq('status', status);
            }
            const { data: flokouts, error: flokoutsError } = await query;
            if (flokoutsError) {
                res.status(500).json({ error: 'Failed to fetch flok flokouts' });
                return;
            }
            res.json({ flokouts });
        }
        catch (error) {
            console.error('Get flok flokouts error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Get user's created flokouts
     */
    static async getUserCreatedFlokouts(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { status, limit = 50, offset = 0 } = req.query;
            let query = database_1.supabaseClient
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
                query = query.eq('status', status);
            }
            const { data: flokouts, error: flokoutsError } = await query;
            if (flokoutsError) {
                res.status(500).json({ error: 'Failed to fetch user created flokouts' });
                return;
            }
            res.json({ flokouts });
        }
        catch (error) {
            console.error('Get user created flokouts error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Get flokouts user is attending
     */
    static async getUserAttendingFlokouts(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { response, limit = 50, offset = 0 } = req.query;
            // Get flokouts where user has RSVPed
            const { data: attendances, error: attendanceError } = await database_1.supabaseClient
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
        }
        catch (error) {
            console.error('Get user attending flokouts error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}
exports.FlokoutsController = FlokoutsController;
//# sourceMappingURL=flokoutsController.js.map