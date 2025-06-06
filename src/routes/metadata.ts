import { Router } from 'express';
import { MetadataController } from '../controllers/metadataController';
import { authenticate } from '../middleware/auth';

/**
 * Metadata Routes - Extensible metadata system
 * For expense categories, activity types, etc.
 */

const router = Router();

// Public routes
router.get('/types/:type', MetadataController.getMetadataByType);
router.get('/all', MetadataController.getAllMetadata);
router.get('/search', MetadataController.searchMetadata);

// Protected routes (require authentication)
router.post('/', authenticate, MetadataController.createMetadata);

export default router; 