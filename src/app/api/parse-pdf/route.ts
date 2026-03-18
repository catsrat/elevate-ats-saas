import { NextResponse } from "next/server";
import pdfParse from "pdf-parse";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const data = await pdfParse(buffer);

    if (!data.text?.trim()) {
      return NextResponse.json({
        error: "No text found in this PDF. It might be a scanned image or encrypted.",
      }, { status: 422 });
    }

    return NextResponse.json({ text: data.text.trim() });
  } catch (error: any) {
    console.error("PDF Parsing Error:", error);
    return NextResponse.json({
      error: error.message || "Failed to parse PDF",
    }, { status: 500 });
  }
}
