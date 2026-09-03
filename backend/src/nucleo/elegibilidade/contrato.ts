import type { MilitarDetalhado } from '../dominio/tipos';
import type { TipoServicoDetalhado } from '../../infra/repositorios/catalogoRepositorio';

/**
 * Contexto que o núcleo monta e entrega à regra de elegibilidade do produto.
 * Tudo o que é comum aos produtos da LPS (dia trancado, impedimento, intervalo mínimo,
 * limite mensal, duplicidade na data) já vem resolvido aqui; à regra plugável cabe apenas
 * decidir o critério que varia entre MilScale e SmartScale.
 */
export interface ContextoElegibilidade {
  militar: MilitarDetalhado;
  tipoServico: TipoServicoDetalhado;
  data: string;
  cursosDoMilitar: number[];
}

export interface ResultadoElegibilidade {
  apto: boolean;
  motivo?: string;
  /** RN16: militar recém-retornado de missão permanece elegível, mas vai ao fim da fila. */
  semPrioridade?: boolean;
}

/**
 * Ponto de variação RF06 / RF06b. A implementação militar decide por hierarquia rígida de
 * posto/graduação somada aos cursos exigidos; a hospitalar decide por especialidade e
 * preferência declarada do profissional.
 */
export interface RegraElegibilidade {
  readonly identificador: string;
  readonly descricao: string;
  avaliar(contexto: ContextoElegibilidade): ResultadoElegibilidade;
}
