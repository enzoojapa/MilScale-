import { emTransacao } from '../../infra/banco';
import { escalaRepositorio } from '../../infra/repositorios/escalaRepositorio';
import { militarRepositorio } from '../../infra/repositorios/militarRepositorio';
import { missaoRepositorio } from '../../infra/repositorios/missaoRepositorio';
import { auditoriaService } from '../auditoria/auditoriaService';
import { ErroDeNegocio, ErroNaoEncontrado } from '../dominio/erros';
import { agoraISO, hojeISO, somarDias } from '../dominio/periodo';
import type { TipoMissao } from '../dominio/tipos';

export interface DadosMissao {
  id_militar: number;
  tipo: TipoMissao;
  descricao: string;
  data_inicio: string;
  data_fim: string;
}

export interface ServicoAfetado {
  idServicoEscalado: number;
  data: string;
  tipoServico: string;
}

/** UC16 – Manter missões e impedimentos (RN15, RN16). */
export const missaoService = {
  listar: missaoRepositorio.listar,

  incluir(dados: DadosMissao, idUsuario: number) {
    validar(dados);
    const militar = militarRepositorio.buscarPorId(dados.id_militar);
    if (!militar) throw new ErroNaoEncontrado('Militar');
    // UC16-E2: períodos sobrepostos para o mesmo militar são recusados.
    if (
      missaoRepositorio.existeSobreposicao(dados.id_militar, dados.data_inicio, dados.data_fim)
    ) {
      throw new ErroDeNegocio('O período se sobrepõe a outro impedimento do mesmo militar.', 409);
    }

    const afetados = this.servicosAfetados(dados.id_militar, dados.data_inicio, dados.data_fim);

    const idMissao = emTransacao(() => {
      const novoId = missaoRepositorio.inserir({
        ...dados,
        id_usuario_registro: idUsuario,
        data_registro: agoraISO()
      });

      // RN16: o retorno da missão não dá precedência; a data de fim fica registrada no militar.
      if (!militar.data_fim_ultima_missao || dados.data_fim > militar.data_fim_ultima_missao) {
        militarRepositorio.atualizar(dados.id_militar, { data_fim_ultima_missao: dados.data_fim });
      }

      // UC16-E1: serviços já escalados no período ficam pendentes de substituição.
      for (const servico of afetados) {
        escalaRepositorio.atualizarServico(servico.idServicoEscalado, {
          id_militar: null,
          observacao: `Pendente: militar em ${dados.tipo.toLowerCase()} (${dados.descricao}).`
        });
      }

      auditoriaService.registrar({
        idUsuario,
        entidade: 'MISSAO',
        idRegistro: novoId,
        acao: 'INCLUSAO',
        valorNovo: { ...dados, servicosAfetados: afetados.length }
      });
      return novoId;
    });

    return { idMissao, servicosAfetados: afetados };
  },

  alterar(idMissao: number, dados: DadosMissao, idUsuario: number) {
    const atual = missaoRepositorio.buscarPorId(idMissao);
    if (!atual) throw new ErroNaoEncontrado('Impedimento');
    validar(dados);
    if (
      missaoRepositorio.existeSobreposicao(dados.id_militar, dados.data_inicio, dados.data_fim, idMissao)
    ) {
      throw new ErroDeNegocio('O período se sobrepõe a outro impedimento do mesmo militar.', 409);
    }
    missaoRepositorio.atualizar(idMissao, dados);
    auditoriaService.registrar({
      idUsuario,
      entidade: 'MISSAO',
      idRegistro: idMissao,
      acao: 'ALTERACAO',
      valorAnterior: atual,
      valorNovo: dados
    });
  },

  /** UC16-A2 – encerramento antecipado: o militar volta à fila a partir do dia seguinte. */
  encerrarAntecipadamente(idMissao: number, idUsuario: number) {
    const atual = missaoRepositorio.buscarPorId(idMissao);
    if (!atual) throw new ErroNaoEncontrado('Impedimento');
    const hoje = hojeISO();
    if (atual.data_fim <= hoje) {
      throw new ErroDeNegocio('O impedimento já se encerrou.', 409);
    }
    const novaDataFim = hoje < atual.data_inicio ? atual.data_inicio : hoje;
    missaoRepositorio.atualizar(idMissao, { data_fim: novaDataFim });
    militarRepositorio.atualizar(atual.id_militar, { data_fim_ultima_missao: novaDataFim });
    auditoriaService.registrar({
      idUsuario,
      entidade: 'MISSAO',
      idRegistro: idMissao,
      acao: 'ALTERACAO',
      valorAnterior: { data_fim: atual.data_fim },
      valorNovo: { data_fim: novaDataFim, liberadoAPartirDe: somarDias(novaDataFim, 1) }
    });
  },

  /** UC16-A3 – exclusão limitada a impedimentos futuros que ainda não começaram. */
  excluir(idMissao: number, idUsuario: number) {
    const atual = missaoRepositorio.buscarPorId(idMissao);
    if (!atual) throw new ErroNaoEncontrado('Impedimento');
    if (atual.data_inicio <= hojeISO()) {
      throw new ErroDeNegocio('Somente impedimentos futuros e não iniciados podem ser excluídos.', 409);
    }
    missaoRepositorio.excluir(idMissao);
    auditoriaService.registrar({
      idUsuario,
      entidade: 'MISSAO',
      idRegistro: idMissao,
      acao: 'EXCLUSAO',
      valorAnterior: atual
    });
  },

  servicosAfetados(idMilitar: number, inicio: string, fim: string): ServicoAfetado[] {
    return escalaRepositorio
      .servicosPorPeriodo({ inicio, fim, idMilitar, incluirRascunho: true })
      .filter((s) => s.situacao === 'PREVISTO')
      .map((s) => ({
        idServicoEscalado: s.id_servico_escalado,
        data: s.data,
        tipoServico: s.nome_tipo_servico
      }));
  }
};

function validar(dados: DadosMissao) {
  if (!dados.descricao?.trim()) throw new ErroDeNegocio('Informe a descrição do impedimento.');
  if (dados.data_fim < dados.data_inicio) {
    throw new ErroDeNegocio('A data final não pode anteceder a inicial.');
  }
}
