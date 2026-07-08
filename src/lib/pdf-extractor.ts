import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker?url";

// Set worker once
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export interface ExtractedPage {
  page: number;
  text: string;
}

export interface ExtractedPdf {
  totalPages: number;
  pages: ExtractedPage[];
  fullText: string;
}

/**
 * Extracts all text from a PDF File object using PDF.js (browser-side).
 * Works for normal text-based PDFs. Scanned-image PDFs will return minimal text.
 */
export async function extractTextFromPdf(file: File): Promise<ExtractedPdf> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: ExtractedPage[] = [];
  let fullText = "";

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Join text items, preserving rough line breaks
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s{2,}/g, " ")
      .trim();

    pages.push({ page: pageNum, text: pageText });
    fullText += `\n\n--- Page ${pageNum} ---\n${pageText}`;
  }

  return {
    totalPages: pdf.numPages,
    pages,
    fullText: fullText.trim(),
  };
}
