import { Router } from 'express';
import { FloksController } from '../controllers/floksController';
import { authenticate } from '../middleware/auth';

/**
 * Floks Routes - Groups/Communities Management
 * 
 * All routes require authentication
 */

const router = Router();

// All routes require authentication
router.use(authenticate);

// Flok CRUD operations
router.get('/', FloksController.getUserFloks);           // Get user's floks
router.post('/', FloksController.createFlok);            // Create new flok
router.get('/:id', FloksController.getFlokById);         // Get flok details
router.put('/:id', FloksController.updateFlok);          // Update flok
router.delete('/:id', FloksController.deleteFlok);       // Delete flok (deactivate)
router.put('/:id/reactivate', FloksController.reactivateFlok); // Reactivate flok
router.delete('/:id/purge', FloksController.purgeFlok);  // Permanently delete flok

// Flok membership operations
router.get('/:id/members', FloksController.getFlokMembers);     // Get flok members
router.post('/:id/join', FloksController.joinFlok);             // Join flok (with invite code)
router.post('/:id/leave', FloksController.leaveFlok);           // Leave flok
router.delete('/:id/members/:userId', FloksController.removeMember); // Remove member (admin only)
router.put('/:id/members/:userId/role', FloksController.updateMemberRole); // Update member role (admin only)

// Flok spot associations
router.post('/:id/spots', FloksController.associateSpot);
router.delete('/:id/spots/:spotId', FloksController.disassociateSpot);

// Flok invites
router.post('/verify-invite', FloksController.verifyInvite);           // Verify invite code (get flok details)
router.post('/deactivate-invite', FloksController.deactivateInvite);   // Deactivate invite code
router.post('/:id/invites', FloksController.createInvite);      // Create invite code
router.get('/:id/invites', FloksController.getFlokInvites);     // Get active invites
router.delete('/invites/:inviteId', FloksController.deleteInvite); // Delete invite

export default router; 