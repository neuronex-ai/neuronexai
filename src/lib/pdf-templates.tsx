import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

import type { DocumentPDFData, ReceiptPDFData } from './pdf-types';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 11,
    paddingTop: 60,
    paddingBottom: 60,
    paddingLeft: 55,
    paddingRight: 55,
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    paddingBottom: 20,
  },
  logo: {
    fontSize: 8,
    fontWeight: 700,
    color: '#9ca3af',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: '#111827',
    textAlign: 'center',
    marginBottom: 30,
  },
  body: {
    lineHeight: 1.8,
    color: '#374151',
    textAlign: 'justify',
  },
  paragraph: {
    marginBottom: 12,
  },
  dateCity: {
    marginTop: 40,
    textAlign: 'right',
    color: '#6b7280',
    fontSize: 10,
  },
  signature: {
    marginTop: 60,
    textAlign: 'center',
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: '#000000',
    width: 200,
    marginHorizontal: 'auto',
    marginBottom: 8,
  },
  signatureName: {
    fontWeight: 700,
    color: '#111827',
    fontSize: 12,
  },
  signatureRegistry: {
    color: '#6b7280',
    fontSize: 9,
    marginTop: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 55,
    right: 55,
    fontSize: 8,
    color: '#9ca3af',
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 10,
  },
});

const stripHtml = (html: string): string => {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
};

export const DocumentPDF = ({ data }: { data: DocumentPDFData }) => {
  const paragraphs = stripHtml(data.content)
    .split('\n\n')
    .filter((paragraph) => paragraph.trim());

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.logo}>{data.clinicName || 'NEURONEX'}</Text>
        </View>

        <Text style={styles.title}>{data.title}</Text>

        <View style={styles.body}>
          {paragraphs.map((paragraph, index) => (
            <Text key={index} style={styles.paragraph}>{paragraph}</Text>
          ))}
        </View>

        <Text style={styles.dateCity}>{data.date}</Text>

        <View style={styles.signature}>
          <View style={styles.signatureLine} />
          <Text style={styles.signatureName}>{data.professionalName}</Text>
          <Text style={styles.signatureRegistry}>{data.professionalRegistry}</Text>
        </View>

        <View style={styles.footer} fixed>
          <Text>Documento gerado digitalmente via NeuroNex • Verificação de autenticidade disponível</Text>
        </View>
      </Page>
    </Document>
  );
};

export const ReceiptPDF = ({ data }: { data: ReceiptPDFData }) => {
  return (
    <Document>
      <Page size="A4" style={{
        fontFamily: 'Helvetica',
        padding: 40,
        backgroundColor: '#ffffff',
      }}>
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 60,
          borderBottomWidth: 1,
          borderBottomColor: '#eeeeee',
          paddingBottom: 25,
        }}>
          <View>
            <View style={{
              width: 30,
              height: 30,
              backgroundColor: '#000000',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 10,
              borderRadius: 4,
            }}>
              <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: 'bold' }}>N</Text>
            </View>
            <Text style={{ fontSize: 8, color: '#6b7280', letterSpacing: 2, textTransform: 'uppercase' }}>
              NeuroNex Payments
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111827' }}>RECIBO</Text>
            <Text style={{ fontSize: 10, color: '#9ca3af', marginTop: 4, fontFamily: 'Helvetica' }}>
              #{Math.random().toString(36).substr(2, 8).toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={{ marginBottom: 40, borderLeftWidth: 2, borderLeftColor: '#000000', paddingLeft: 15 }}>
          <Text style={{ fontSize: 7, color: '#9ca3af', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10, fontWeight: 'bold' }}>
            VALOR NOMINAL
          </Text>
          <Text style={{ fontSize: 36, fontWeight: 'bold', color: '#111827' }}>
            {data.amountFormatted}
          </Text>
        </View>

        <View style={{ marginBottom: 40 }}>
          <Text style={{ fontSize: 12, lineHeight: 1.8, color: '#374151', textAlign: 'justify' }}>
            Recebemos de <Text style={{ fontWeight: 'bold', color: '#000000' }}>{data.patientName}</Text>
            {data.patientDoc ? <Text style={{ color: '#6b7280' }}> (CPF: {data.patientDoc})</Text> : null},
            a importncia supra citada, referente aos serviços profissionais descritos abaixo:
          </Text>

          <View style={{
            marginTop: 25,
            padding: 20,
            backgroundColor: '#fafafa',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#f0f0f0',
          }}>
            <Text style={{ fontSize: 11, color: '#374151', fontStyle: 'italic' }}>
              {data.description}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
          <View>
            <Text style={{ fontSize: 8, color: '#9ca3af', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4, fontWeight: 'bold' }}>
              Local & Data
            </Text>
            {data.location ? <Text style={{ fontSize: 10, color: '#111827', marginBottom: 2 }}>{data.location}</Text> : null}
            <Text style={{ fontSize: 10, color: '#6b7280' }}>{data.date}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 8, color: '#9ca3af', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4, fontWeight: 'bold' }}>
              Profissional
            </Text>
            <Text style={{ fontSize: 10, color: '#111827', fontWeight: 'bold', marginBottom: 2 }}>{data.professionalName}</Text>
            <Text style={{ fontSize: 9, color: '#6b7280' }}>{data.professionalRegistry}</Text>
          </View>
        </View>

        <View style={{ marginTop: 80, alignItems: 'center' }}>
          <View style={{
            borderTopWidth: 1,
            borderTopColor: '#000000',
            width: 200,
            paddingTop: 10,
            alignItems: 'center',
          }}>
            <Text style={{ fontSize: 14, color: '#9ca3af', marginBottom: 4, fontStyle: 'italic' }}>Assinado Digitalmente</Text>
            <Text style={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', color: '#111827' }}>
              {data.professionalName}
            </Text>
          </View>
        </View>

        <View style={{
          position: 'absolute',
          bottom: 40,
          left: 40,
          right: 40,
          borderTopWidth: 1,
          borderTopColor: '#f3f4f6',
          paddingTop: 15,
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}>
          <Text style={{ fontSize: 7, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>
            Documento Autenticado
          </Text>
          <Text style={{ fontSize: 7, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>
            NeuroNex · Serviços financeiros por Asaas
          </Text>
        </View>
      </Page>
    </Document>
  );
};
