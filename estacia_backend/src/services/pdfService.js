import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Fontes nativas do PDFKit utilizadas pelo pdfmake
const fonts = {
  Roboto: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
};

// Localiza a classe Printer do pdfmake em diferentes estruturas de módulos
function getPdfPrinterClass() {
  const modulesToTry = [
    'pdfmake/js/printer',
    'pdfmake/src/printer',
    'pdfmake/js/printer.js',
    'pdfmake/src/printer.js',
    'pdfmake'
  ];

  for (const modName of modulesToTry) {
    try {
      const mod = require(modName);
      const candidates = [
        mod,
        mod?.default,
        mod?.PdfPrinter,
        mod?.Printer,
        mod?.default?.PdfPrinter
      ];
      for (const cand of candidates) {
        if (typeof cand === 'function') {
          return cand;
        }
      }
    } catch (e) {
      // ignora e tenta a próxima variação
    }
  }
  return null;
}

export function gerarPDFRecibo(dados) {
  // 1. Estrutura do documento definida no escopo principal
  const docDefinition = {
    content: [
      { text: 'EstacIA - Sistema de Estacionamento', style: 'header', alignment: 'center' },
      { text: 'COMPROVANTE DE PAGAMENTO DIGITAL', style: 'subheader', alignment: 'center', margin: [0, 5, 0, 15] },
      { text: '---------------------------------------------------------------------------------------------------', alignment: 'center' },
      { text: `Comprovante Nº: ${dados.comprovante_nro}`, margin: [0, 10, 0, 5] },
      { text: `Veículo (Placa): ${dados.estadia.veiculo}` },
      { text: `Local: ${dados.localizacao.shopping} - ${dados.localizacao.piso} (${dados.localizacao.setor}, Vaga ${dados.localizacao.vaga})` },
      { text: `Data/Hora Pagamento: ${new Date(dados.periodo.pagamento).toLocaleString('pt-BR')}` },
      { text: `Forma de Pagamento: ${dados.valores.metodo_pagamento}`, margin: [0, 0, 0, 15] },
      {
        table: {
          widths: ['*', 'auto'],
          body: [
            ['Descrição', 'Valor'],
            ['Valor Base Estadia', `R$ ${Number(dados.valores.valor_base).toFixed(2)}`],
            ['Valor Excedente', `R$ ${Number(dados.valores.valor_excedente).toFixed(2)}`],
            [{ text: 'Total Pago', bold: true }, { text: `R$ ${Number(dados.valores.valor_total_pago).toFixed(2)}`, bold: true }]
          ]
        }
      },
      { text: '\nObrigado por utilizar o EstacIA!', alignment: 'center', style: 'footer' }
    ],
    styles: {
      header: { fontSize: 16, bold: true },
      subheader: { fontSize: 12, bold: true },
      footer: { fontSize: 10, italics: true, margin: [0, 20, 0, 0] }
    }
  };

  // 2. Tenta gerar via pdfmake
  const PrinterClass = getPdfPrinterClass();
  if (PrinterClass) {
    const printer = new PrinterClass(fonts);
    return printer.createPdfKitDocument(docDefinition);
  }

  // 3. Fallback via PDFKit direto (garante a criação do PDF sem erro de módulo)
  try {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50 });

    doc.fontSize(16).text('EstacIA - Sistema de Estacionamento', { align: 'center' });
    doc.fontSize(12).text('COMPROVANTE DE PAGAMENTO DIGITAL', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Comprovante Nº: ${dados.comprovante_nro}`);
    doc.text(`Veículo (Placa): ${dados.estadia.veiculo}`);
    doc.text(`Local: ${dados.localizacao.shopping} - ${dados.localizacao.piso} (${dados.localizacao.setor}, Vaga ${dados.localizacao.vaga})`);
    doc.text(`Data/Hora Pagamento: ${new Date(dados.periodo.pagamento).toLocaleString('pt-BR')}`);
    doc.text(`Forma de Pagamento: ${dados.valores.metodo_pagamento}`);
    doc.moveDown();
    doc.text(`Valor Base: R$ ${Number(dados.valores.valor_base).toFixed(2)}`);
    doc.text(`Valor Excedente: R$ ${Number(dados.valores.valor_excedente).toFixed(2)}`);
    doc.fontSize(12).text(`Total Pago: R$ ${Number(dados.valores.valor_total_pago).toFixed(2)}`);
    doc.moveDown();
    doc.fontSize(10).text('Obrigado por utilizar o EstacIA!', { align: 'center' });

    return doc;
  } catch (err) {
    console.error('Erro no fallback do PDFKit:', err);
  }

  throw new Error('Não foi possível gerar o PDF do recibo.');
}