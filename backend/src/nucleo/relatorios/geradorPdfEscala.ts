import PDFDocument from 'pdfkit';
import { ambiente } from '../../config/ambiente';
import { escalaRepositorio } from '../../infra/repositorios/escalaRepositorio';
import { ErroDeNegocio } from '../dominio/erros';
import { formatarDataBr, Periodo } from '../dominio/periodo';

export interface ParametrosExportacao {
  inicio: string;
  fim: string;
  idTipoServico?: number;
  responsavel: string;
}

/**
 * UC18 – Exporta a escala publicada com cabeçalho da organização militar e campo de assinatura
 * do sargenteante, para publicação em boletim interno.
 */
export function gerarPdfDaEscala(parametros: ParametrosExportacao): PDFKit.PDFDocument {
  const periodo = new Periodo(parametros.inicio, parametros.fim);
  const servicos = escalaRepositorio.servicosPorPeriodo({
    inicio: periodo.dataInicio,
    fim: periodo.dataFim,
    idTipoServico: parametros.idTipoServico
  });

  // UC18-E2: escalas em rascunho não são exportáveis.
  if (servicos.length === 0) {
    throw new ErroDeNegocio('Não há escala publicada no período informado para exportar.', 409);
  }

  const documento = new PDFDocument({ size: 'A4', margin: 42 });

  documento.fontSize(14).font('Helvetica-Bold').text(ambiente.organizacaoMilitar, { align: 'center' });
  documento.moveDown(0.2);
  documento.fontSize(11).font('Helvetica').text('Escala de Serviço', { align: 'center' });
  documento
    .fontSize(9)
    .text(
      `Período de ${formatarDataBr(periodo.dataInicio)} a ${formatarDataBr(periodo.dataFim)}`,
      { align: 'center' }
    );
  documento.moveDown(1);

  const porData = new Map<string, typeof servicos>();
  for (const servico of servicos) {
    const lista = porData.get(servico.data) ?? [];
    lista.push(servico);
    porData.set(servico.data, lista);
  }

  for (const [data, itens] of porData) {
    if (documento.y > 700) documento.addPage();

    const trancado = itens[0].trancado ? '  [DIA TRANCADO]' : '';
    documento.moveDown(0.4);
    documento.fontSize(10).font('Helvetica-Bold').text(`${formatarDataBr(data)}${trancado}`);
    documento.font('Helvetica').fontSize(9);

    for (const servico of itens) {
      const militar = servico.id_militar
        ? `${servico.sigla_posto} ${servico.nome_guerra}`
        : '*** PENDENTE ***';
      documento.text(
        `   ${servico.posicao ?? servico.nome_tipo_servico}`.padEnd(34, ' ') +
          `${militar}`.padEnd(28, ' ') +
          `${servico.hora_inicio} (${servico.duracao_horas}h)`
      );
    }
  }

  documento.moveDown(3);
  documento.fontSize(9).text('___________________________________________', { align: 'center' });
  documento.text(parametros.responsavel, { align: 'center' });
  documento.text('Sargenteante', { align: 'center' });

  documento.end();
  return documento;
}
