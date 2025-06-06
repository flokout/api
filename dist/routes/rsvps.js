"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const rsvpsController_1 = require("../controllers/rsvpsController");
const auth_1 = require("../middleware/auth");
/**
 * RSVPs Routes - Attendance Management for Flokouts
 *
 * All routes require authentication
 */
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
// RSVP operations
router.post('/flokout/:flokoutId', rsvpsController_1.RSVPsController.createOrUpdateRSVP); // RSVP to flokout
router.get('/flokout/:flokoutId', rsvpsController_1.RSVPsController.getFlokoutRSVPs); // Get all RSVPs for flokout
router.delete('/flokout/:flokoutId', rsvpsController_1.RSVPsController.removeRSVP); // Remove RSVP
router.get('/user/rsvps', rsvpsController_1.RSVPsController.getUserRSVPs); // Get user's RSVPs
router.get('/user/rsvp/:flokoutId', rsvpsController_1.RSVPsController.getUserRSVPForFlokout); // Get user's RSVP for specific flokout
exports.default = router;
//# sourceMappingURL=rsvps.js.map