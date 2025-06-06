"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const spotsController_1 = require("../controllers/spotsController");
const auth_1 = require("../middleware/auth");
/**
 * Spots Routes - Locations/Venues Management
 *
 * All routes require authentication
 */
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
// Spot CRUD operations
router.get('/', spotsController_1.SpotsController.getSpots); // Get spots (with optional flok filter)
router.post('/', spotsController_1.SpotsController.createSpot); // Create new spot
router.get('/:id', spotsController_1.SpotsController.getSpotById); // Get spot details
router.put('/:id', spotsController_1.SpotsController.updateSpot); // Update spot
router.delete('/:id', spotsController_1.SpotsController.deleteSpot); // Delete spot
// Spot search and filtering
router.get('/search/:query', spotsController_1.SpotsController.searchSpots); // Search spots by name/address
router.get('/flok/:flokId', spotsController_1.SpotsController.getSpotsByFlok); // Get spots for specific flok
exports.default = router;
//# sourceMappingURL=spots.js.map