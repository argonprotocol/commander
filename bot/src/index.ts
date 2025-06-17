import { waitForLoad } from '@argonprotocol/mainchain';
import { keyringFromFile } from '@argonprotocol/mainchain/clis';
import { jsonExt, onExit, requireAll, requireEnv } from './utils.ts';
import Bot from './Bot.ts';
import express from 'express';
import cors from 'cors';
import { Dockers } from './Dockers.ts';

// wait for crypto wasm to be loaded
await waitForLoad();

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

function notStarted(res: express.Response): boolean {
  if (bot.isWaitingToStart) {
    jsonExt({ isWaitingToStart: true }, res);
    return true;
  } else if (bot.isStarting) {
    jsonExt({ isStarting: true }, res);
    return true;
  } else if (!bot.isStarted) {
    jsonExt({ isStarted: false }, res);
    return true;
  }
  return false;
}

const app = express();

app.use(
  cors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  }),
);

app.get('/start', async (_req, res) => {
  await bot.start();
  jsonExt({ isStarted: bot.isStarted }, res);
});

app.get('/sync-state', async (_req, res) => {
  if (notStarted(res)) return;
  const syncState = await bot.blockSync.state();
  jsonExt(syncState, res);
});

app.get('/argon-blockchain-status', async (_req, res) => {
  const status = await Dockers.getArgonBlockNumbers();
  jsonExt(status, res);
});

app.get('/bitcoin-blockchain-status', async (_req, res) => {
  const status = await Dockers.getBitcoinBlockNumbers();
  jsonExt(status, res);
});

app.get('/bids', async (_req, res) => {
  if (notStarted(res)) return;
  const currentFrameId = await bot.currentFrameId();
  const nextFrameId = currentFrameId + 1;
  const data = await bot.storage.bidsFile(nextFrameId).get();
  jsonExt(data, res);
});

app.get('/bids-history', async (_req, res) => {
  if (notStarted(res)) return;
  const data = bot.history;
  jsonExt(data, res);
});

app.get('/bids/:cohortActivatingFrameId', async (req, res) => {
  if (notStarted(res)) return;
  const cohortActivatingFrameId = Number(req.params.cohortActivatingFrameId);
  const data = await bot.storage.bidsFile(cohortActivatingFrameId).get();
  jsonExt(data, res);
});

app.get('/earnings/:frameId', async (req, res) => {
  if (notStarted(res)) return;
  const frameId = Number(req.params.frameId);
  const data = await bot.storage.earningsFile(frameId).get();
  jsonExt(data, res);
});

app.post('/restart-bidder', async (_req, res) => {
  if (notStarted(res)) return;
  await bot.autobidder.restart();
  res.status(200).json({ ok: true });
});

app.use((_req, res) => {
  res.status(404).send('Not Found');
});

const server = app.listen(process.env.PORT ?? 3000, () => {
  console.log(`Server is running on port ${process.env.PORT ?? 3000}`);
});

onExit(() => new Promise<void>(resolve => server.close(() => resolve())));

if (process.env.IS_READY_FOR_BIDDING === 'true') {
  bot.startAfterDockersSynced();
} else {
  console.log('Bot must be started manually');
}

onExit(() => bot.stop());
