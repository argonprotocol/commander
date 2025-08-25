#!/usr/bin/env node
import { addGlobalArgs, applyEnv, buildCli } from './index.js';
import { waitForLoad } from '@argonprotocol/mainchain';

const program = buildCli();
addGlobalArgs(program);
// load env
applyEnv(program);

(async function main() {
  await waitForLoad();
  await program.parseAsync(process.argv);
})().catch(console.error);
