import Database from 'better-sqlite3';
import { ambiente } from '../config/ambiente';

export const banco = new Database(ambiente.caminhoBanco);

banco.pragma('journal_mode = WAL');
banco.pragma('foreign_keys = ON');

export function emTransacao<T>(operacao: () => T): T {
  const executar = banco.transaction(operacao);
  return executar();
}
