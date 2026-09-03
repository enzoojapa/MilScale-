/** Objeto de valor Periodo (Tabela 8 do detalhamento). Datas trafegam sempre como 'YYYY-MM-DD'. */
export class Periodo {
  constructor(readonly dataInicio: string, readonly dataFim: string) {
    if (dataFim < dataInicio) {
      throw new Error('Data final anterior à data inicial.');
    }
  }

  contemData(data: string): boolean {
    return data >= this.dataInicio && data <= this.dataFim;
  }

  quantidadeDias(): number {
    return diferencaEmDias(this.dataInicio, this.dataFim) + 1;
  }

  *dias(): Generator<string> {
    let atual = this.dataInicio;
    while (atual <= this.dataFim) {
      yield atual;
      atual = somarDias(atual, 1);
    }
  }
}

export function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function agoraISO(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

export function somarDias(data: string, dias: number): string {
  const referencia = new Date(`${data}T12:00:00Z`);
  referencia.setUTCDate(referencia.getUTCDate() + dias);
  return referencia.toISOString().slice(0, 10);
}

export function diferencaEmDias(de: string, ate: string): number {
  const inicio = Date.UTC(
    Number(de.slice(0, 4)),
    Number(de.slice(5, 7)) - 1,
    Number(de.slice(8, 10))
  );
  const fim = Date.UTC(
    Number(ate.slice(0, 4)),
    Number(ate.slice(5, 7)) - 1,
    Number(ate.slice(8, 10))
  );
  return Math.round((fim - inicio) / 86_400_000);
}

export function formatarDataBr(data: string): string {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}
