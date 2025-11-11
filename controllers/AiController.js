


import { sendResponse } from "../middleware/auth.js";
import PromptHistory from '../models/promtHistory.js'; // <-- 1. IMPORT PROMPTHISTORY





///////////////////////////////////////////////////////   student asking its old chat 
export const getMyOldChats = async (req, res) => {
  try {
    // 1. Get studentId from token
    const studentId = req.authPayload.id;

    // 2. Get worksheetId from the URL query
    const { worksheetId } = req.query;
    if (!worksheetId) {
      return sendResponse(res, 400, false, "worksheetId is required in the query.");
    }

    // 3. Find all chats matching studentId and worksheetId
    const chats = await PromptHistory.find({
      studentId: studentId,
      worksheetId: worksheetId
    })
    .sort({ createdAt: 1 }) // 1 = ascending (oldest first)
    .select("prompt response isBadPrompt createdAt"); // Select only these fields

    // 4. Return the array of chats
    return sendResponse(res, 200, true, "Chat history retrieved.", chats);

  } catch (err) {
    console.error("getMyOldChats err", err);
    return sendResponse(res, 500, false, "Server error retrieving chat history.");
  }
};









////////////////////////////////////////////////////////////////////     only teacher admin aprent can access it , no student can acces it 
export const getStudentChatHistory = async (req, res) => {
  try {
    // 1. Get studentId from the URL query
    const { studentId } = req.query;
    if (!studentId) {
      return sendResponse(res, 400, false, "studentId is required in the query.");
    }

    // 2. (Optional but good) Check if student exists
    const student = await Student.findById(studentId);
    if (!student) {
      return sendResponse(res, 404, false, "Student not found.");
    }

    // 3. Find all chats matching studentId
    const chats = await PromptHistory.find({
      studentId: studentId
    })
    .sort({ createdAt: 1 }) // 1 = ascending (oldest first)
    .select("prompt response isBadPrompt createdAt worksheetId"); // Added worksheetId

    // 4. Return the array of chats
    return sendResponse(res, 200, true, "Chat history retrieved.", chats);

  } catch (err) {
    console.error("getStudentChatHistory err", err);
    return sendResponse(res, 500, false, "Server error retrieving chat history.");
  }
};