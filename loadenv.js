import dotenv from "dotenv";

// Load environment variables FIRST
dotenv.config();
console.log("✅ .env loaded" , process.env.PORT);