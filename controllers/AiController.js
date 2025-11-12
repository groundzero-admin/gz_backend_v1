// controllers/chatController.js
import OpenAI from "openai";
import axios from "axios";
import dns from "dns";
import { Readable } from "stream";
import { sendResponse } from "../middleware/auth.js";
import ChatThread from "../models/chatThread.js";
import Worksheet from "../models/WorkSheet.js";
import PromptHistory from '../models/promptHistory.js';

import Student from "../models/Student.js";

// --- OpenAI Client Setup ---
const client = new OpenAI({
  apiKey: process.env.API_KEY,
});



const ASK_Q_ASSISTANT_ID = process.env.ASK_Q_ASSISTANT_ID;
const BAD_PROMPT_ASSISTANT_ID = process.env.BAD_PROMPT_ASSISTANT_ID;
const BAD_PROMPT_CHAT_THREAD_ID = process.env.BAD_PROMPT_CHAT_THREAD_ID;

// 👇 Fix for IPv6/timeout issues
dns.setDefaultResultOrder("ipv4first");

// --- Helper Functions (Your Provided Code) ---

/**
 * ✅ Helper 1: fetch file from url as buffer
 */
async function fetchFileBuffer(url) {
  // ... (code from your prompt)
  console.log("📡 Downloading file...");
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 30000,
  });
  console.log("✅ File downloaded successfully.");
  return Buffer.from(response.data);
}

/**
 * ✅ Helper 2: Initialize a new OpenAI thread with a DOCX file from a URL.
 */
async function initializeThreadWithDocx(fileUrl) {
  // ... (code from your prompt)
  try {
    console.log("📥 Downloading file from:", fileUrl);
    const fileBuffer = await fetchFileBuffer(fileUrl);
    const fileStream = Readable.from(fileBuffer);
    fileStream.path = "document.docx"; 

    console.log("🚀 Uploading file to OpenAI...");
    const uploadedFile = await client.files.create({
      file: fileStream,
      purpose: "assistants",
    });
    console.log(`✅ File uploaded with ID: ${uploadedFile.id}`);

    const thread = await client.beta.threads.create({
      messages: [
        {
          role: "user",
          content:
            "Please read the attached DOCX file. Do not explain anything now. I will ask my questions later.",
          attachments: [
            {
              file_id: uploadedFile.id,
              tools: [{ type: "file_search" }],
            },
          ],
        },
      ],
    });
    console.log(`✅ New thread created with ID: ${thread.id}`);
    return thread.id;
  } catch (err) {
    console.error("❌ Error initializing thread:", err.message);
    throw err;
  }
}


/**
 * ✅ Helper 3: Send a user question to an existing thread.
 */
export async function sendPromptToExistingThread(threadId, promptContent) {
  // ... (code from your prompt)
  console.log(`\n--- 📩 Sending prompt to Thread ID: ${threadId} ---`);
  try {
    await client.beta.threads.messages.create(threadId, {
      role: "user",
      content: promptContent,
    });

    const run = await client.beta.threads.runs.createAndPoll(threadId, {
      assistant_id: ASK_Q_ASSISTANT_ID, // <-- Use the correct variable
    });
    console.log(`🤖 Run status: ${run.status}`);

    if (run.status !== "completed") {
      console.error(`❌ Run failed or timed out with status: ${run.status}`);
      return null;
    }

    const messages = await client.beta.threads.messages.list(threadId, {
      order: "desc",
    });
    const latestAssistantMessage = messages.data.find((m) => m.role === "assistant");

    if (!latestAssistantMessage) {
      console.warn("⚠️ No assistant message found.");
      return null;
    }
    
    // IMPORTANT: Return the raw JSON string as you specified
    const answer = latestAssistantMessage.content[0]?.text?.value || "";
    console.log("✅ Assistant Response:", answer);
    return answer; 
  } catch (err) {
    console.error("❌ Error during sendPromptToExistingThread:", err.message);
    throw err;
  }
}



// --- API Controller ---

/**
 * ---------------------------------------------------
 * NEW API: Setup Chat Thread (Student Only)
 * POST /api/student/setupchatthread
 * ---------------------------------------------------
 */
export const setupChatThread = async (req, res) => {
  try {
    // 1. Get studentId from token and worksheetId from body
    const studentId = req.authPayload.id;
    const { worksheetId } = req.body;

    if (!worksheetId) {
      return sendResponse(res, 400, false, "worksheetId is required.");
    }

    // 2. Check if a thread *already exists*
    const existingThread = await ChatThread.findOne({
      studentId: studentId,
      worksheetId: worksheetId,
    });

    if (existingThread) {
      console.log(`[Chat] Found existing thread: ${existingThread.thread_id}`);
      return sendResponse(res, 200, true, "Existing thread found.", {
        thread_id: existingThread.thread_id,
      });
    }

    // 3. --- No thread exists, create one ---
    //    a. Find the worksheet to get the file URL
    const worksheet = await Worksheet.findById(worksheetId).select("link");
    if (!worksheet || !worksheet.link) {
      return sendResponse(res, 404, false, "Worksheet or file link not found.");
    }

    //    b. Call your helper to create a new OpenAI thread
    //       This handles the file download and upload
    const newThreadId = await initializeThreadWithDocx(worksheet.link);

    //    c. Save the new thread to *our* database
    const newChatThread = new ChatThread({
      studentId: studentId,
      worksheetId: worksheetId,
      thread_id: newThreadId,
    });
    await newChatThread.save();

    // 4. Return the new thread ID
    return sendResponse(res, 201, true, "New chat thread created.", {
      thread_id: newThreadId,
    });

  } catch (err) {
    console.error("setupChatThread err", err);
    // Handle errors from OpenAI helper
    if (err.message.includes("Error initializing thread")) {
      return sendResponse(res, 500, false, "Failed to initialize chat with OpenAI.");
    }
    return sendResponse(res, 500, false, "Server error setting up chat.");
  }
};


















////// student chat histiry of specifc worksheet 
export const loadChatOfSpecificWorksheet = async (req, res) => {
  try {
    // 1. Get studentId from token
    const studentId = req.authPayload.id;

    // 2. Get worksheetId from the request body
    const { worksheetId } = req.body;
    if (!worksheetId) {
      return sendResponse(res, 400, false, "worksheetId is required in the body.");
    }

    // 3. Find all chats matching studentId and worksheetId
    const chats = await PromptHistory.find({
      studentId: studentId,
      worksheetId: worksheetId
    })
    .sort({ createdAt: -1 }) // -1 = descending (newest first)
    .select("prompt response isBadPrompt -_id"); // Select only these fields, exclude _id

    // 4. Return the array of chats
    return sendResponse(res, 200, true, "Chat history retrieved.", chats);

  } catch (err) {
    console.error("loadChatOfSpecificWorksheet err", err);
    return sendResponse(res, 500, false, "Server error retrieving chat history.");
  }
};
















export async function analyzeTextWithBadPromptAssistant(textToAnalyze) {
  // ... (code from your prompt)
  try {
    console.log("📨 Sending text to Bad Prompt Assistant...");
    console.log("🧾 Thread:", BAD_PROMPT_CHAT_THREAD_ID);
    console.log("🧠 Assistant:", BAD_PROMPT_ASSISTANT_ID);

    await client.beta.threads.messages.create(BAD_PROMPT_CHAT_THREAD_ID, {
      role: "user",
      content: textToAnalyze,
    });

    const run = await client.beta.threads.runs.createAndPoll(BAD_PROMPT_CHAT_THREAD_ID, {
      assistant_id: BAD_PROMPT_ASSISTANT_ID,
    });
    console.log(`🤖 Run status: ${run.status}`);

    if (run.status !== "completed") {
      console.error("❌ Run failed or incomplete:", run.status);
      return null;
    }

    const messages = await client.beta.threads.messages.list(BAD_PROMPT_CHAT_THREAD_ID, {
      order: "desc",
      limit: 1,
    });
    const assistantMessage = messages.data.find((m) => m.role === "assistant");

    if (!assistantMessage) {
      console.warn("⚠️ No assistant response found.");
      return null;
    }
    
    const resultText = assistantMessage.content[0]?.text?.value?.trim();
    console.log("✅ Assistant Response:", resultText);
    return resultText; // This is the JSON string {"isbad": true/false}
  } catch (err) {
    console.error("❌ Error analyzing text:", err);
    throw err;
  }
}




export const askQ = async (req, res) => {
  try {
    // 1. Get all inputs
    const studentId = req.authPayload.id;
    const { threadId, worksheetId, promptText } = req.body;

    if (!threadId || !worksheetId || !promptText) {
      return sendResponse(res, 400, false, "threadId, worksheetId, and promptText are required.");
    }

    // 2. Step 1: Check for bad prompt
    let isBad = false;
    try {
      const analysisJson = await analyzeTextWithBadPromptAssistant(promptText);
      const analysisResult = JSON.parse(analysisJson); // Parse {"isbad": true}
      isBad = analysisResult.isbad;
    } catch (err) {
      console.error("Bad prompt analysis failed:", err);
      // Failsafe: treat as a bad prompt if analysis breaks
      isBad = true; 
    }

    // 3. Step 2: Handle "Bad Prompt"
    if (isBad) {
      console.log("[Chat] Bad prompt detected. Saving to history.");
      await PromptHistory.create({
        studentId: studentId,
        worksheetId: worksheetId,
        prompt: promptText,
        response: "", // Empty response
        isBadPrompt: true,
      });

      // Return an empty answer to the frontend
      return sendResponse(res, 200, true, "Prompt moderated.", { answer: "" });
    }

    // 4. Step 3: Handle "Good Prompt"
    console.log("[Chat] Good prompt. Sending to assistant...");
    let finalAnswer = "";
    const responseJson = await sendPromptToExistingThread(threadId, promptText);

    if (responseJson) {
      try {
        const responseResult = JSON.parse(responseJson); // Parse {"answer": "..."}
        finalAnswer = responseResult.answer || "";
      } catch (err) {
        console.error("Could not parse main assistant response:", err);
        finalAnswer = "I'm sorry, I couldn't generate a valid response.";
      }
    } else {
      finalAnswer = "I'm sorry, I couldn't find an answer.";
    }

    // 5. Save "Good Prompt" history
    await PromptHistory.create({
      studentId: studentId,
      worksheetId: worksheetId,
      prompt: promptText,
      response: finalAnswer,
      isBadPrompt: false,
    });

    // 6. Return the real answer to the frontend
    return sendResponse(res, 200, true, "Answer retrieved.", { answer: finalAnswer });

  } catch (err) {
    console.error("askQ err", err);
    return sendResponse(res, 500, false, "Server error processing question.");
  }
};






















export const getStudentFullHistory = async (req, res) => {
  try {
    // 1. Get studentId from the URL query
    const { studentId } = req.query;
    if (!studentId) {
      return sendResponse(res, 400, false, "studentId is required in the query.");
    }

    // 2. (Optional) Check if student exists
    const student = await Student.findById(studentId);
    if (!student) {
      return sendResponse(res, 404, false, "Student not found.");
    }

    // 3. Find all chats matching studentId
    const chats = await PromptHistory.find({
      studentId: studentId
    })
    .sort({ createdAt: 1 }) // 1 = ascending (oldest first)
    .select("prompt response isBadPrompt createdAt worksheetId"); // Added worksheetId for context

    // 4. Return the array of chats
    return sendResponse(res, 200, true, "Student history retrieved.", chats);

  } catch (err) {
    console.error("getStudentFullHistory err", err);
    return sendResponse(res, 500, false, "Server error retrieving history.");
  }
};