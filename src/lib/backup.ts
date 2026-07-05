import { db } from '../db/schema';

export interface BackupFile {
  app: 'vestoro';
  schemaVersion: 1;
  exportedAt: string;
  data: Record<string, unknown[]>;
}

export async function exportBackup(): Promise<BackupFile> {
  const data: Record<string, unknown[]> = {};
  for (const table of db.tables) data[table.name] = await table.toArray();
  return { app: 'vestoro', schemaVersion: 1, exportedAt: new Date().toISOString(), data };
}

export async function importBackup(file: BackupFile): Promise<void> {
  if (file.app !== 'vestoro' || file.schemaVersion !== 1) {
    throw new Error('Keine gültige Vestoro-Backup-Datei.');
  }
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      await table.clear();
      const rows = file.data[table.name];
      if (Array.isArray(rows) && rows.length > 0) await table.bulkAdd(rows as never[]);
    }
  });
}

export function downloadJson(obj: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
