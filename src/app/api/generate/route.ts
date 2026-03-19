import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";
import { GoogleGenAI } from "@google/genai";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    // Validate environment variables first
    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is not set.");
      return NextResponse.json({ error: "Server configuration error: Missing GEMINI_API_KEY." }, { status: 500 });
    }
    if (!process.env.DATABASE_URL) {
      console.error("DATABASE_URL is not set.");
      return NextResponse.json({ error: "Server configuration error: Missing DATABASE_URL." }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { baseResume, jobDescription, tone, level } = await req.json();

    if (!baseResume || !jobDescription) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Get or Create User
    let user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: userId,
          email: `${userId}@placeholder.com`,
          credits: 1,
        }
      });
    }

    // 2. Check Credits
    if (user.credits <= 0) {
      return NextResponse.json({ error: "Insufficient credits", code: "PAYWALL" }, { status: 402 });
    }

    // 3. Call Gemini with enhanced prompt for higher ATS scores
    const prompt = `
      You are a world-class ATS Resume Optimizer and Executive Recruiter AI.
      Your goal is to achieve the HIGHEST POSSIBLE ATS score by aggressively integrating job description keywords.

      RULES:
      1. Extract every significant keyword, skill, tool, and phrase from the Job Description.
      2. Naturally weave ALL of them into the tailored resume. Do not invent experience, but reframe existing experience to match.
      3. Use the exact keyword phrasing from the JD (not synonyms) for maximum ATS matching.
      4. Mirror the job title in the resume headline/summary.
      5. Use bullet points that start with strong action verbs and contain quantified impact wherever possible.
      6. Tone must be: "${tone}". Experience level: "${level}".

      Respond ONLY with a valid JSON object with these 6 keys (no extra text, no markdown code fences):
      1. "tailoredResume" (string): The fully optimized resume in clean markdown (no code blocks inside the string).
      2. "atsScore" (number): Integer 0-100 reflecting how well the tailored resume matches the JD.
      3. "matchedKeywords" (array of strings): Keywords from the JD that were SUCCESSFULLY integrated into the resume. List 8-15.
      4. "missingKeywords" (array of strings): Important JD keywords that COULD NOT be naturally added (max 5).
      5. "coverLetter" (string): A punchy, tailored cover letter in markdown matching tone and JD requirements.
      6. "interviewQuestions" (string): Markdown guide with the 5 most likely interview questions based on the JD, with answer guidance.

      Base Resume:
      ${baseResume}
      
      Job Description:
      ${jobDescription}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const resultText = response.text || "{}";
    const data = JSON.parse(resultText);

    // 4. Save to Database
    await prisma.resume.create({
      data: {
        userId: user.id,
        baseResume,
        jobDescription,
        tailoredResume: data.tailoredResume || "",
        atsScore: data.atsScore || 0,
        missingKeywords: data.missingKeywords || [],
        coverLetter: data.coverLetter || "",
        interviewQuestions: data.interviewQuestions || ""
      }
    });

    // 5. Deduct Credit
    await prisma.user.update({
      where: { id: user.id },
      data: { credits: user.credits - 1 }
    });

    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Generate API Error:", error?.message, error?.stack);
    return NextResponse.json({ 
      error: error?.message || "Internal server error" 
    }, { status: 500 });
  }
}
