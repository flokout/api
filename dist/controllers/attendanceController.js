"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceController = void 0;
const database_1 = require("../config/database");
/**
 * Attendance Controller - Track who actually attended flokouts
 */
class AttendanceController {
    /**
     * Mark user as attended for a flokout
     */
    static async markAttendance(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { flokoutId } = req.params;
            const { user_id, attended = true } = req.body;
            // Get flokout to check permissions
            const { data: flokout, error: flokoutError } = await database_1.supabaseClient
                .from('flokouts')
                .select('flok_id, status, title')
                .eq('id', flokoutId)
                .single();
            if (flokoutError) {
                res.status(404).json({ error: 'Flokout not found' });
                return;
            }
            // Check if user is admin of the flok (only admins can mark attendance for others)
            const targetUserId = user_id || req.user.id;
            const isMarkingForOthers = targetUserId !== req.user.id;
            if (isMarkingForOthers) {
                const { data: membership } = await database_1.supabaseClient
                    .from('flokmates')
                    .select('role')
                    .eq('flok_id', flokout.flok_id)
                    .eq('user_id', req.user.id)
                    .single();
                if (!membership || membership.role !== 'admin') {
                    res.status(403).json({ error: 'Only flok admins can mark attendance for others' });
                    return;
                }
            }
            else {
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
            }
            // Check if attendance record exists
            const { data: existingAttendance } = await database_1.supabaseClient
                .from('attendances')
                .select('id, attended')
                .eq('flokout_id', flokoutId)
                .eq('user_id', targetUserId)
                .single();
            let attendance;
            if (existingAttendance) {
                // Update existing attendance
                const { data: updatedAttendance, error: updateError } = await database_1.supabaseClient
                    .from('attendances')
                    .update({
                    attended,
                    attended_at: attended ? new Date().toISOString() : null,
                    confirmed_by: isMarkingForOthers ? req.user.id : null,
                    updated_at: new Date().toISOString()
                })
                    .eq('id', existingAttendance.id)
                    .select()
                    .single();
                if (updateError) {
                    res.status(400).json({ error: updateError.message });
                    return;
                }
                attendance = updatedAttendance;
            }
            else {
                // Create new attendance record
                const { data: newAttendance, error: createError } = await database_1.supabaseClient
                    .from('attendances')
                    .insert({
                    flokout_id: flokoutId,
                    user_id: targetUserId,
                    attended,
                    attended_at: attended ? new Date().toISOString() : null,
                    confirmed_by: isMarkingForOthers ? req.user.id : null,
                    rsvp_status: null // Can be set separately via RSVP APIs
                })
                    .select()
                    .single();
                if (createError) {
                    res.status(400).json({ error: createError.message });
                    return;
                }
                attendance = newAttendance;
            }
            res.json({
                message: `Attendance ${attended ? 'marked' : 'unmarked'} successfully`,
                attendance,
                flokout_info: {
                    id: flokoutId,
                    title: flokout.title,
                    status: flokout.status
                }
            });
        }
        catch (error) {
            console.error('Mark attendance error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Get attendance for a flokout
     */
    static async getFlokoutAttendance(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { flokoutId } = req.params;
            // Get flokout to check permissions
            const { data: flokout, error: flokoutError } = await database_1.supabaseClient
                .from('flokouts')
                .select('flok_id, title, status')
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
            const { data: attendances, error: attendanceError } = await database_1.supabaseClient
                .from('attendances')
                .select(`
          id,
          user_id,
          attended,
          attended_at,
          confirmed_by,
          rsvp_status,
          created_at,
          updated_at,
          user_profile:profiles!attendances_user_id_fkey(
            id,
            email,
            full_name,
            avatar_url
          ),
          confirmed_by_profile:profiles!attendances_confirmed_by_fkey(
            id,
            full_name
          )
        `)
                .eq('flokout_id', flokoutId)
                .order('attended_at', { ascending: false, nullsFirst: false });
            if (attendanceError) {
                res.status(500).json({ error: 'Failed to fetch attendance', details: attendanceError.message });
                return;
            }
            // Group attendance data
            const attended = attendances?.filter(a => a.attended) || [];
            const notAttended = attendances?.filter(a => !a.attended) || [];
            const noRecord = []; // We'll need to get flok members who have no attendance record
            // Get all flok members to identify who has no attendance record
            const { data: allMembers } = await database_1.supabaseClient
                .from('flokmates')
                .select(`
          user_id,
          user_profile:profiles!flokmates_user_id_fkey(
            id,
            email,
            full_name,
            avatar_url
          )
        `)
                .eq('flok_id', flokout.flok_id);
            const attendanceUserIds = attendances?.map(a => a.user_id) || [];
            const membersWithoutRecord = allMembers?.filter(m => !attendanceUserIds.includes(m.user_id)) || [];
            res.json({
                message: 'Attendance fetched successfully',
                attendance: {
                    attended,
                    not_attended: notAttended,
                    no_record: membersWithoutRecord,
                    counts: {
                        attended: attended.length,
                        not_attended: notAttended.length,
                        no_record: membersWithoutRecord.length,
                        total_members: allMembers?.length || 0
                    }
                },
                flokout_info: {
                    id: flokoutId,
                    title: flokout.title,
                    status: flokout.status,
                    flok_id: flokout.flok_id
                }
            });
        }
        catch (error) {
            console.error('Get flokout attendance error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Get user's attendance history
     */
    static async getUserAttendance(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { attended, limit = 50, offset = 0 } = req.query;
            let query = database_1.supabaseClient
                .from('attendances')
                .select(`
          id,
          attended,
          attended_at,
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
                .order('attended_at', { ascending: false, nullsFirst: false })
                .range(Number(offset), Number(offset) + Number(limit) - 1);
            if (attended !== undefined) {
                query = query.eq('attended', attended === 'true');
            }
            const { data: attendances, error: attendanceError } = await query;
            if (attendanceError) {
                res.status(500).json({ error: 'Failed to fetch user attendance' });
                return;
            }
            res.json({
                attendances,
                counts: {
                    total: attendances?.length || 0,
                    attended: attendances?.filter(a => a.attended).length || 0,
                    not_attended: attendances?.filter(a => !a.attended).length || 0
                }
            });
        }
        catch (error) {
            console.error('Get user attendance error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Bulk mark attendance for a flokout (admin only)
     */
    static async bulkMarkAttendance(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { flokoutId } = req.params;
            const { attendees } = req.body; // Array of { user_id, attended }
            if (!Array.isArray(attendees)) {
                res.status(400).json({ error: 'Attendees must be an array of { user_id, attended }' });
                return;
            }
            // Get flokout to check permissions
            const { data: flokout, error: flokoutError } = await database_1.supabaseClient
                .from('flokouts')
                .select('flok_id, title')
                .eq('id', flokoutId)
                .single();
            if (flokoutError) {
                res.status(404).json({ error: 'Flokout not found' });
                return;
            }
            // Check if user is admin of the flok
            const { data: membership } = await database_1.supabaseClient
                .from('flokmates')
                .select('role')
                .eq('flok_id', flokout.flok_id)
                .eq('user_id', req.user.id)
                .single();
            if (!membership || membership.role !== 'admin') {
                res.status(403).json({ error: 'Only flok admins can bulk mark attendance' });
                return;
            }
            const results = [];
            const errors = [];
            for (const attendee of attendees) {
                try {
                    // Check if attendance record exists
                    const { data: existingAttendance } = await database_1.supabaseClient
                        .from('attendances')
                        .select('id')
                        .eq('flokout_id', flokoutId)
                        .eq('user_id', attendee.user_id)
                        .single();
                    if (existingAttendance) {
                        // Update existing
                        const { data: updated, error: updateError } = await database_1.supabaseClient
                            .from('attendances')
                            .update({
                            attended: attendee.attended,
                            attended_at: attendee.attended ? new Date().toISOString() : null,
                            confirmed_by: req.user.id,
                            updated_at: new Date().toISOString()
                        })
                            .eq('id', existingAttendance.id)
                            .select()
                            .single();
                        if (updateError)
                            throw updateError;
                        results.push(updated);
                    }
                    else {
                        // Create new
                        const { data: created, error: createError } = await database_1.supabaseClient
                            .from('attendances')
                            .insert({
                            flokout_id: flokoutId,
                            user_id: attendee.user_id,
                            attended: attendee.attended,
                            attended_at: attendee.attended ? new Date().toISOString() : null,
                            confirmed_by: req.user.id
                        })
                            .select()
                            .single();
                        if (createError)
                            throw createError;
                        results.push(created);
                    }
                }
                catch (error) {
                    errors.push({
                        user_id: attendee.user_id,
                        error: error.message
                    });
                }
            }
            res.json({
                message: 'Bulk attendance update completed',
                results,
                errors,
                summary: {
                    processed: results.length,
                    failed: errors.length,
                    total: attendees.length
                }
            });
        }
        catch (error) {
            console.error('Bulk mark attendance error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}
exports.AttendanceController = AttendanceController;
//# sourceMappingURL=attendanceController.js.map