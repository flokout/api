import { Router } from 'express';
import { SpotsController } from '../controllers/spotsController';
import { authenticate } from '../middleware/auth';

/**
 * Spots Routes - Locations/Venues Management
 * 
 * All routes require authentication
 */

const router = Router();

// All routes require authentication
router.use(authenticate);

// Spot CRUD operations
router.get('/', SpotsController.getSpots);                    // Get spots (with optional flok filter)
router.post('/', SpotsController.createSpot);                 // Create new spot
router.get('/:id', SpotsController.getSpotById);              // Get spot details
router.put('/:id', SpotsController.updateSpot);               // Update spot
router.delete('/:id', SpotsController.deleteSpot);            // Delete spot

// Spot search and filtering
router.get('/search/:query', SpotsController.searchSpots);    // Search spots by name/address
router.get('/flok/:flokId', SpotsController.getSpotsByFlok);  // Get spots for specific flok

export default router; 