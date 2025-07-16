import { Db } from '../Db';

export class BaseTable {
  protected db: Db;

  constructor(db: Db) {
    this.db = db;
  }
}

export interface IFieldTypes {
  booleanFields?: string[];
  bigintFields?: string[];
  bigintJsonFields?: string[];
  jsonFields?: string[];
  dateFields?: string[];
}
