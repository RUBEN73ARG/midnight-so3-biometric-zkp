import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebSocket } from 'ws';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import {
  deployContract,
  submitCallTx,
  type DeployedContract,
} from '@midnight-ntwrk/midnight-js-contracts';
import type { ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import {
  type EnvironmentConfiguration,
  waitForFunds,
} from '@midnight-ntwrk/testkit-js';
import pino from 'pino';

import { getConfig } from '../config.js';
import {
  MidnightWalletProvider,
  syncWallet,
  type WalletSecret,
} from '../wallet.js';
import { buildProviders, type HelloWorldProviders } from '../providers.js';
import {
  type SO3Contract,
  CompiledSO3Contract,
  so3Ledger,
  so3ZkConfigPath,
  calculateSO3Commitment,
} from '../../contracts/index.js';

// Required for GraphQL subscriptions in Node.js
// @ts-expect-error WebSocket global assignment for apollo
globalThis.WebSocket = WebSocket;

const ALICE_LOCAL_SEED =
  '0000000000000000000000000000000000000000000000000000000000000001';
const PRIVATE_STATE_ID = 'AliceSO3PrivateState';

const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  transport: { target: 'pino-pretty' },
});

const network = process.env['MIDNIGHT_NETWORK'] ?? 'local';

function resolveSecret(net: string): WalletSecret {
  if (net === 'local') return { kind: 'seed', value: ALICE_LOCAL_SEED };
  const upper = net.toUpperCase();
  const mnemonicEnv = `MIDNIGHT_${upper}_MNEMONIC`;
  const seedEnv = `MIDNIGHT_${upper}_SEED`;
  const mnemonic = process.env[mnemonicEnv]?.trim().replace(/\s+/g, ' ');
  const seedHex = process.env[seedEnv]?.trim();
  if (mnemonic && seedHex) throw new Error(`Set only one of ${mnemonicEnv} or ${seedEnv}.`);
  if (mnemonic) return { kind: 'mnemonic', value: mnemonic };
  if (seedHex) return { kind: 'seed', value: seedHex };
  throw new Error(`Either ${mnemonicEnv} or ${seedEnv} is required for network '${net}'.`);
}

// --- Mock biometric data for testing ---
// In production: s_hash comes from SO3InvariantExtractor.quantize_to_bytes()
// entropy comes from the Hall sensor noise captured on device
const MOCK_S_HASH: Uint8Array = new Uint8Array(32).fill(0xAB);
const MOCK_ENTROPY: Uint8Array = new Uint8Array(32).fill(0xCD);

// A different user's biometric data (should fail verification)
const ATTACKER_S_HASH: Uint8Array = new Uint8Array(32).fill(0x01);
const ATTACKER_ENTROPY: Uint8Array = new Uint8Array(32).fill(0x02);

describe(`SO3-TCN Topological Identity Contract (${network})`, () => {
  let wallet: MidnightWalletProvider;
  let providers: HelloWorldProviders;
  let contractAddress: ContractAddress;

  const config = getConfig();
  const secret = resolveSecret(network);
  const isRemote = network !== 'local';
  const syncTimeoutMs = Number(
    process.env['MIDNIGHT_SYNC_TIMEOUT_MS'] ??
      (isRemote ? 60 * 60_000 : 10 * 60_000),
  );

  async function queryLedger(p: HelloWorldProviders) {
    const state = await p.publicDataProvider.queryContractState(contractAddress);
    expect(state).not.toBeNull();
    return so3Ledger(state!.data);
  }

  beforeAll(async () => {
    setNetworkId(config.networkId);

    const envConfig: EnvironmentConfiguration = {
      walletNetworkId: config.networkId,
      networkId: config.networkId,
      indexer: config.indexer,
      indexerWS: config.indexerWS,
      node: config.node,
      nodeWS: config.nodeWS,
      faucet: config.faucet,
      proofServer: config.proofServer,
    };

    wallet = await MidnightWalletProvider.build(logger, envConfig, secret);
    await wallet.start();
    await syncWallet(logger, wallet.wallet, syncTimeoutMs);

    if (isRemote) {
      const nightBalance = await waitForFunds(
        wallet.wallet,
        envConfig,
        false,
        wallet.unshieldedKeystore,
      );
      logger.info(`Wallet NIGHT balance on '${network}': ${nightBalance}`);
    }

    providers = buildProviders(wallet, so3ZkConfigPath, config);
    logger.info(`SO3 Providers initialized on '${network}'. Ready to test!`);
  });

  afterAll(async () => {
    if (wallet) {
      logger.info('Stopping wallet...');
      await wallet.stop();
    }
  });

  it('Deploys the SO3 Identity contract', async () => {
    logger.info('Deploying SO3-TCN identity contract...');

    // Use CompiledSO3Contract (contractReferenceLocations) — this is what tells
    // the SDK where to find the ZK keys, NOT a new SO3Contract({}) instance.
    const deployed: DeployedContract<SO3Contract> =
      await (deployContract<SO3Contract>)(providers, {
        compiledContract: CompiledSO3Contract,
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState: {},
      });

    contractAddress = deployed.deployTxData.public.contractAddress;
    logger.info(`SO3 Identity Contract deployed at: ${contractAddress}`);
    expect(contractAddress).toBeDefined();
    expect(contractAddress.length).toBeGreaterThan(0);

    const state = await queryLedger(providers);
    expect(state.identities.isEmpty()).toBe(true);
    logger.info('Ledger is empty — ready for registration.');
  });

  it('Calculates Poseidon commitment deterministically off-chain', () => {
    const commitment1 = calculateSO3Commitment(MOCK_S_HASH, MOCK_ENTROPY);
    const commitment2 = calculateSO3Commitment(MOCK_S_HASH, MOCK_ENTROPY);

    // Same inputs must always produce same commitment
    expect(commitment1).toEqual(commitment2);
    expect(commitment1.length).toBe(32);
    logger.info(`Commitment: 0x${Buffer.from(commitment1).toString('hex')}`);

    // Different inputs must produce different commitments
    const attackerCommitment = calculateSO3Commitment(ATTACKER_S_HASH, ATTACKER_ENTROPY);
    expect(commitment1).not.toEqual(attackerCommitment);
    logger.info('Commitment uniqueness verified — different biometrics produce different hashes.');
  });

  it('Registers a topological identity (ZKP circuit: verify_and_register)', async () => {
    const commitment = calculateSO3Commitment(MOCK_S_HASH, MOCK_ENTROPY);

    logger.info('Generating ZK proof and submitting registration transaction...');
    await (submitCallTx<SO3Contract, 'verify_and_register'>)(providers, {
      compiledContract: CompiledSO3Contract,
      contractAddress,
      privateStateId: PRIVATE_STATE_ID,
      circuitId: 'verify_and_register',
      args: [MOCK_S_HASH, MOCK_ENTROPY, commitment],
    });

    const state = await queryLedger(providers);
    expect(state.identities.member(commitment)).toBe(true);
    logger.info('Topological identity successfully registered on the Midnight ledger!');
  });

  it('Rejects duplicate registration of the same identity', async () => {
    const commitment = calculateSO3Commitment(MOCK_S_HASH, MOCK_ENTROPY);

    logger.info('Attempting duplicate registration (should fail)...');
    await expect(
      submitCallTx<SO3Contract, 'verify_and_register'>(providers, {
        compiledContract: CompiledSO3Contract,
        contractAddress,
        privateStateId: PRIVATE_STATE_ID,
        circuitId: 'verify_and_register',
        args: [MOCK_S_HASH, MOCK_ENTROPY, commitment],
      })
    ).rejects.toThrow();
    logger.info('Duplicate registration correctly rejected.');
  });

  it('Authenticates a registered identity (ZKP circuit: verify_topological_identity)', async () => {
    const commitment = calculateSO3Commitment(MOCK_S_HASH, MOCK_ENTROPY);

    logger.info('Authenticating via ZK proof...');
    await (submitCallTx<SO3Contract, 'verify_topological_identity'>)(providers, {
      compiledContract: CompiledSO3Contract,
      contractAddress,
      privateStateId: PRIVATE_STATE_ID,
      circuitId: 'verify_topological_identity',
      args: [MOCK_S_HASH, MOCK_ENTROPY, commitment],
    });
    logger.info('Authentication SUCCESS — topological identity verified via ZKP!');
  });

  it('Rejects authentication with wrong biometric data', async () => {
    // Attacker tries to use the victim's public_commitment with their own (wrong) witnesses
    const legitimateCommitment = calculateSO3Commitment(MOCK_S_HASH, MOCK_ENTROPY);

    logger.info('Attempting spoofed authentication (wrong s_hash, correct commitment)...');
    await expect(
      submitCallTx<SO3Contract, 'verify_topological_identity'>(providers, {
        compiledContract: CompiledSO3Contract,
        contractAddress,
        privateStateId: PRIVATE_STATE_ID,
        circuitId: 'verify_topological_identity',
        args: [ATTACKER_S_HASH, ATTACKER_ENTROPY, legitimateCommitment],
      })
    ).rejects.toThrow();
    logger.info('Spoofed authentication correctly rejected by ZK circuit.');
  });
});
