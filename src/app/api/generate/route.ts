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

    // 3. Call Gemini
    const prompt = `
      You are an expert executive recruiter and ATS resume optimization AI.
      I will provide you with a Base Resume, a Target Job Description, a desired Tone ("${tone}"), and an Experience Level ("${level}").

      You MUST respond ONLY with a valid JSON document containing the following 5 strict keys (no extra text, no markdown blocks outside the JSON):
      1. "tailoredResume" (string): The highly optimized ATS resume in raw markdown format (do not wrap in markdown code blocks inside the JSON string).
      2. "atsScore" (number): An integer from 0 to 100 representing how well the tailored resume matches the job description.
      3. "missingKeywords" (array of strings): High-value keywords from the job description that could not be naturally included. Keep it to 3-5 maximum.
      4. "coverLetter" (string): A short, punchy cover letter matching the tone, in markdown format.
      5. "interviewQuestions" (string): A markdown formatted guide containing the 3 most likely behavioral or technical questions to anticipate, based on gaps between the resume and the job desc.

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
