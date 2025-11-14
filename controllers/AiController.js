import OpenAI from "openai";
import dns from "dns";
import { sendResponse } from "../middleware/auth.js";
import ChatThread from "../models/ChatThread.js";
import PromptHistory from '../models/PromptHistory.js';
import Student from "../models/Student.js";
import StudentParentRelation from "../models/StudentParentRelation.js";

// --- OpenAI Client Setup ---
const client = new OpenAI({
  apiKey: process.env.API_KEY,
});

const ASK_Q_ASSISTANT_ID = process.env.ASK_Q_ASSISTANT_ID;
const BAD_PROMPT_ASSISTANT_ID = process.env.BAD_PROMPT_ASSISTANT_ID;
const BAD_PROMPT_CHAT_THREAD_ID = process.env.BAD_PROMPT_CHAT_THREAD_ID;

dns.setDefaultResultOrder("ipv4first");

// --- Helper Functions ---

/**
 * ✅ Helper 1: Initialize a new, *generic* OpenAI thread.
 */
async function initializeGenericThread() {
  try {
    console.log("🚀 Creating new generic thread...");
    const thread = await client.beta.threads.create({
      messages: [{
        role: "user",
        content: "I will ask you questions. Please explain things to me in simple terms.",
      }],
    });
    console.log(`✅ New thread created with ID: ${thread.id}`);
    return thread.id;
  } catch (err) {
    console.error("❌ Error initializing generic thread:", err.message);
    throw err;
  }
}

/**
 * ✅ Helper 2: Send a user question to an existing thread.
 */
async function sendPromptToExistingThread(threadId, promptContent) {
  console.log(`\n--- 📩 Sending prompt to Thread ID: ${threadId} ---`);
  try {
    await client.beta.threads.messages.create(threadId, {
      role: "user",
      content: promptContent,
    });
    const run = await client.beta.threads.runs.createAndPoll(threadId, {
      assistant_id: ASK_Q_ASSISTANT_ID,
    });
    if (run.status !== "completed") return null;
    const messages = await client.beta.threads.messages.list(threadId, { order: "desc" });
    const latestAssistantMessage = messages.data.find((m) => m.role === "assistant");
    const answer = latestAssistantMessage?.content[0]?.text?.value || "";
    console.log("✅ Assistant Response:", answer);
    return answer;
  } catch (err) {
    console.error("❌ Error during sendPromptToExistingThread:", err.message);
    throw err;
  }
}

/**
 * ✅ Helper 3: Analyzes text using the "Bad Prompt" assistant.
 */
async function analyzeTextWithBadPromptAssistant(textToAnalyze) {
  try {
    console.log("📨 Sending text to Bad Prompt Assistant...");
    await client.beta.threads.messages.create(BAD_PROMPT_CHAT_THREAD_ID, {
      role: "user",
      content: textToAnalyze,
    });
    const run = await client.beta.threads.runs.createAndPoll(BAD_PROMPT_CHAT_THREAD_ID, {
      assistant_id: BAD_PROMPT_ASSISTANT_ID,
    });
    if (run.status !== "completed") return null;
    const messages = await client.beta.threads.messages.list(BAD_PROMPT_CHAT_THREAD_ID, { order: "desc", limit: 1 });
    const assistantMessage = messages.data.find((m) => m.role === "assistant");
    const resultText = assistantMessage?.content[0]?.text?.value?.trim();
    console.log("✅ Assistant Response:", resultText);
    return resultText;
  } catch (err) {
    console.error("❌ Error analyzing text:", err);
    throw err;
  }
}

// --- API Controllers ---

/**
 * API 1: Setup Chat Thread (Student Only)
 * POST /api/student/setupchatthread
 */
export const setupChatThread = async (req, res) => {
  try {
    const studentId = req.authPayload.id;
    const existingThread = await ChatThread.findOne({ studentId: studentId });

    if (existingThread) {
      console.log(`[Chat] Found existing thread: ${existingThread.thread_id}`);
      return sendResponse(res, 200, true, "Existing thread found.", {
        thread_id: existingThread.thread_id,
      });
    }

    const newThreadId = await initializeGenericThread();
    const newChatThread = new ChatThread({
      studentId: studentId,
      thread_id: newThreadId,
    });
    await newChatThread.save();

    return sendResponse(res, 201, true, "New chat thread created.", {
      thread_id: newThreadId,
    });

  } catch (err) {
    console.error("setupChatThread err", err);
    if (err.code === 11000) {
      return sendResponse(res, 409, false, "A thread for this student already exists.");
    }
    return sendResponse(res, 500, false, "Server error setting up chat.");
  }
};

/**
 * API 2: Ask Question (Student Only)
 * POST /api/student/askq
 */
export const askQ = async (req, res) => {
  try {
    const studentId = req.authPayload.id;
    const { threadId, promptText } = req.body;

    if (!threadId || !promptText) {
      return sendResponse(res, 400, false, "threadId and promptText are required.");
    }

    let isBad = false;
    try {
      const analysisJson = await analyzeTextWithBadPromptAssistant(promptText);
      const analysisResult = JSON.parse(analysisJson);
      isBad = analysisResult.isbad;
    } catch (err) {
      console.error("Bad prompt analysis failed:", err);
      isBad = true; // Failsafe
    }

    if (isBad) {
      console.log("[Chat] Bad prompt detected. Saving to history.");
      await PromptHistory.create({
        studentId: studentId,
        prompt: promptText,
        response: "",
        isBadPrompt: true,
      });
      return sendResponse(res, 200, true, "Prompt moderated.", { answer: "" });
    }

    let finalAnswer = "";
    const responseJson = await sendPromptToExistingThread(threadId, promptText);

    if (responseJson) {
      try {
        const responseResult = JSON.parse(responseJson);
        finalAnswer = responseResult.answer || "";
      } catch (err) {
        console.error("Could not parse main assistant response:", err);
        finalAnswer = "I'm sorry, I couldn't generate a valid response.";
      }
    } else {
      finalAnswer = "I'm sorry, I couldn't find an answer.";
    }

    await PromptHistory.create({
      studentId: studentId,
      prompt: promptText,
      response: finalAnswer,
      isBadPrompt: false,
    });

    return sendResponse(res, 200, true, "Answer retrieved.", { answer: finalAnswer });

  } catch (err) {
    console.error("askQ err", err);
    return sendResponse(res, 500, false, "Server error processing question.");
  }
};

/**
 * API 3: Load All Chats for Student (Student Only)
 * GET /api/student/loadmychat
 */
export const loadMyChat = async (req, res) => {
  try {
    const studentId = req.authPayload.id;
    const chats = await PromptHistory.find({ studentId: studentId })
      .sort({ createdAt: -1 }) // newest first
      .select("prompt response isBadPrompt createdAt");

    return sendResponse(res, 200, true, "Chat history retrieved.", chats);
  } catch (err) {
    console.error("loadMyChat err", err);
    return sendResponse(res, 500, false, "Server error retrieving chat history.");
  }
};

/**
 * API 4: Get all prompt history for a student (Admin/Teacher/Parent)
 * GET /api/studenthistory
 */
export const getStudentFullHistory = async (req, res) => {
  try {
    const { studentId } = req.query;
    if (!studentId) {
      return sendResponse(res, 400, false, "studentId is required in the query.");
    }
    
    const student = await Student.findById(studentId);
    if (!student) {
      return sendResponse(res, 404, false, "Student not found.");
    }

    const chats = await PromptHistory.find({ studentId: studentId })
      .sort({ createdAt: 1 }) // oldest first
      .select("prompt response isBadPrompt createdAt");

    return sendResponse(res, 200, true, "Student history retrieved.", chats);
  } catch (err) {
    console.error("getStudentFullHistory err", err);
    return sendResponse(res, 500, false, "Server error retrieving history.");
  }
};

/**
 * API 5: Get a specific child's full prompt history (Parent Only)
 * GET /api/parent/mychildhistory
 */
export const getMyChildHistory = async (req, res) => {
  try {
    const parentEmail = req.authPayload.email;
    const { childEmail } = req.query;
    if (!childEmail) {
      return sendResponse(res, 400, false, "childEmail is required in the query.");
    }
    const childEmailClean = String(childEmail).toLowerCase().trim();

    const link = await StudentParentRelation.findOne({
      parentEmail: parentEmail,
      studentEmail: childEmailClean
    });
    if (!link) {
      return sendResponse(res, 403, false, "Access denied. You are not linked to this child.");
    }

    const student = await Student.findOne({ email: childEmailClean }).select("_id");
    if (!student) {
      return sendResponse(res, 404, false, "The specified child account does not exist.");
    }

    const history = await PromptHistory.find({ studentId: student._id })
      .sort({ createdAt: 1 }) // oldest first
      .select("prompt response isBadPrompt createdAt");

    return sendResponse(res, 200, true, "Child's history retrieved.", history);
  } catch (err) {
    console.error("getChildHistory err", err);
    return sendResponse(res, 500, false, "Server error retrieving history.");
  }
};