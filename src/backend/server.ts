/**
 * SO3-TCN Backend API Server
 * Express server that bridges the React frontend with the Midnight network.
 * Handles identity registration and authentication via ZKP.
 */

import express from 'express';
import cors from 'cors';
import pino from 'pino';
import { WebSocket } from 'ws';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { deployContract, submitCallTx, type DeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { getConfig } from '../config.js';
import { MidnightWalletProvider, syncWallet } from '../wallet.js';
import { buildProviders } from '../providers.js';
import {
  type SO3Contract,
  CompiledSO3Contract,
  so3Ledger,
  so3ZkConfigPath,
} from '../../contracts/index.js';

// Required for GraphQL subscriptions in Node.js
// @ts-expect-error WebSocket global assignment
globalThis.WebSocket = WebSocket;

const logger = pino({ level: 'info', transport: { target: 'pino-pretty' } });
const app = express();
app.use(express.json());
app.use(cors());

const config = getConfig();
const SEED = process.env['MIDNIGHT_SEED'] ?? '0000000000000000000000000000000000000000000000000000000000000001';
const PORT = Number(process.env['PORT'] ?? 3001);
const PRIVATE_STATE_ID = 'AliceSO3PrivateState';

// --- Global state ---
let wallet: MidnightWalletProvider | null = null;
let providers: ReturnType<typeof buildProviders> | null = null;
let contractAddress: string = '';
let identityCount = 0;
let initialized = false;

async function initialize() {
  if (initialized) return;
  logger.info('Initializing Midnight backend...');

  setNetworkId(config.networkId);

  wallet = await MidnightWalletProvider.build(logger as any, {
    walletNetworkId: config.networkId,
    networkId: config.networkId,
    indexer: config.indexer,
    indexerWS: config.indexerWS,
    node: config.node,
    nodeWS: config.nodeWS,
    faucet: config.faucet,
    proofServer: config.proofServer,
  }, { kind: 'seed', value: SEED });

  await wallet.start();
  await syncWallet(logger as any, wallet.wallet, 5 * 60_000);

  providers = buildProviders(wallet, so3ZkConfigPath, config);
  initialized = true;
  logger.info('Backend ready!');
}

// --- Routes ---

// GET / (default friendly page)
app.get('/', (_req, res) => {
  res.send(`
    <html>
      <body style="font-family: sans-serif; background: #050810; color: #f0f4ff; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0;">
        <h1 style="color: #63b3ed;">SO3-TCN Backend API</h1>
        <p style="color: #8899aa;">Esta es la API del servidor. Para ver la interfaz de usuario, abre la siguiente URL:</p>
        <a href="http://localhost:5173" style="color: #9f7aea; font-size: 1.2rem; font-weight: bold; text-decoration: none; padding: 10px 20px; border: 1px solid #9f7aea; border-radius: 8px; margin-top: 10px; background: rgba(159,122,234,0.1);">Abrir Frontend (Puerto 5173)</a>
      </body>
    </html>
  `);
});

// GET /status
app.get('/status', async (_req, res) => {
  try {
    await initialize();
    res.json({
      connected: !!wallet,
      network: config.networkId,
      contractAddress: contractAddress || null,
      identityCount,
    });
  } catch (e: unknown) {
    res.json({ connected: false, network: config.networkId, error: String(e) });
  }
});

// POST /register
app.post('/register', async (req, res) => {
  try {
    await initialize();
    if (!providers) throw new Error('Providers not initialized');

    const { sHashHex, entropyHex, commitmentHex } = req.body as {
      sHashHex: string;
      entropyHex: string;
      commitmentHex: string;
    };

    if (!sHashHex || !entropyHex || !commitmentHex) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const sHash = Uint8Array.from(Buffer.from(sHashHex, 'hex'));
    const entropy = Uint8Array.from(Buffer.from(entropyHex, 'hex'));
    const commitment = Uint8Array.from(Buffer.from(commitmentHex, 'hex'));

    logger.info('Deploying SO3 contract and registering identity...');

    // Deploy a fresh contract for this registration
    const deployed: DeployedContract<SO3Contract> =
      await (deployContract<SO3Contract>)(providers, {
        compiledContract: CompiledSO3Contract,
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState: {},
      });

    contractAddress = deployed.deployTxData.public.contractAddress;
    logger.info(`Contract deployed at: ${contractAddress}`);

    // Register the identity
    await submitCallTx<SO3Contract, 'verify_and_register'>(providers, {
      compiledContract: CompiledSO3Contract,
      contractAddress,
      privateStateId: PRIVATE_STATE_ID,
      circuitId: 'verify_and_register',
      args: [sHash, entropy, commitment],
    });

    identityCount++;
    logger.info(`Identity registered! Commitment: ${commitmentHex.slice(0, 16)}...`);

    res.json({
      success: true,
      contractAddress,
      commitment: commitmentHex,
    });
  } catch (e: unknown) {
    logger.error(e, 'Register error');
    res.status(500).json({ success: false, error: String(e) });
  }
});

// POST /authenticate
app.post('/authenticate', async (req, res) => {
  try {
    await initialize();
    if (!providers) throw new Error('Providers not initialized');

    const { sHashHex, entropyHex, commitmentHex, contractAddress: reqContractAddress } = req.body as {
      sHashHex: string;
      entropyHex: string;
      commitmentHex: string;
      contractAddress: string;
    };

    if (!sHashHex || !entropyHex || !commitmentHex || !reqContractAddress) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const sHash = Uint8Array.from(Buffer.from(sHashHex, 'hex'));
    const entropy = Uint8Array.from(Buffer.from(entropyHex, 'hex'));
    const commitment = Uint8Array.from(Buffer.from(commitmentHex, 'hex'));

    logger.info(`Authenticating against contract: ${reqContractAddress.slice(0, 16)}...`);

    await submitCallTx<SO3Contract, 'verify_topological_identity'>(providers, {
      compiledContract: CompiledSO3Contract,
      contractAddress: reqContractAddress,
      privateStateId: PRIVATE_STATE_ID,
      circuitId: 'verify_topological_identity',
      args: [sHash, entropy, commitment],
    });

    logger.info('Authentication successful!');
    res.json({ success: true, verified: true });
  } catch (e: unknown) {
    logger.warn(String(e), 'Authentication failed');
    // If the circuit assertion failed, it's a legitimate auth failure
    const errStr = String(e)
    if (errStr.includes('assert') || errStr.includes('verification') || errStr.includes('invalid')) {
      res.json({ success: false, verified: false, error: 'ZK verification failed' });
    } else {
      res.status(500).json({ success: false, error: String(e) });
    }
  }
});

// Start server
app.listen(PORT, () => {
  logger.info(`SO3-TCN Backend running on port ${PORT}`);
  logger.info(`Network: ${config.networkId}`);
});

export default app;
