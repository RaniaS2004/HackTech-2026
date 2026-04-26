import OpenAI from "openai";

const k2 = new OpenAI({
  apiKey: process.env.K2_API_KEY,
  baseURL: "https://api.k2think.ai/v1",
});

export default k2;
