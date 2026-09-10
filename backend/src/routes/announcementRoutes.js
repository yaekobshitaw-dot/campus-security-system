const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const announcementController = require('../controllers/announcementController');

const router = express.Router();
router.use(authenticate);

router.get('/', announcementController.list);
router.get('/unread-count', announcementController.unreadCount);
router.get('/:id', announcementController.getById);
router.put('/:id/read', announcementController.markRead);
router.post('/', authorize('admin'), announcementController.create);
router.patch('/:id', authorize('admin'), announcementController.update);
router.delete('/:id', authorize('admin'), announcementController.remove);
router.post('/:id/publish', authorize('admin'), announcementController.publish);
router.post('/:id/unpublish', authorize('admin'), announcementController.unpublish);

module.exports = router;
