"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const floksController_1 = require("../controllers/floksController");
const auth_1 = require("../middleware/auth");
/**
 * Floks Routes - Groups/Communities Management
 *
 * All routes require authentication
 */
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
// Flok CRUD operations
router.get('/', floksController_1.FloksController.getUserFloks); // Get user's floks
router.post('/', floksController_1.FloksController.createFlok); // Create new flok
router.get('/:id', floksController_1.FloksController.getFlokById); // Get flok details
router.put('/:id', floksController_1.FloksController.updateFlok); // Update flok
router.delete('/:id', floksController_1.FloksController.deleteFlok); // Delete flok (deactivate)
router.put('/:id/reactivate', floksController_1.FloksController.reactivateFlok); // Reactivate flok
router.delete('/:id/purge', floksController_1.FloksController.purgeFlok); // Permanently delete flok
// Flok membership operations
router.get('/:id/members', floksController_1.FloksController.getFlokMembers); // Get flok members
router.post('/:id/join', floksController_1.FloksController.joinFlok); // Join flok (with invite code)
router.post('/:id/leave', floksController_1.FloksController.leaveFlok); // Leave flok
router.delete('/:id/members/:userId', floksController_1.FloksController.removeMember); // Remove member (admin only)
router.put('/:id/members/:userId/role', floksController_1.FloksController.updateMemberRole); // Update member role (admin only)
// Flok spot associations
router.post('/:id/spots', floksController_1.FloksController.associateSpot);
router.delete('/:id/spots/:spotId', floksController_1.FloksController.disassociateSpot);
// Flok invites
router.post('/verify-invite', floksController_1.FloksController.verifyInvite); // Verify invite code (get flok details)
router.post('/deactivate-invite', floksController_1.FloksController.deactivateInvite); // Deactivate invite code
router.post('/:id/invites', floksController_1.FloksController.createInvite); // Create invite code
router.get('/:id/invites', floksController_1.FloksController.getFlokInvites); // Get active invites
router.delete('/invites/:inviteId', floksController_1.FloksController.deleteInvite); // Delete invite
exports.default = router;
//# sourceMappingURL=floks.js.map