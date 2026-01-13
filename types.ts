
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  pages?: { bookIndex: number; pageNumber: number }[];
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
