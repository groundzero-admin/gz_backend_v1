// midle ware ghelp us ot upload file in clidinary 


import multer from 'multer';

// Use memoryStorage to hold the file buffer before uploading to Cloudinary
// This avoids saving the file to your server's disk
const storage = multer.memoryStorage();

// We will only accept one file, with the field name "worksheetFile"
const upload = multer({ storage: storage });

export default upload;