import { waitForLoad } from '@argonprotocol/mainchain';
import { keyringFromFile } from '@argonprotocol/mainchain/clis';
import { jsonExt, onExit, requireAll, requireEnv } from './utils.ts';
import Bot from './Bot.ts';
import express from 'express';
import cors from 'cors';
import { Dockers } from './Dockers.ts';
import type { IBotStateError, IBotStateStarting } from './interfaces/IBotStateFile.ts';
import type { IBlockNumbers } from './Dockers.ts';

// wait for crypto wasm to be loaded
await waitForLoad();

let errorMessage = '';
let oldestFrameIdToSync: number | undefined;

if (process.env.OLDEST_FRAME_ID_TO_SYNC) {
  oldestFrameIdToSync = parseInt(process.env.OLDEST_FRAME_ID_TO_SYNC, 10);
}

const pair = await keyringFromFile({
  filePath: requireEnv('KEYPAIR_PATH'),
  passphrase: process.env.KEYPAIR_PASSPHRASE,
});

const bot = new Bot({
  oldestFrameIdToSync: oldestFrameIdToSync,
  ...requireAll({
    datadir: process.env.DATADIR!,
    pair,
    biddingRulesPath: process.env.BIDDING_RULES_PATH,
    archiveRpcUrl: process.env.ARCHIVE_NODE_URL,
    localRpcUrl: process.env.LOCAL_RPC_URL,
    keysMnemonic: process.env.SESSION_KEYS_MNEMONIC,
  }),
});

async function createStartingPayload(): Promise<IBotStateStarting> {
  let syncProgress = 0;
  let argonBlockNumbers: IBlockNumbers = {
    localNode: 0,
    mainNode: 0,
  };

  let bitcoinBlockNumbers: IBlockNumbers = {
    localNode: 0,
    mainNode: 0,
  };

  try {
    [argonBlockNumbers, bitcoinBlockNumbers] = await Promise.all([
      Dockers.getArgonBlockNumbers(),
      Dockers.getBitcoinBlockNumbers(),
    ]);
  } catch (e) {
    console.error('Error getting block numbers', e);
  }

  try {
    syncProgress = (await bot.blockSync?.calculateSyncProgress()) ?? 0;
  } catch (e) {
    console.error('Error calculating sync progress', e);
  }

  const blockData = {
    argonBlockNumbers: argonBlockNumbers,
    bitcoinBlockNumbers: bitcoinBlockNumbers,
  };

  const payload: IBotStateStarting = {
    isReady: bot.isReady,
    isStarting: bot.isStarting || undefined,
    isSyncing: bot.isSyncing || undefined,
    isWaitingForBiddingRules: bot.isWaitingForBiddingRules || undefined,
    syncProgress,
    ...blockData,
  };

  return payload;
}

async function isStarting(res: express.Response): Promise<boolean> {
  if (bot.isReady) return false;

  jsonExt(await createStartingPayload(), res);

  return true;
}

async function hasError(res: express.Response): Promise<boolean> {
  if (!errorMessage) return false;

  const payload: IBotStateError = {
    ...(await createStartingPayload()),
    serverError: errorMessage,
  };
  jsonExt(payload, res);

  return true;
}

const app = express();

app.use(cors({ origin: true, methods: ['GET', 'POST', 'PUT', 'DELETE'] }));

app.get('/bot-state', async (_req, res) => {
  if (await hasError(res)) return;
  if (await isStarting(res)) return;
  const botState = await bot.blockSync.state();
  jsonExt(botState, res);
});

app.get('/argon-blockchain-status', async (_req, res) => {
  if (await hasError(res)) return;
  const status = await Dockers.getArgonBlockNumbers();
  jsonExt(status, res);
});

app.get('/bitcoin-blockchain-status', async (_req, res) => {
  if (await hasError(res)) return;
  const status = await Dockers.getBitcoinBlockNumbers();
  jsonExt(status, res);
});

app.get('/bids', async (_req, res) => {
  if (await hasError(res)) return;
  if (await isStarting(res)) return;
  const currentFrameId = await bot.currentFrameId;
  const nextFrameId = currentFrameId + 1;
  const data = await bot.storage.bidsFile(nextFrameId).get();
  jsonExt(data, res);
});

app.get('/history', async (_req, res) => {
  if (await hasError(res)) return;
  const data = (await bot.history?.data) || [];
  jsonExt(data, res);
});

app.get('/bids/:cohortActivatingFrameId', async (req, res) => {
  if (await hasError(res)) return;
  if (await isStarting(res)) return;
  const cohortActivatingFrameId = Number(req.params.cohortActivatingFrameId);
  const data = await bot.storage.bidsFile(cohortActivatingFrameId).get();
  jsonExt(data, res);
});

app.get('/earnings/:frameId', async (req, res) => {
  if (await hasError(res)) return;
  if (await isStarting(res)) return;
  const frameId = Number(req.params.frameId);
  const data = await bot.storage.earningsFile(frameId).get();
  jsonExt(data, res);
});

app.use((_req, res) => {
  res.status(404).send('Not Found');
});

const server = app.listen(process.env.PORT ?? 3000, () => {
  console.log(`Server is running on port ${process.env.PORT ?? 3000}`);
});

onExit(() => new Promise<void>(resolve => server.close(() => resolve())));

bot.start().catch(e => {
  console.error('Error starting bot', e);
  errorMessage = e.message;
  bot.history.handleError(e);
});

onExit(() => bot.shutdown());
