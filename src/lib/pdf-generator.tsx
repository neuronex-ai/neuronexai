import { pdf } from '@react-pdf/renderer';

import { DocumentPDF, ReceiptPDF } from './pdf-templates';
import type { DocumentPDFData, ReceiptPDFData } from './pdf-types';

export type { DocumentPDFData, ReceiptPDFData } from './pdf-types';

export const generateDocumentPDF = async (data: DocumentPDFData): Promise<Blob> => {
  return pdf(<DocumentPDF data={data} />).toBlob();
};

export const generateDocumentPDFBase64 = async (data: DocumentPDFData): Promise<string> => {
  const blob = await generateDocumentPDF(data);
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary);
};

export const downloadDocumentPDF = async (data: DocumentPDFData, filename?: string): Promise<void> => {
  const blob = await generateDocumentPDF(data);
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `${data.type.toLowerCase()}_${data.patientName.replace(/\s+/g, '_')}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};

export const generateReceiptPDF = async (data: ReceiptPDFData): Promise<Blob> => {
  return pdf(<ReceiptPDF data={data} />).toBlob();
};

export const generateReceiptPDFBase64 = async (data: ReceiptPDFData): Promise<string> => {
  const blob = await generateReceiptPDF(data);
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary);
};
