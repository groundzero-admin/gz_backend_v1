import CourseContent from "../models/CourseContent.js";
import PromptLog from "../models/PromptLog.js";
import { sendResponse } from "../middleware/auth.js";

export const logPrompt = async (req, res) => {
  try {
    const { contentId, prompt, response, isBadPrompt = false, offset } = req.body;
    if (!contentId || !prompt || offset === undefined)
      return sendResponse(res, 400, false, "contentId, prompt, and offset required");

    const content = await CourseContent.findById(contentId);
    if (!content) return sendResponse(res, 404, false, "Invalid contentId");

    await PromptLog.create({
      studentId: req.authPayload.id,
      contentId,
      prompt,
      response,
      isBadPrompt,
      offset
    });

    sendResponse(res, 201, true, "Prompt logged successfully");
  } catch (err) {
    sendResponse(res, 500, false, err.message);
  }
};