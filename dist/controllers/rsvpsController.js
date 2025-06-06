"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RSVPsController = void 0;
const database_1 = require("../config/database");
/**
 * RSVPs Controller - Attendance Management for Flokouts
 */
class RSVPsController {
    /**
     * Create or update RSVP for a flokout
     */
    static async createOrUpdateRSVP(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { flokoutId } = req.params;
            const { response } = req.body;
            const validResponses = ['yes', 'no', 'maybe'];
            if (!response || !validResponses.includes(response)) {
                res.status(400).json({ error: 'Valid response is required (yes, no, maybe)' });
                return;
            }
            // Get flokout to check if user can RSVP
            const { data: flokout, error: flokoutError } = await database_1.supabaseClient
                .from('flokouts')
                .select('flok_id, status')
                .eq('id', flokoutId)
                .single();
            if (flokoutError) {
                res.status(404).json({ error: 'Flokout not found' });
                return;
            }
            // Check if user is a member of the flok
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
            // Don't allow RSVP to completed or cancelled flokouts
            if (['completed', 'cancelled'].includes(flokout.status)) {
                res.status(400).json({ error: 'Cannot RSVP to completed or cancelled flokouts' });
                return;
            }
            // Check if RSVP already exists
            const { data: existingRSVP } = await database_1.supabaseClient
                .from('attendances')
                .select('id')
                .eq('flokout_id', flokoutId)
                .eq('user_id', req.user.id)
                .single();
            let rsvp;
            if (existingRSVP) {
                // Update existing RSVP
                const { data: updatedRSVP, error: updateError } = await database_1.supabaseClient
                    .from('attendances')
                    .update({
                    rsvp_status: response,
                    updated_at: new Date().toISOString()
                })
                    .eq('id', existingRSVP.id)
                    .select()
                    .single();
                if (updateError) {
                    res.status(400).json({ error: updateError.message });
                    return;
                }
                rsvp = updatedRSVP;
            }
            else {
                // Create new RSVP
                const { data: newRSVP, error: createError } = await database_1.supabaseClient
                    .from('attendances')
                    .insert({
                    flokout_id: flokoutId,
                    user_id: req.user.id,
                    rsvp_status: response
                })
                    .select()
                    .single();
                if (createError) {
                    res.status(400).json({ error: createError.message });
                    return;
                }
                rsvp = newRSVP;
            }
            res.json({
                message: 'RSVP updated successfully',
                rsvp
            });
        }
        catch (error) {
            console.error('Create/Update RSVP error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Get all RSVPs for a flokout
     */
    static async getFlokoutRSVPs(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { flokoutId } = req.params;
            console.log('[RSVPs] Getting RSVPs for flokout:', flokoutId, 'by user:', req.user.id);
            // Get flokout to check permissions
            const { data: flokout, error: flokoutError } = await database_1.supabaseClient
                .from('flokouts')
                .select('flok_id, title')
                .eq('id', flokoutId)
                .single();
            if (flokoutError) {
                console.log('[RSVPs] Flokout not found:', flokoutError);
                res.status(404).json({ error: 'Flokout not found', details: flokoutError.message });
                return;
            }
            console.log('[RSVPs] Found flokout:', flokout.title, 'in flok:', flokout.flok_id);
            // Check if user is a member of the flok
            const { data: membership } = await database_1.supabaseClient
                .from('flokmates')
                .select('role')
                .eq('flok_id', flokout.flok_id)
                .eq('user_id', req.user.id)
                .single();
            if (!membership) {
                console.log('[RSVPs] User not a member of flok:', flokout.flok_id);
                res.status(403).json({ error: 'Access denied. You are not a member of this flok.' });
                return;
            }
            console.log('[RSVPs] User has access, role:', membership.role);
            const { data: rsvps, error: rsvpsError } = await database_1.supabaseClient
                .from('attendances')
                .select(`
          id,
          user_id,
          rsvp_status,
          created_at,
          updated_at,
          profiles!inner(
            id,
            email,
            full_name,
            avatar_url
          )
        `)
                .eq('flokout_id', flokoutId)
                .order('created_at', { ascending: false });
            if (rsvpsError) {
                console.log('[RSVPs] Error fetching RSVPs:', rsvpsError);
                res.status(500).json({ error: 'Failed to fetch RSVPs', details: rsvpsError.message });
                return;
            }
            console.log('[RSVPs] Found', rsvps?.length || 0, 'RSVPs');
            // Group RSVPs by response
            const groupedRSVPs = {
                yes: rsvps?.filter(r => r.rsvp_status === 'yes') || [],
                no: rsvps?.filter(r => r.rsvp_status === 'no') || [],
                maybe: rsvps?.filter(r => r.rsvp_status === 'maybe') || [],
                counts: {
                    yes: rsvps?.filter(r => r.rsvp_status === 'yes').length || 0,
                    no: rsvps?.filter(r => r.rsvp_status === 'no').length || 0,
                    maybe: rsvps?.filter(r => r.rsvp_status === 'maybe').length || 0,
                    total: rsvps?.length || 0
                }
            };
            res.json({
                message: 'RSVPs fetched successfully',
                rsvps: groupedRSVPs,
                all_rsvps: rsvps,
                flokout_info: {
                    id: flokoutId,
                    title: flokout.title,
                    flok_id: flokout.flok_id
                }
            });
        }
        catch (error) {
            console.error('Get flokout RSVPs error:', error);
            res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    }
    /**
     * Remove RSVP for a flokout
     */
    static async removeRSVP(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { flokoutId } = req.params;
            const { error: deleteError } = await database_1.supabaseClient
                .from('attendances')
                .delete()
                .eq('flokout_id', flokoutId)
                .eq('user_id', req.user.id);
            if (deleteError) {
                res.status(400).json({ error: deleteError.message });
                return;
            }
            res.json({ message: 'RSVP removed successfully' });
        }
        catch (error) {
            console.error('Remove RSVP error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Get user's RSVPs
     */
    static async getUserRSVPs(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { response, limit = 50, offset = 0 } = req.query;
            let query = database_1.supabaseClient
                .from('attendances')
                .select(`
          id,
          rsvp_status,
          created_at,
          updated_at,
          flokouts!inner(
            id,
            title,
            date,
            status,
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
            if (response) {
                query = query.eq('rsvp_status', response);
            }
            const { data: rsvps, error: rsvpsError } = await query;
            if (rsvpsError) {
                res.status(500).json({ error: 'Failed to fetch user RSVPs' });
                return;
            }
            res.json({ rsvps });
        }
        catch (error) {
            console.error('Get user RSVPs error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Get user's RSVP for specific flokout
     */
    static async getUserRSVPForFlokout(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { flokoutId } = req.params;
            const { data: rsvp, error: rsvpError } = await database_1.supabaseClient
                .from('attendances')
                .select('*')
                .eq('flokout_id', flokoutId)
                .eq('user_id', req.user.id)
                .single();
            if (rsvpError && rsvpError.code !== 'PGRST116') {
                res.status(500).json({ error: 'Failed to fetch RSVP' });
                return;
            }
            res.json({
                rsvp: rsvp || null,
                has_rsvp: !!rsvp
            });
        }
        catch (error) {
            console.error('Get user RSVP for flokout error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}
exports.RSVPsController = RSVPsController;
//# sourceMappingURL=rsvpsController.js.map