import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

export function localDatabase(path = ':memory:') {
  const sqlite = new DatabaseSync(path);
  sqlite.exec('PRAGMA foreign_keys = ON;');
  // Existing previews created before migration tracking already have the first schema.
  const schemaExists = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='student'").get();
  const version = sqlite.prepare('PRAGMA user_version').get().user_version;
  const journal = JSON.parse(readFileSync(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8'));
  const pending = journal.entries.slice(version || (schemaExists ? 1 : 0));
  for (const { idx, tag } of pending) {
    const sql = readFileSync(new URL('../drizzle/' + tag + '.sql', import.meta.url), 'utf8');
    sqlite.exec('BEGIN;');
    try {
      sqlite.exec(sql);
      sqlite.exec('PRAGMA user_version = ' + (idx + 1) + '; COMMIT;');
    } catch (error) {
      sqlite.exec('ROLLBACK;');
      throw error;
    }
  }
  const db = {
    prepare(sql) {
      let args = [];
      return {
        bind(...values) { args = values; return this; },
        first() { return sqlite.prepare(sql).get(...args) ?? null; },
        execute() {
          const statement = sqlite.prepare(sql);
          if (/^SELECT\s/i.test(sql)) return { results: statement.all(...args) };
          return { meta: statement.run(...args) };
        },
        run() { return this.execute(); }
      };
    },
    batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = statements.map(statement => statement.execute());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    }
  };
  return db;
}
