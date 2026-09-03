import { regraEscalaRepositorio } from '../../infra/repositorios/regraEscalaRepositorio';
import { auditoriaService } from '../auditoria/auditoriaService';
import { ErroDeNegocio, ErroNaoEncontrado } from '../dominio/erros';
import { somarDias } from '../dominio/periodo';

export interface DadosRegra {
  id_tipo_servico: number;
  ciclo_minimo: number;
  ciclo_maximo: number | null;
  dias_servico: number;
  intervalo_minimo: number;
  max_servicos_mes: number | null;
  vigencia_inicio: string;
  vigencia_fim: string | null;
}

/** UC04 – Manter regras da escala (RN01, RN06, RN11, RN20). */
export const regraEscalaService = {
  listar: regraEscalaRepositorio.listar,
  vigenteEm: regraEscalaRepositorio.vigenteEm,

  incluir(dados: DadosRegra, idUsuario: number) {
    validar(dados);
    if (
      regraEscalaRepositorio.existeSobreposicao(
        dados.id_tipo_servico,
        dados.vigencia_inicio,
        dados.vigencia_fim
      )
    ) {
      throw new ErroDeNegocio(
        'Já existe regra vigente para este tipo de serviço no período informado.',
        409
      );
    }
    const id = regraEscalaRepositorio.inserir({ ...dados, id_usuario_criacao: idUsuario });
    auditoriaService.registrar({
      idUsuario,
      entidade: 'REGRA_ESCALA',
      idRegistro: id,
      acao: 'INCLUSAO',
      valorNovo: dados
    });
    return regraEscalaRepositorio.buscarPorId(id);
  },

  /**
   * UC04-A1: alterar uma regra vigente encerra a vigência anterior e cria a nova versão,
   * preservando o histórico em vez de sobrescrever o registro.
   */
  alterar(idRegra: number, dados: DadosRegra, idUsuario: number) {
    const atual = regraEscalaRepositorio.buscarPorId(idRegra);
    if (!atual) throw new ErroNaoEncontrado('Regra da escala');
    validar(dados);

    const fimDaAnterior = somarDias(dados.vigencia_inicio, -1);
    if (fimDaAnterior < atual.vigencia_inicio) {
      throw new ErroDeNegocio(
        'A nova vigência precisa começar depois do início da regra que está sendo substituída.'
      );
    }
    if (
      regraEscalaRepositorio.existeSobreposicao(
        dados.id_tipo_servico,
        dados.vigencia_inicio,
        dados.vigencia_fim,
        idRegra
      )
    ) {
      throw new ErroDeNegocio('A nova vigência se sobrepõe a outra regra ativa.', 409);
    }

    regraEscalaRepositorio.atualizar(idRegra, { vigencia_fim: fimDaAnterior });
    const novoId = regraEscalaRepositorio.inserir({ ...dados, id_usuario_criacao: idUsuario });
    auditoriaService.registrar({
      idUsuario,
      entidade: 'REGRA_ESCALA',
      idRegistro: novoId,
      acao: 'ALTERACAO',
      valorAnterior: atual,
      valorNovo: dados
    });
    return regraEscalaRepositorio.buscarPorId(novoId);
  },

  /** UC04-A2 – encerramento de vigência sem criar nova regra. */
  encerrarVigencia(idRegra: number, dataFim: string, idUsuario: number) {
    const atual = regraEscalaRepositorio.buscarPorId(idRegra);
    if (!atual) throw new ErroNaoEncontrado('Regra da escala');
    if (dataFim < atual.vigencia_inicio) {
      throw new ErroDeNegocio('A data final não pode anteceder o início da vigência.');
    }
    regraEscalaRepositorio.atualizar(idRegra, { vigencia_fim: dataFim });
    auditoriaService.registrar({
      idUsuario,
      entidade: 'REGRA_ESCALA',
      idRegistro: idRegra,
      acao: 'ALTERACAO',
      valorAnterior: { vigencia_fim: atual.vigencia_fim },
      valorNovo: { vigencia_fim: dataFim }
    });
  }
};

function validar(dados: DadosRegra) {
  // UC04-E2: limites negativos, nulos ou com mínimo maior que o máximo são recusados.
  if (dados.ciclo_minimo <= 0 || dados.intervalo_minimo <= 0 || dados.dias_servico <= 0) {
    throw new ErroDeNegocio('Ciclo mínimo, intervalo mínimo e dias de serviço devem ser positivos.');
  }
  if (dados.ciclo_maximo !== null && dados.ciclo_maximo < dados.ciclo_minimo) {
    throw new ErroDeNegocio('O ciclo máximo não pode ser menor que o ciclo mínimo.');
  }
  if (dados.max_servicos_mes !== null && dados.max_servicos_mes <= 0) {
    throw new ErroDeNegocio('O limite mensal de serviços deve ser positivo.');
  }
  if (dados.vigencia_fim && dados.vigencia_fim < dados.vigencia_inicio) {
    throw new ErroDeNegocio('A vigência final não pode anteceder a inicial.');
  }
}
