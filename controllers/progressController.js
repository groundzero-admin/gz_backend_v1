import CourseContent from "../models/CourseContent.js";
import ContentCompletion from "../models/ContentCompletion.js";
import { sendResponse } from "../middleware/auth.js";

export const updateProgress = async (req, res) => {
  try {
    const { contentId, fullyDone, partiallyDone, submittedCode, keepNotes } = req.body;
    if (!contentId) return sendResponse(res, 400, false, "contentId required");
    
    const content = await CourseContent.findById(contentId);
    if (!content) return sendResponse(res, 404, false, "Invalid contentId");

    const update = {
      fullyDone: !!fullyDone,
      partiallyDone: !!partiallyDone,
      submittedCode: submittedCode || "",
      keepNotes: keepNotes || "",
      updatedAt: new Date()
    };

    await ContentCompletion.findOneAndUpdate(
      { studentId: req.authPayload.id, contentId },
      update,
      { upsert: true, new: true }
    );

    sendResponse(res, 200, true, "Progress updated");
  } catch (err) {
    sendResponse(res, 500, false, err.message);
  }
};