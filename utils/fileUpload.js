const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const uploadDirs = [
    './public/uploads/products',
    './public/uploads/stores',
    './public/uploads/users',
    './public/uploads/delivery-proof',
    './public/uploads/kyc'
];

uploadDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Configure storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let uploadPath = './public/uploads/';

        if (file.fieldname === 'product_images') {
            uploadPath += 'products/';
        } else if (file.fieldname === 'store_logo' || file.fieldname === 'store_banner') {
            uploadPath += 'stores/';
        } else if (file.fieldname === 'profile_picture') {
            uploadPath += 'users/';
        } else if (file.fieldname === 'delivery_proof') {
            uploadPath += 'delivery-proof/';
        } else if (file.fieldname === 'kyc_document') {
            uploadPath += 'kyc/';
        } else {
            uploadPath += 'others/';
        }

        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Error: File type not allowed!'));
    }
};

// Configure multer
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: fileFilter
});

// Specific upload configurations
const uploadProductImages = upload.array('product_images', 5); // Max 5 images
const uploadStoreLogo = upload.single('store_logo');
const uploadStoreBanner = upload.single('store_banner');
const uploadProfilePicture = upload.single('profile_picture');
const uploadDeliveryProof = upload.single('delivery_proof');
const uploadKYCDocument = upload.single('kyc_document');

// Delete file utility
function deleteFile(filePath) {
    const fullPath = path.join(__dirname, '..', filePath);

    if (fs.existsSync(fullPath)) {
        fs.unlink(fullPath, (err) => {
            if (err) console.error('Error deleting file:', err);
        });
        return true;
    }
    return false;
}

// Get file URL
function getFileUrl(filePath) {
    if (!filePath) return null;

    // Remove 'public/' from path for URL
    return filePath.replace('public/', '');
}

module.exports = {
    upload,
    uploadProductImages,
    uploadStoreLogo,
    uploadStoreBanner,
    uploadProfilePicture,
    uploadDeliveryProof,
    uploadKYCDocument,
    deleteFile,
    getFileUrl
};
