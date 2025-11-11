import { sendResponse } from '../middleware/auth.js';
import Worksheet from '../models/WorkSheet.js'; // Your new worksheet model
import Course from '../models/Course.js';
import cloudinary from '../config/cloudinary.js';
import MarkAsRead from '../models/markAsRead.js';




/**
 * Helper function to upload a file buffer to Cloudinary
 * This is wrapped in a Promise to work with async/await
 */
const uploadToCloudinary = (fileBuffer, options) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve(result);
      }
    );
    // Pipe the file buffer into the upload stream
    uploadStream.end(fileBuffer);
  });
};


/**
 * POST /api/admin/uploadworksheet
 * Admin-only.
 * Uploads a worksheet file and creates a DB entry.
 */
export const uploadWorksheet = async (req, res) => {
  try {
    const { courseId, title, description, worksheetNumber } = req.body;

    // 1. Validate all inputs
    if (!req.file) {
      return sendResponse(res, 400, false, "No worksheet file provided.");
    }
    if (!courseId || !title || !description || worksheetNumber === undefined) {
      return sendResponse(res, 400, false, "Missing required fields: courseId, title, description, or worksheetNumber.");
    }

    // 2. Check if the Course ID is valid
    const course = await Course.findById(courseId);
    if (!course) {
      return sendResponse(res, 404, false, "Course not found.");
    }

    // 3. Upload the file to Cloudinary
    // We use "resource_type: 'auto'" to allow .docx, .pdf, etc.
    const uploadOptions = {
      folder: `worksheets/${courseId}`, // Organize files in Cloudinary
      resource_type: 'auto'
    };
    
    const uploadResult = await uploadToCloudinary(req.file.buffer, uploadOptions);

    // 4. Create the new Worksheet document in MongoDB
    const newWorksheet = new Worksheet({
      courseId: courseId,
      title: title,
      description: description,
      worksheetNumber: Number(worksheetNumber),
      link: uploadResult.secure_url, // The URL from Cloudinary
    });

    await newWorksheet.save();

    // 5. Send the successful response
    return sendResponse(res, 201, true, "Worksheet uploaded successfully.", {
      worksheetId: newWorksheet._id,
      courseId: newWorksheet.courseId,
      title: newWorksheet.title,
      description: newWorksheet.description,
      worksheetNumber: newWorksheet.worksheetNumber,
      link: newWorksheet.link,
    });

  } catch (err) {
    console.error("uploadWorksheet err", err);
    if (err.message.includes('File size')) {
      return sendResponse(res, 400, false, "File is too large.");
    }
    return sendResponse(res, 500, false, "Server error uploading worksheet.");
  }
};

















///////////// for studnets 
export const listWorksheetsFromCCourseForStudent = async (req, res) => {
  try {
    const studentId = req.authPayload.id;
    const { courseId } = req.query;

    if (!courseId) {
      return sendResponse(res, 400, false, "courseId is required in the query.");
    }

    // 1. Get all worksheets for the course
    const worksheets = await Worksheet.find({ courseId: courseId })
      .sort({ worksheetNumber: 1 })
      .select("title description worksheetNumber link")
      .lean();

    // 2. Get all 'read' entries for this student
    const readEntries = await MarkAsRead.find({ studentId: studentId }).lean();

    // 3. --- MODIFIED LOGIC ---
    // Create a Map to store the read status (true/false) for each worksheet
    const readStatusMap = new Map();
    for (const entry of readEntries) {
      readStatusMap.set(entry.worksheetId.toString(), entry.value);
    }
    // --- END OF MODIFICATION ---

    // 4. Combine the data
    const finalWorksheetList = worksheets.map(ws => {
      // --- MODIFIED LOGIC ---
      // Get the status from the Map.
      // If it's not in the map (undefined), it's unread, so default to 'false'.
      // If it is in the map, use its 'value' (which could be true or false).
      const isRead = readStatusMap.get(ws._id.toString()) || false;
      // --- END OF MODIFICATION ---
      
      return {
        worksheetId: ws._id,
        title: ws.title,
        description: ws.description,
        worksheetNumber: ws.worksheetNumber,
        link: ws.link,
        isRead: isRead,
      };
    });

    return sendResponse(res, 200, true, "Worksheets retrieved successfully.", finalWorksheetList);

  } catch (err) {
    console.error("listWorksheetsForCourse err", err);
    return sendResponse(res, 500, false, "Server error retrieving worksheets.");
  }
};












////////////////////    for admin only 
export const getWorksheetsFromCCourseForAdmin = async (req, res) => {
  try {
    const { courseId } = req.query;

    if (!courseId) {
      return sendResponse(res, 400, false, "courseId is required in the query.");
    }

    // 1. Find all worksheets for the course
    const worksheets = await Worksheet.find({ courseId: courseId })
      .sort({ worksheetNumber: 1 }) // Sort them by number
      .select("title description worksheetNumber link") // Select only these fields
      .lean();

    // 2. Format the response to be consistent
    const formattedWorksheets = worksheets.map(ws => ({
      worksheetId: ws._id,
      title: ws.title,
      description: ws.description,
      worksheetNumber: ws.worksheetNumber,
      link: ws.link
    }));
      
    return sendResponse(res, 200, true, "Worksheets retrieved successfully.", formattedWorksheets);

  } catch (err) {
    console.error("getWorksheetsForCourse err", err);
    return sendResponse(res, 500, false, "Server error retrieving worksheets.");
  }
};