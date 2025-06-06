"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const flokoutsController_1 = require("../controllers/flokoutsController");
const auth_1 = require("../middleware/auth");
/**
 * Flokouts Routes - Events Management
 *
 * All routes require authentication
 */
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
// Flokout CRUD operations
router.get('/', flokoutsController_1.FlokoutsController.getFlokouts); // Get flokouts (with filters)
router.post('/', flokoutsController_1.FlokoutsController.createFlokout); // Create new flokout
router.get('/:id', flokoutsController_1.FlokoutsController.getFlokoutById); // Get flokout details
router.put('/:id', flokoutsController_1.FlokoutsController.updateFlokout); // Update flokout
router.delete('/:id', flokoutsController_1.FlokoutsController.deleteFlokout); // Delete flokout
// Flokout status management
router.put('/:id/status', flokoutsController_1.FlokoutsController.updateFlokoutStatus); // Update flokout status
router.post('/:id/confirm', flokoutsController_1.FlokoutsController.confirmFlokout); // Confirm flokout
// Flokout filtering
router.get('/flok/:flokId', flokoutsController_1.FlokoutsController.getFlokoutsByFlok); // Get flokouts for specific flok
router.get('/user/created', flokoutsController_1.FlokoutsController.getUserCreatedFlokouts); // Get user's created flokouts
router.get('/user/attending', flokoutsController_1.FlokoutsController.getUserAttendingFlokouts); // Get flokouts user is attending
exports.default = router;
//# sourceMappingURL=flokouts.js.map