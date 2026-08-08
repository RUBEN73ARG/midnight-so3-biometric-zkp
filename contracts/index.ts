import * as CompactContractLib from '@midnight-ntwrk/compact-js';
import {
  Contract as SO3ContractClass,
  ledger as so3Ledger,
} from './managed/so3_identity/contract/index.js';
import {
  Contract as HWContractClass,
  ledger,
  contractReferenceLocations as CompiledHelloWorldContract,
} from './managed/hello-world/contract/index.js';
import { persistentHash, CompactTypeBytes, CompactTypeVector } from '@midnight-ntwrk/compact-runtime';
import { fileURLToPath } from 'url';
import path from 'path';

export type { Contract as SO3Contract } from './managed/so3_identity/contract/index.js';
export { so3Ledger, HWContractClass as Contract, ledger, CompiledHelloWorldContract };

// Resolve the directory of this file at runtime
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const zkConfigPath = path.join(__dirname, 'managed', 'hello-world');
export const so3ZkConfigPath = path.join(__dirname, 'managed', 'so3_identity');

/**
 * A properly constructed CompiledContract for the SO3 Identity contract.
 * Uses CompiledContract.make(tag, ctor) per the compact-js API.
 */
export const CompiledSO3Contract = CompactContractLib.CompiledContract.withVacantWitnesses(
  CompactContractLib.CompiledContract.withCompiledFileAssets(
    CompactContractLib.CompiledContract.make('so3_identity', SO3ContractClass),
    so3ZkConfigPath
  )
);

/**
 * Calculates the Poseidon commitment off-chain using the SAME structure as the Compact ZK circuit.
 * persistentHash<Vector<2, Bytes<32>>>([s_hash, entropy])
 */
export function calculateSO3Commitment(
  sHash: Uint8Array,
  entropy: Uint8Array
): Uint8Array {
  const bytes32Type = new CompactTypeBytes(32);
  const vector2Type = new CompactTypeVector(2, bytes32Type);
  return persistentHash(vector2Type, [sHash, entropy]);
}
