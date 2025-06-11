import { Db } from '../Db';

interface IArgonActivityRecord {
  localNodeBlockNumber: number;
  mainNodeBlockNumber: number;
  insertedAt: string;
}

export class ArgonActivitiesTable {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async insert(localhostBlock: number, mainchainBlock: number): Promise<IArgonActivityRecord> {
    const [record] = await this.db.sql.select<IArgonActivityRecord[]>(
      "INSERT INTO argon_activities (local_node_block_number, main_node_block_number) VALUES (?1, ?2) RETURNING *",
      [localhostBlock, mainchainBlock]
    );
    return record;
  }

  async latest(): Promise<IArgonActivityRecord | null> {
    const records = await this.db.sql.select<IArgonActivityRecord[]>(
      "SELECT * FROM argon_activities ORDER BY inserted_at DESC LIMIT 1",
      []
    );
    return records[0] || null;
  }

  async fetchLastFiveRecords(): Promise<IArgonActivityRecord[]> {
    return await this.db.sql.select<IArgonActivityRecord[]>(
      "SELECT * FROM argon_activities ORDER BY inserted_at DESC LIMIT 5",
      []
    );
  }
}
