
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  pages?: number[];
  timestamp: number;
}

export interface TextbookPage {
  pageNumber: number;
  dataUrl: string;
  text: string;
}

export interface TextbookData {
  name: string;
  pages: TextbookPage[];
}
