import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Use Gemini's multimodal capability to extract text from PDF
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "application/pdf",
                data: base64Data,
              },
            },
            {
              text: "Extract all text content from this PDF resume. Return ONLY the raw text as it appears in the document, preserving the structure (headings, job titles, bullet points, dates, etc.). Do not add any commentary or formatting. Just output the text.",
            },
          ],
        },
      ],
    });

    const extractedText = response.text?.trim();

    if (!extractedText) {
      return NextResponse.json({
        error: "Could not extract text from this PDF.",
      }, { status: 422 });
    }

    return NextResponse.json({ text: extractedText });
  } catch (error: any) {
    console.error("PDF Extraction Error:", error?.message);
    return NextResponse.json({
      error: "Failed to process PDF: " + (error?.message || "Unknown error"),
    }, { status: 500 });
  }
}
