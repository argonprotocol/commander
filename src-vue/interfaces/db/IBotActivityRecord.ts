import { BotActivityType } from '@argonprotocol/commander-bot';

export interface IBotActivityRecord {
  id: number;
  tick: number;
  blockNumber?: number;
  frameId?: number;
  type: BotActivityType;
  data: any;
  insertedAt: string;
}
