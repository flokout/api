"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpotsController = void 0;
const database_1 = require("../config/database");
/**
 * Spots Controller - Locations/Venues Management
 */
class SpotsController {
    /**
     * Get spots with optional flok filter
     */
    static async getSpots(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { flok_id, limit = 50, offset = 0 } = req.query;
            let query = database_1.supabaseClient
                .from('spots')
                .select('*')
                .order('created_at', { ascending: false })
                .range(Number(offset), Number(offset) + Number(limit) - 1);
            if (flok_id) {
                query = query.eq('flok_id', flok_id);
            }
            const { data: spots, error: spotsError } = await query;
            if (spotsError) {
                res.status(500).json({ error: 'Failed to fetch spots' });
                return;
            }
            res.json({ spots });
        }
        catch (error) {
            console.error('Get spots error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Create new spot
     */
    static async createSpot(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { name, address, cost_per_hour, contact_number, flok_id, tags, booking_link, description } = req.body;
            if (!name) {
                res.status(400).json({ error: 'Spot name is required' });
                return;
            }
            // If flok_id is provided, check if user is a member
            if (flok_id) {
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
            }
            const { data: spot, error: spotError } = await database_1.supabaseClient
                .from('spots')
                .insert({
                name,
                address,
                cost_per_hour: cost_per_hour ? Number(cost_per_hour) : null,
                contact_number,
                flok_id,
                tags: tags || [],
                booking_link,
                description,
                created_by: req.user.id
            })
                .select()
                .single();
            if (spotError) {
                res.status(400).json({ error: spotError.message });
                return;
            }
            res.status(201).json({
                message: 'Spot created successfully',
                spot
            });
        }
        catch (error) {
            console.error('Create spot error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Get spot by ID
     */
    static async getSpotById(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { id } = req.params;
            const { data: spot, error: spotError } = await database_1.supabaseClient
                .from('spots')
                .select('*')
                .eq('id', id)
                .single();
            if (spotError) {
                res.status(404).json({ error: 'Spot not found' });
                return;
            }
            // If spot belongs to a flok, check if user is a member
            if (spot.flok_id) {
                const { data: membership } = await database_1.supabaseClient
                    .from('flokmates')
                    .select('role')
                    .eq('flok_id', spot.flok_id)
                    .eq('user_id', req.user.id)
                    .single();
                if (!membership) {
                    res.status(403).json({ error: 'Access denied. You are not a member of this flok.' });
                    return;
                }
            }
            res.json({ spot });
        }
        catch (error) {
            console.error('Get spot error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Update spot
     */
    static async updateSpot(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { id } = req.params;
            const { name, address, cost_per_hour, contact_number, tags, booking_link, description } = req.body;
            // Get current spot to check permissions
            const { data: currentSpot, error: getError } = await database_1.supabaseClient
                .from('spots')
                .select('created_by, flok_id')
                .eq('id', id)
                .single();
            if (getError) {
                res.status(404).json({ error: 'Spot not found' });
                return;
            }
            // Check if user can update this spot (creator or flok admin)
            let canUpdate = currentSpot.created_by === req.user.id;
            if (!canUpdate && currentSpot.flok_id) {
                const { data: membership } = await database_1.supabaseClient
                    .from('flokmates')
                    .select('role')
                    .eq('flok_id', currentSpot.flok_id)
                    .eq('user_id', req.user.id)
                    .single();
                canUpdate = membership?.role === 'admin';
            }
            if (!canUpdate) {
                res.status(403).json({ error: 'Access denied. You can only update spots you created or flok spots if you are an admin.' });
                return;
            }
            const { data: spot, error: updateError } = await database_1.supabaseClient
                .from('spots')
                .update({
                name,
                address,
                cost_per_hour: cost_per_hour ? Number(cost_per_hour) : null,
                contact_number,
                tags: tags || [],
                booking_link,
                description
            })
                .eq('id', id)
                .select()
                .single();
            if (updateError) {
                res.status(400).json({ error: updateError.message });
                return;
            }
            res.json({
                message: 'Spot updated successfully',
                spot
            });
        }
        catch (error) {
            console.error('Update spot error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Delete spot
     */
    static async deleteSpot(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { id } = req.params;
            // Get current spot to check permissions
            const { data: currentSpot, error: getError } = await database_1.supabaseClient
                .from('spots')
                .select('created_by, flok_id')
                .eq('id', id)
                .single();
            if (getError) {
                res.status(404).json({ error: 'Spot not found' });
                return;
            }
            // Check if user can delete this spot (creator or flok admin)
            let canDelete = currentSpot.created_by === req.user.id;
            if (!canDelete && currentSpot.flok_id) {
                const { data: membership } = await database_1.supabaseClient
                    .from('flokmates')
                    .select('role')
                    .eq('flok_id', currentSpot.flok_id)
                    .eq('user_id', req.user.id)
                    .single();
                canDelete = membership?.role === 'admin';
            }
            if (!canDelete) {
                res.status(403).json({ error: 'Access denied. You can only delete spots you created or flok spots if you are an admin.' });
                return;
            }
            const { error: deleteError } = await database_1.supabaseClient
                .from('spots')
                .delete()
                .eq('id', id);
            if (deleteError) {
                res.status(400).json({ error: deleteError.message });
                return;
            }
            res.json({ message: 'Spot deleted successfully' });
        }
        catch (error) {
            console.error('Delete spot error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Search spots by name or address
     */
    static async searchSpots(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { query } = req.params;
            const { flok_id, limit = 20 } = req.query;
            if (!query || query.length < 2) {
                res.status(400).json({ error: 'Search query must be at least 2 characters' });
                return;
            }
            let searchQuery = database_1.supabaseClient
                .from('spots')
                .select('*')
                .or(`name.ilike.%${query}%,address.ilike.%${query}%`)
                .order('name')
                .limit(Number(limit));
            if (flok_id) {
                searchQuery = searchQuery.eq('flok_id', flok_id);
            }
            const { data: spots, error: searchError } = await searchQuery;
            if (searchError) {
                res.status(500).json({ error: 'Failed to search spots' });
                return;
            }
            res.json({ spots });
        }
        catch (error) {
            console.error('Search spots error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Get spots for specific flok
     */
    static async getSpotsByFlok(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { flokId } = req.params;
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
            const { data: spots, error: spotsError } = await database_1.supabaseClient
                .from('spots')
                .select('*')
                .eq('flok_id', flokId)
                .order('created_at', { ascending: false });
            if (spotsError) {
                res.status(500).json({ error: 'Failed to fetch flok spots' });
                return;
            }
            res.json({ spots });
        }
        catch (error) {
            console.error('Get flok spots error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}
exports.SpotsController = SpotsController;
//# sourceMappingURL=spotsController.js.map