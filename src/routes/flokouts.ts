import { Router } from 'express';
import { FlokoutsController } from '../controllers/flokoutsController';
import { authenticate } from '../middleware/auth';

/**
 * Flokouts Routes - Events Management
 * 
 * All routes require authentication
 */

const router = Router();

// All routes require authentication
router.use(authenticate);

// Flokout CRUD operations
router.get('/', FlokoutsController.getFlokouts);                     // Get flokouts (with filters)
router.post('/', FlokoutsController.createFlokout);                  // Create new flokout
router.get('/:id', FlokoutsController.getFlokoutById);               // Get flokout details
router.put('/:id', FlokoutsController.updateFlokout);                // Update flokout
router.delete('/:id', FlokoutsController.deleteFlokout);             // Delete flokout

// Flokout status management
router.put('/:id/status', FlokoutsController.updateFlokoutStatus);   // Update flokout status
router.post('/:id/confirm', FlokoutsController.confirmFlokout);      // Confirm flokout

// Flokout filtering
router.get('/flok/:flokId', FlokoutsController.getFlokoutsByFlok);   // Get flokouts for specific flok
router.get('/user/created', FlokoutsController.getUserCreatedFlokouts); // Get user's created flokouts
router.get('/user/attending', FlokoutsController.getUserAttendingFlokouts); // Get flokouts user is attending

// Utility routes
router.post('/utils/create-missing-attendance', FlokoutsController.createMissingAttendanceRecords); // Create missing attendance records

export default router; 