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

const app = express();
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

app.get('/start', async (_req, res) => {
  await bot.start();
  jsonExt({ isStarted: bot.isStarted }, res);
});

app.get('/status', async (_req, res) => {
  if (bot.isWaitingToStart) return jsonExt({ isWaitingToStart: true }, res);
  const status = await bot.blockSync.status();
  jsonExt(status, res);
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
  if (bot.isWaitingToStart) return jsonExt({ isWaitingToStart: true }, res);
  const currentFrameId = await bot.currentFrameId();
  const nextFrameId = currentFrameId + 1;
  const data = await bot.storage.bidsFile(nextFrameId).get();
  jsonExt(data, res);
});

app.get('/bids-history', async (_req, res) => {
  if (bot.isWaitingToStart) return jsonExt({ isWaitingToStart: true }, res);
  const data = bot.autobidder.bidHistory;
  jsonExt(data, res);
});

app.get('/bids/:cohortActivatedFrameId', async (req, res) => {
  if (bot.isWaitingToStart) return jsonExt({ isWaitingToStart: true }, res);
  const cohortActivatedFrameId = Number(req.params.cohortActivatedFrameId);
  const data = await bot.storage.bidsFile(cohortActivatedFrameId).get();
  jsonExt(data, res);
});

app.get('/earnings/:frameId', async (req, res) => {
  if (bot.isWaitingToStart) return jsonExt({ isWaitingToStart: true }, res);
  const frameId = Number(req.params.frameId);
  const data = await bot.storage.earningsFile(frameId).get();
  jsonExt(data, res);
});

app.post('/restart-bidder', async (_req, res) => {
  if (bot.isWaitingToStart) return jsonExt({ isWaitingToStart: true }, res);
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
