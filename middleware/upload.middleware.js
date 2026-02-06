const multer = require('multer');
const path = require('path');

// Configure storage for different file types
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let uploadPath = 'public/uploads/';

        switch (file.fieldname) {
            case 'product_images':
                uploadPath += 'products/';
                break;
            case 'store_logo':
            case 'store_banner':
                uploadPath += 'stores/';
                break;
            case 'profile_picture':
                uploadPath += 'users/';
                break;
            case 'delivery_proof':
                uploadPath += 'delivery-proof/';
                break;
            default:
                uploadPath += 'others/';
        }

        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueName + ext);
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'));
    }
};

// Create upload instances
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: fileFilter
});

// Export specific upload middlewares
exports.uploadProductImages = upload.array('product_images', 5);
exports.uploadStoreLogo = upload.single('store_logo');
exports.uploadStoreBanner = upload.single('store_banner');
exports.uploadProfilePicture = upload.single('profile_picture');
exports.uploadDeliveryProof = upload.single('delivery_proof');

// Handle upload errors
exports.handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File size too large. Maximum is 5MB.' });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ error: 'Too many files. Maximum is 5.' });
        }
    } else if (err) {
        return res.status(400).json({ error: err.message });
    }
    next();
};
