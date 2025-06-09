"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FloksController = void 0;
const database_1 = require("../config/database");
/**
 * Floks Controller - Groups/Communities Management
 */
class FloksController {
    /**
     * Get user's floks
     */
    static async getUserFloks(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { data: flokmates, error: flokError } = await database_1.supabaseClient
                .from('flokmates')
                .select(`
          flok_id,
          role,
          joined_at,
          floks!inner(
            id,
            name,
            created_at,
            created_by,
            active
          )
        `)
                .eq('user_id', req.user.id);
            if (flokError) {
                res.status(500).json({ error: 'Failed to fetch floks' });
                return;
            }
            // For each flok, get the member count
            const floksWithMemberCount = await Promise.all((flokmates || []).map(async (fm) => {
                const { count: memberCount } = await database_1.supabaseClient
                    .from('flokmates')
                    .select('*', { count: 'exact', head: true })
                    .eq('flok_id', fm.flok_id);
                return {
                    ...fm.floks,
                    user_role: fm.role,
                    joined_at: fm.joined_at,
                    member_count: memberCount || 0,
                    is_member: true
                };
            }));
            res.json({ floks: floksWithMemberCount });
        }
        catch (error) {
            console.error('Get user floks error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Create new flok
     */
    static async createFlok(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { name } = req.body;
            if (!name) {
                res.status(400).json({ error: 'Flok name is required' });
                return;
            }
            // Create flok
            const { data: flok, error: flokError } = await database_1.supabaseClient
                .from('floks')
                .insert({
                name,
                created_by: req.user.id,
                active: true
            })
                .select()
                .single();
            if (flokError) {
                res.status(400).json({ error: flokError.message });
                return;
            }
            // Add creator as admin member
            const { error: memberError } = await database_1.supabaseClient
                .from('flokmates')
                .insert({
                flok_id: flok.id,
                user_id: req.user.id,
                role: 'admin'
            });
            if (memberError) {
                // If membership fails, delete the flok
                await database_1.supabaseClient
                    .from('floks')
                    .delete()
                    .eq('id', flok.id);
                res.status(400).json({ error: 'Failed to create flok membership' });
                return;
            }
            res.status(201).json({
                message: 'Flok created successfully',
                flok: {
                    ...flok,
                    user_role: 'admin'
                }
            });
        }
        catch (error) {
            console.error('Create flok error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Get flok by ID
     */
    static async getFlokById(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { id } = req.params;
            // Check if user is a member of this flok
            const { data: membership } = await database_1.supabaseClient
                .from('flokmates')
                .select('role')
                .eq('flok_id', id)
                .eq('user_id', req.user.id)
                .single();
            if (!membership) {
                res.status(403).json({ error: 'Access denied. You are not a member of this flok.' });
                return;
            }
            // Get flok details
            const { data: flok, error: flokError } = await database_1.supabaseClient
                .from('floks')
                .select('*')
                .eq('id', id)
                .single();
            if (flokError) {
                res.status(404).json({ error: 'Flok not found' });
                return;
            }
            // Get flokmates with user profiles
            const { data: flokmates, error: flokmatesError } = await database_1.supabaseClient
                .from('flokmates')
                .select(`
          id,
          role,
          joined_at,
          user:profiles!flokmates_user_id_fkey (
            id,
            full_name,
            email
          )
        `)
                .eq('flok_id', id);
            if (flokmatesError) {
                console.error('Error fetching flokmates:', flokmatesError);
            }
            // Get associated spots
            const { data: spots, error: spotsError } = await database_1.supabaseClient
                .from('flok_spots')
                .select(`
          spots (
            id,
            name,
            address,
            description
          )
        `)
                .eq('flok_id', id);
            if (spotsError) {
                console.error('Error fetching spots:', spotsError);
            }
            // Get associated flokouts
            const { data: flokouts, error: flokoutsError } = await database_1.supabaseClient
                .from('flokouts')
                .select('id, title, date, status')
                .eq('flok_id', id)
                .order('date', { ascending: false });
            if (flokoutsError) {
                console.error('Error fetching flokouts:', flokoutsError);
            }
            res.json({
                flok: {
                    ...flok,
                    user_role: membership.role,
                    flokmates: flokmates || [],
                    spots: spots?.map(s => s.spots).filter(Boolean) || [],
                    flokouts: flokouts || []
                }
            });
        }
        catch (error) {
            console.error('Get flok error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Update flok
     */
    static async updateFlok(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { id } = req.params;
            const { name } = req.body;
            // Check if user is admin of this flok
            const { data: membership } = await database_1.supabaseClient
                .from('flokmates')
                .select('role')
                .eq('flok_id', id)
                .eq('user_id', req.user.id)
                .single();
            if (!membership || membership.role !== 'admin') {
                res.status(403).json({ error: 'Access denied. Admin role required.' });
                return;
            }
            const { data: flok, error: updateError } = await database_1.supabaseClient
                .from('floks')
                .update({ name })
                .eq('id', id)
                .select()
                .single();
            if (updateError) {
                res.status(400).json({ error: updateError.message });
                return;
            }
            res.json({
                message: 'Flok updated successfully',
                flok
            });
        }
        catch (error) {
            console.error('Update flok error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Delete flok
     */
    static async deleteFlok(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { id } = req.params;
            // Check if user is admin of this flok
            const { data: membership } = await database_1.supabaseClient
                .from('flokmates')
                .select('role')
                .eq('flok_id', id)
                .eq('user_id', req.user.id)
                .single();
            if (!membership || membership.role !== 'admin') {
                res.status(403).json({ error: 'Access denied. Admin role required.' });
                return;
            }
            const { error: deleteError } = await database_1.supabaseClient
                .from('floks')
                .update({ active: false })
                .eq('id', id);
            if (deleteError) {
                res.status(400).json({ error: deleteError.message });
                return;
            }
            res.json({ message: 'Flok deleted successfully' });
        }
        catch (error) {
            console.error('Delete flok error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Get flok members
     */
    static async getFlokMembers(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { id } = req.params;
            // Check if user is a member of this flok
            const { data: membership } = await database_1.supabaseClient
                .from('flokmates')
                .select('role')
                .eq('flok_id', id)
                .eq('user_id', req.user.id)
                .single();
            if (!membership) {
                res.status(403).json({ error: 'Access denied. You are not a member of this flok.' });
                return;
            }
            const { data: members, error: membersError } = await database_1.supabaseClient
                .from('flokmates')
                .select(`
          user_id,
          role,
          joined_at,
          profiles!inner(
            id,
            email,
            full_name,
            avatar_url
          )
        `)
                .eq('flok_id', id);
            if (membersError) {
                res.status(500).json({ error: 'Failed to fetch flok members' });
                return;
            }
            res.json({ members });
        }
        catch (error) {
            console.error('Get flok members error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Join flok with invite code
     */
    static async joinFlok(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { id } = req.params;
            const { invite_code } = req.body;
            if (!invite_code) {
                res.status(400).json({ error: 'Invite code is required' });
                return;
            }
            // Check if invite code is valid
            const { data: invite, error: inviteError } = await database_1.supabaseClient
                .from('flok_invites')
                .select('*')
                .eq('flok_id', id)
                .eq('code', invite_code)
                .gt('expires_at', new Date().toISOString())
                .single();
            if (inviteError || !invite) {
                res.status(400).json({ error: 'Invalid or expired invite code' });
                return;
            }
            // Check if user is already a member
            const { data: existingMember } = await database_1.supabaseClient
                .from('flokmates')
                .select('id')
                .eq('flok_id', id)
                .eq('user_id', req.user.id)
                .single();
            if (existingMember) {
                res.status(400).json({ error: 'You are already a member of this flok' });
                return;
            }
            // Add user as member
            const { error: memberError } = await database_1.supabaseClient
                .from('flokmates')
                .insert({
                flok_id: id,
                user_id: req.user.id,
                role: 'member'
            });
            if (memberError) {
                res.status(400).json({ error: 'Failed to join flok' });
                return;
            }
            res.json({ message: 'Successfully joined flok' });
        }
        catch (error) {
            console.error('Join flok error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Leave flok
     */
    static async leaveFlok(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { id } = req.params;
            const { error: leaveError } = await database_1.supabaseClient
                .from('flokmates')
                .delete()
                .eq('flok_id', id)
                .eq('user_id', req.user.id);
            if (leaveError) {
                res.status(400).json({ error: 'Failed to leave flok' });
                return;
            }
            res.json({ message: 'Successfully left flok' });
        }
        catch (error) {
            console.error('Leave flok error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Remove member (admin only)
     */
    static async removeMember(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { id, userId } = req.params;
            // Check if user is admin of this flok
            const { data: membership } = await database_1.supabaseClient
                .from('flokmates')
                .select('role')
                .eq('flok_id', id)
                .eq('user_id', req.user.id)
                .single();
            if (!membership || membership.role !== 'admin') {
                res.status(403).json({ error: 'Access denied. Admin role required.' });
                return;
            }
            const { error: removeError } = await database_1.supabaseClient
                .from('flokmates')
                .delete()
                .eq('flok_id', id)
                .eq('user_id', userId);
            if (removeError) {
                res.status(400).json({ error: 'Failed to remove member' });
                return;
            }
            res.json({ message: 'Member removed successfully' });
        }
        catch (error) {
            console.error('Remove member error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Update member role (admin only)
     */
    static async updateMemberRole(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { id, userId } = req.params;
            const { role } = req.body;
            if (!role || !['admin', 'member'].includes(role)) {
                res.status(400).json({ error: 'Valid role (admin/member) is required' });
                return;
            }
            // Check if user is admin of this flok
            const { data: membership } = await database_1.supabaseClient
                .from('flokmates')
                .select('role')
                .eq('flok_id', id)
                .eq('user_id', req.user.id)
                .single();
            if (!membership || membership.role !== 'admin') {
                res.status(403).json({ error: 'Access denied. Admin role required.' });
                return;
            }
            const { error: updateError } = await database_1.supabaseClient
                .from('flokmates')
                .update({ role })
                .eq('flok_id', id)
                .eq('user_id', userId);
            if (updateError) {
                res.status(400).json({ error: 'Failed to update member role' });
                return;
            }
            res.json({ message: 'Member role updated successfully' });
        }
        catch (error) {
            console.error('Update member role error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Create invite code
     */
    static async createInvite(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { id } = req.params;
            const { expires_in_days, expires_in_hours, max_uses } = req.body;
            console.log('📧 CreateInvite API called:', {
                flokId: id,
                userId: req.user.id,
                requestBody: req.body
            });
            // Check if user is admin of this flok
            const { data: membership } = await database_1.supabaseClient
                .from('flokmates')
                .select('role')
                .eq('flok_id', id)
                .eq('user_id', req.user.id)
                .single();
            console.log('📧 User membership check:', { membership, userId: req.user.id, flokId: id });
            if (!membership || membership.role !== 'admin') {
                console.log('📧 Access denied - user is not admin');
                res.status(403).json({ error: 'Access denied. Admin role required.' });
                return;
            }
            // Generate a shorter, more user-friendly invite code (4 digits)
            const inviteCode = Math.floor(1000 + Math.random() * 9000).toString();
            // Calculate expiry time - support both hours and days
            const expiresAt = new Date();
            if (expires_in_hours) {
                expiresAt.setHours(expiresAt.getHours() + expires_in_hours);
                console.log('📧 Using hours for expiry:', expires_in_hours);
            }
            else {
                const days = expires_in_days || 7; // Default to 7 days
                expiresAt.setDate(expiresAt.getDate() + days);
                console.log('📧 Using days for expiry:', days);
            }
            console.log('📧 Creating invite with:', {
                code: inviteCode,
                flokId: id,
                expiresAt: expiresAt.toISOString(),
                maxUses: max_uses
            });
            const { data: invite, error: inviteError } = await database_1.supabaseClient
                .from('flok_invites')
                .insert({
                flok_id: id,
                code: inviteCode,
                created_by: req.user.id,
                expires_at: expiresAt.toISOString()
            })
                .select()
                .single();
            if (inviteError) {
                console.error('📧 Database error creating invite:', inviteError);
                res.status(400).json({ error: 'Failed to create invite', details: inviteError.message });
                return;
            }
            console.log('📧 Invite created successfully:', invite);
            res.status(201).json({
                message: 'Invite created successfully',
                invite
            });
        }
        catch (error) {
            console.error('📧 Create invite error:', error);
            res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    }
    /**
     * Get flok invites
     */
    static async getFlokInvites(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { id } = req.params;
            console.log('📧 GetInvites API called:', { flokId: id, userId: req.user.id });
            // Check if user is admin of this flok
            const { data: membership } = await database_1.supabaseClient
                .from('flokmates')
                .select('role')
                .eq('flok_id', id)
                .eq('user_id', req.user.id)
                .single();
            if (!membership || membership.role !== 'admin') {
                console.log('📧 Access denied - user is not admin');
                res.status(403).json({ error: 'Access denied. Admin role required.' });
                return;
            }
            const { data: invites, error: invitesError } = await database_1.supabaseClient
                .from('flok_invites')
                .select('*')
                .eq('flok_id', id)
                .order('created_at', { ascending: false });
            if (invitesError) {
                console.error('📧 Database error fetching invites:', invitesError);
                res.status(500).json({ error: 'Failed to fetch invites' });
                return;
            }
            console.log('📧 Found invites:', invites?.length || 0);
            res.json({ invites: invites || [] });
        }
        catch (error) {
            console.error('📧 Get flok invites error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Delete invite
     */
    static async deleteInvite(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { inviteId } = req.params;
            // Get invite to check flok ownership
            const { data: invite, error: getError } = await database_1.supabaseClient
                .from('flok_invites')
                .select('flok_id')
                .eq('id', inviteId)
                .single();
            if (getError || !invite) {
                res.status(404).json({ error: 'Invite not found' });
                return;
            }
            // Check if user is admin of this flok
            const { data: membership } = await database_1.supabaseClient
                .from('flokmates')
                .select('role')
                .eq('flok_id', invite.flok_id)
                .eq('user_id', req.user.id)
                .single();
            if (!membership || membership.role !== 'admin') {
                res.status(403).json({ error: 'Access denied. Admin role required.' });
                return;
            }
            const { error: deleteError } = await database_1.supabaseClient
                .from('flok_invites')
                .delete()
                .eq('id', inviteId);
            if (deleteError) {
                res.status(400).json({ error: 'Failed to delete invite' });
                return;
            }
            res.json({ message: 'Invite deleted successfully' });
        }
        catch (error) {
            console.error('Delete invite error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Deactivate invite by code
     */
    static async deactivateInvite(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { invite_code } = req.body;
            if (!invite_code) {
                res.status(400).json({ error: 'Invite code is required' });
                return;
            }
            console.log('📧 DeactivateInvite API called:', {
                userId: req.user.id,
                inviteCode: invite_code
            });
            // Get invite to check if it exists and get flok ownership
            const { data: invite, error: getError } = await database_1.supabaseClient
                .from('flok_invites')
                .select('id, flok_id, code')
                .eq('code', invite_code)
                .single();
            if (getError || !invite) {
                console.log('📧 Invite not found for code:', invite_code);
                res.status(404).json({ error: 'Invite not found' });
                return;
            }
            // Check if user is admin of this flok
            const { data: membership } = await database_1.supabaseClient
                .from('flokmates')
                .select('role')
                .eq('flok_id', invite.flok_id)
                .eq('user_id', req.user.id)
                .single();
            if (!membership || membership.role !== 'admin') {
                console.log('📧 Access denied - user is not admin');
                res.status(403).json({ error: 'Access denied. Admin role required.' });
                return;
            }
            console.log('📧 Deactivating invite:', { inviteId: invite.id, code: invite.code });
            const { error: deleteError } = await database_1.supabaseClient
                .from('flok_invites')
                .delete()
                .eq('id', invite.id);
            if (deleteError) {
                console.error('📧 Error deactivating invite:', deleteError);
                res.status(400).json({ error: 'Failed to deactivate invite' });
                return;
            }
            console.log('📧 Invite deactivated successfully');
            res.json({ message: 'Invite deactivated successfully' });
        }
        catch (error) {
            console.error('Deactivate invite error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Verify invite code and get flok details (without joining)
     */
    static async verifyInvite(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { invite_code } = req.body;
            if (!invite_code) {
                res.status(400).json({ error: 'Invite code is required' });
                return;
            }
            console.log('📧 VerifyInvite API called:', {
                userId: req.user.id,
                inviteCode: invite_code
            });
            // Check if invite code is valid
            const { data: invite, error: inviteError } = await database_1.supabaseClient
                .from('flok_invites')
                .select('flok_id, id, expires_at')
                .eq('code', invite_code)
                .gt('expires_at', new Date().toISOString())
                .single();
            if (inviteError || !invite) {
                console.log('📧 Invalid invite code:', invite_code);
                res.status(400).json({ error: 'Invalid or expired invite code' });
                return;
            }
            console.log('📧 Valid invite found for flok:', invite.flok_id);
            // Get flok details with creator info and member count
            const { data: flokData, error: flokError } = await database_1.supabaseClient
                .from('floks')
                .select(`
          id,
          name,
          created_at,
          created_by,
          creator:profiles!created_by(full_name, avatar_url)
        `)
                .eq('id', invite.flok_id)
                .single();
            if (flokError || !flokData) {
                console.error('📧 Error fetching flok details:', flokError);
                res.status(404).json({ error: 'Flok not found' });
                return;
            }
            // Get member count
            const { count: memberCount } = await database_1.supabaseClient
                .from('flokmates')
                .select('*', { count: 'exact', head: true })
                .eq('flok_id', invite.flok_id);
            // Check if user is already a member
            const { data: existingMember } = await database_1.supabaseClient
                .from('flokmates')
                .select('id')
                .eq('flok_id', invite.flok_id)
                .eq('user_id', req.user.id)
                .single();
            const response = {
                flok: {
                    id: flokData.id,
                    name: flokData.name,
                    created_at: flokData.created_at,
                    created_by: flokData.created_by,
                    memberCount: memberCount || 0,
                    creator: flokData.creator
                },
                isAlreadyMember: !!existingMember
            };
            console.log('📧 Returning flok details:', response);
            res.json(response);
        }
        catch (error) {
            console.error('📧 Verify invite error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Associate spot with flok
     */
    static async associateSpot(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { id: flokId } = req.params;
            const { spot_id } = req.body;
            if (!spot_id) {
                res.status(400).json({ error: 'Spot ID is required' });
                return;
            }
            // Check if user is admin of this flok
            const { data: membership } = await database_1.supabaseClient
                .from('flokmates')
                .select('role')
                .eq('flok_id', flokId)
                .eq('user_id', req.user.id)
                .single();
            if (!membership || membership.role !== 'admin') {
                res.status(403).json({ error: 'Access denied. Admin role required.' });
                return;
            }
            // Check if spot exists
            const { data: spot, error: spotError } = await database_1.supabaseClient
                .from('spots')
                .select('id')
                .eq('id', spot_id)
                .single();
            if (spotError || !spot) {
                res.status(404).json({ error: 'Spot not found' });
                return;
            }
            // Check if association already exists
            const { data: existingAssociation } = await database_1.supabaseClient
                .from('flok_spots')
                .select('id')
                .eq('flok_id', flokId)
                .eq('spot_id', spot_id)
                .single();
            if (existingAssociation) {
                res.status(400).json({ error: 'Spot is already associated with this flok' });
                return;
            }
            // Create association
            const { error: insertError } = await database_1.supabaseClient
                .from('flok_spots')
                .insert({
                flok_id: flokId,
                spot_id: spot_id,
                created_by: req.user.id
            });
            if (insertError) {
                console.error('Associate spot error:', insertError);
                res.status(400).json({ error: 'Failed to associate spot with flok' });
                return;
            }
            res.json({ message: 'Spot associated with flok successfully' });
        }
        catch (error) {
            console.error('Associate spot error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Disassociate spot from flok
     */
    static async disassociateSpot(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { id: flokId, spotId } = req.params;
            // Check if user is admin of this flok
            const { data: membership } = await database_1.supabaseClient
                .from('flokmates')
                .select('role')
                .eq('flok_id', flokId)
                .eq('user_id', req.user.id)
                .single();
            if (!membership || membership.role !== 'admin') {
                res.status(403).json({ error: 'Access denied. Admin role required.' });
                return;
            }
            // Remove association
            const { error: deleteError } = await database_1.supabaseClient
                .from('flok_spots')
                .delete()
                .eq('flok_id', flokId)
                .eq('spot_id', spotId);
            if (deleteError) {
                console.error('Disassociate spot error:', deleteError);
                res.status(400).json({ error: 'Failed to disassociate spot from flok' });
                return;
            }
            res.json({ message: 'Spot disassociated from flok successfully' });
        }
        catch (error) {
            console.error('Disassociate spot error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Reactivate flok
     */
    static async reactivateFlok(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { id } = req.params;
            // Check if user is admin of this flok
            const { data: membership } = await database_1.supabaseClient
                .from('flokmates')
                .select('role')
                .eq('flok_id', id)
                .eq('user_id', req.user.id)
                .single();
            if (!membership || membership.role !== 'admin') {
                res.status(403).json({ error: 'Access denied. Admin role required.' });
                return;
            }
            // Check if flok is currently inactive
            const { data: flok, error: flokError } = await database_1.supabaseClient
                .from('floks')
                .select('active')
                .eq('id', id)
                .single();
            if (flokError || !flok) {
                res.status(404).json({ error: 'Flok not found' });
                return;
            }
            if (flok.active) {
                res.status(400).json({ error: 'Flok is already active' });
                return;
            }
            // Reactivate the flok
            const { error: updateError } = await database_1.supabaseClient
                .from('floks')
                .update({
                active: true,
                updated_at: new Date().toISOString()
            })
                .eq('id', id);
            if (updateError) {
                console.error('Reactivate flok error:', updateError);
                res.status(400).json({ error: 'Failed to reactivate flok' });
                return;
            }
            res.json({ message: 'Flok reactivated successfully' });
        }
        catch (error) {
            console.error('Reactivate flok error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Permanently delete flok and associated data (purge)
     * Preserves: spots (reusable), user profiles (owned by users)
     * Deletes: flokouts, flok_spots associations, flokmates, invites, flok record
     */
    static async purgeFlok(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { id } = req.params;
            // Check if user is admin of this flok
            const { data: membership } = await database_1.supabaseClient
                .from('flokmates')
                .select('role')
                .eq('flok_id', id)
                .eq('user_id', req.user.id)
                .single();
            if (!membership || membership.role !== 'admin') {
                res.status(403).json({ error: 'Access denied. Admin role required.' });
                return;
            }
            // Check if flok exists and is inactive
            const { data: flok, error: flokError } = await database_1.supabaseClient
                .from('floks')
                .select('active, name')
                .eq('id', id)
                .single();
            if (flokError || !flok) {
                res.status(404).json({ error: 'Flok not found' });
                return;
            }
            if (flok.active) {
                res.status(400).json({ error: 'Cannot purge active flok. Deactivate first.' });
                return;
            }
            console.log(`🗑️ Starting purge of flok: ${flok.name} (${id})`);
            // Start transaction-like cleanup (order matters due to foreign keys)
            const cleanupResults = {
                rsvps: 0,
                flokouts: 0,
                flok_spots: 0,
                flok_invites: 0,
                flokmates: 0,
                flok: 0
            };
            // 1. Delete RSVPs for flokouts in this flok
            const { data: flokoutIds } = await database_1.supabaseClient
                .from('flokouts')
                .select('id')
                .eq('flok_id', id);
            if (flokoutIds && flokoutIds.length > 0) {
                const flokoutIdsList = flokoutIds.map(f => f.id);
                const { error: rsvpError } = await database_1.supabaseClient
                    .from('rsvps')
                    .delete()
                    .in('flokout_id', flokoutIdsList);
                if (rsvpError) {
                    console.error('Error deleting RSVPs:', rsvpError);
                    res.status(500).json({ error: 'Failed to delete flokout RSVPs' });
                    return;
                }
                cleanupResults.rsvps = flokoutIdsList.length;
            }
            // 2. Delete flokouts
            const { error: flokoutsError } = await database_1.supabaseClient
                .from('flokouts')
                .delete()
                .eq('flok_id', id);
            if (flokoutsError) {
                console.error('Error deleting flokouts:', flokoutsError);
                res.status(500).json({ error: 'Failed to delete flokouts' });
                return;
            }
            // 3. Delete flok-spot associations (preserves spots for reuse)
            const { error: flokSpotsError } = await database_1.supabaseClient
                .from('flok_spots')
                .delete()
                .eq('flok_id', id);
            if (flokSpotsError) {
                console.error('Error deleting flok-spot associations:', flokSpotsError);
                res.status(500).json({ error: 'Failed to delete spot associations' });
                return;
            }
            // 4. Delete invites
            const { error: invitesError } = await database_1.supabaseClient
                .from('flok_invites')
                .delete()
                .eq('flok_id', id);
            if (invitesError) {
                console.error('Error deleting invites:', invitesError);
                res.status(500).json({ error: 'Failed to delete invites' });
                return;
            }
            // 5. Delete flokmates (preserves user profiles)
            const { error: flokmatesError } = await database_1.supabaseClient
                .from('flokmates')
                .delete()
                .eq('flok_id', id);
            if (flokmatesError) {
                console.error('Error deleting flokmates:', flokmatesError);
                res.status(500).json({ error: 'Failed to delete members' });
                return;
            }
            // 6. Finally, delete the flok record
            const { error: flokDeleteError } = await database_1.supabaseClient
                .from('floks')
                .delete()
                .eq('id', id);
            if (flokDeleteError) {
                console.error('Error deleting flok:', flokDeleteError);
                res.status(500).json({ error: 'Failed to delete flok record' });
                return;
            }
            console.log(`✅ Flok purged successfully:`, cleanupResults);
            res.json({
                message: 'Flok permanently deleted successfully',
                cleaned: {
                    flokouts: cleanupResults.rsvps > 0 ? flokoutIds?.length || 0 : 0,
                    rsvps: cleanupResults.rsvps,
                    spots_associations: 'removed (spots preserved)',
                    members: 'removed (profiles preserved)',
                    invites: 'removed'
                }
            });
        }
        catch (error) {
            console.error('Purge flok error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}
exports.FloksController = FloksController;
//# sourceMappingURL=floksController.js.map