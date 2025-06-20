import { Db } from '../../lib/Db';
import { IConfigStringified } from '../../interfaces/IConfig';

export async function createMockedDbPromise(allAsObject: { [key: string]: string } = {}): Promise<Db> {
  return {
    configTable: {
      fetchAllAsObject: async () => allAsObject,
      insertOrReplace: async (obj: Partial<IConfigStringified>) => {},
    },
  } as unknown as Db;
}
