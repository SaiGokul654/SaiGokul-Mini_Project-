import OpenAI from "openai";

// The newest OpenAI model is "gpt-4" (updated from gpt-5 which doesn't exist)
const apiKey = process.env.OPENAI_API_KEY;

let openai: OpenAI | null = null;
if (apiKey) {
  openai = new OpenAI({ apiKey });
} else {
  console.warn("OPENAI_API_KEY is not set. AI features will be disabled in development.");
}

export async function generatePatientSummary(patientHistory: string): Promise<string> {
  if (!openai) {
    throw new Error("OPENAI_API_KEY is not configured. Set OPENAI_API_KEY to use AI features.");
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a medical AI assistant. Summarize patient medical histories concisely, highlighting key diagnoses, treatments, risk factors, and recommendations. Format your response with clear sections: Chief Complaints, Diagnoses, Treatments, and Recommendations."
        },
        {
          role: "user",
          content: `Summarize this patient's medical history:\n\n${patientHistory}`
        }
      ],
      max_tokens: 2048,
    });

    return response.choices[0].message.content || "Unable to generate summary";
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw new Error("Failed to generate AI summary");
  }
}
