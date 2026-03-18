import { NextResponse } from "next/server";

// Must use the legacy build in Node.js environments (no DOMMatrix)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

// Disable the worker entirely for server-side Node.js
pdfjsLib.GlobalWorkerOptions.workerSrc = "";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      disableStream: true,
      disableAutoFetch: true,
    });

    const pdf = await loadingTask.promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str || "")
        .join(" ");
      fullText += pageText + "\n\n";
    }

    if (!fullText.trim()) {
      return NextResponse.json({
        error: "No text found in this PDF. It might be a scanned image or encrypted documents.",
      }, { status: 422 });
    }

    return NextResponse.json({ text: fullText.trim() });
  } catch (error: any) {
    console.error("PDF Parsing Error:", error);
    return NextResponse.json({
      error: error.message || "Failed to parse PDF",
    }, { status: 500 });
  }
}
