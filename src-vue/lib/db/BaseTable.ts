import { Db } from '../Db';

export class BaseTable {
  protected db: Db;

  constructor(db: Db) {
    this.db = db;
  }
}
