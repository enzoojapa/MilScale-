import fs from 'node:fs';
import path from 'node:path';
import { banco } from './banco';

const ddl = fs.readFileSync(path.resolve(__dirname, 'schema.sql'), 'utf8');
banco.exec(ddl);

const tabelas = banco
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
  .all() as { name: string }[];

console.log(`Schema aplicado em ${banco.name}`);
console.log(`${tabelas.length} tabelas criadas: ${tabelas.map((t) => t.name).join(', ')}`);
