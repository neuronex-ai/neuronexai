export interface DocumentPDFData {
  type: string;
  title: string;
  content: string;
  patientName: string;
  patientDoc?: string;
  professionalName: string;
  professionalRegistry: string;
  date: string;
  clinicName?: string;
}

export interface ReceiptPDFData {
  professionalName: string;
  professionalRegistry: string;
  patientName: string;
  patientDoc?: string;
  amountFormatted: string;
  description: string;
  date: string;
  location?: string;
}
