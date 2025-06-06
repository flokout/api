import { Router } from 'express';
import { RSVPsController } from '../controllers/rsvpsController';
import { authenticate } from '../middleware/auth';

/**
 * RSVPs Routes - Attendance Management for Flokouts
 * 
 * All routes require authentication
 */

const router = Router();

// All routes require authentication
router.use(authenticate);

// RSVP operations
router.post('/flokout/:flokoutId', RSVPsController.createOrUpdateRSVP);    // RSVP to flokout
router.get('/flokout/:flokoutId', RSVPsController.getFlokoutRSVPs);       // Get all RSVPs for flokout
router.delete('/flokout/:flokoutId', RSVPsController.removeRSVP);         // Remove RSVP
router.get('/user/rsvps', RSVPsController.getUserRSVPs);                  // Get user's RSVPs
router.get('/user/rsvp/:flokoutId', RSVPsController.getUserRSVPForFlokout); // Get user's RSVP for specific flokout

export default router; 