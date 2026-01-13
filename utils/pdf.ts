
import { TextbookPage } from "../types";

declare const pdfjsLib: any;

export const processPdf = async (file: File, maxPages: number = 50): Promise<TextbookPage[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = Math.min(pdf.numPages, maxPages);
  const pages: TextbookPage[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport }).promise;
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    
    // Extract text for grounding
    const textContent = await page.getTextContent();
    const text = textContent.items.map((item: any) => item.str).join(' ');

    pages.push({
      pageNumber: i,
      dataUrl,
      text
    });
  }

  return pages;
};
