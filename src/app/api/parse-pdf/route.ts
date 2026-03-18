import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Use the internal module path to avoid the known Next.js production bug
    // where pdf-parse tries to read a non-existent test file
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse/lib/pdf-parse.js");
    const data = await pdfParse(buffer);

    if (!data.text?.trim()) {
      return NextResponse.json({
        error: "No text found in this PDF. It might be a scanned image or encrypted.",
      }, { status: 422 });
    }

    return NextResponse.json({ text: data.text.trim() });
  } catch (error: any) {
    console.error("PDF Parsing Error:", error?.message);
    return NextResponse.json({
      error: "Failed to read PDF: " + (error?.message || "Unknown error"),
    }, { status: 500 });
  }
}
