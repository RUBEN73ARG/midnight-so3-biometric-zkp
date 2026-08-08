import { MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import { Contract } from '@midnight-ntwrk/midnight-js-contracts';
import { persistentHash, CompactTypeVector, CompactTypeBytes } from '@midnight-ntwrk/compact-runtime';

// Import compiled contract types and contract instance
// Note: These will be available after compiling `so3_identity.compact`
import { Contract as SO3Contract, Ledger } from '../managed/so3_identity/contract';

export interface SO3IdentityProviders extends MidnightProviders {
  // Define required providers (e.g., wallet provider, proof provider)
}

/**
 * Calculates the Poseidon commitment off-chain using the exact same structure as the Compact circuit.
 * 
 * @param sHash The 32-byte rotational invariant hash from e3nn
 * @param entropy The 32-byte physical entropy
 * @returns The 32-byte commitment
 */
export function calculateTopologicalCommitment(
  sHash: Uint8Array,
  entropy: Uint8Array
): Uint8Array {
  const bytes32Type = new CompactTypeBytes(32);
  const vector2Bytes32Type = new CompactTypeVector(2, bytes32Type);
  
  return persistentHash(vector2Bytes32Type, [sHash, entropy]);
}

/**
 * Register a new topological identity to the Midnight network.
 * 
 * @param providers Midnight network providers
 * @param witness_s_hash The 32-byte S_hash generated from the Python e3nn model
 * @param witness_entropy 32-byte physical entropy (e.g., from Hall sensor)
 */
export async function registerTopologicalIdentity(
  providers: SO3IdentityProviders,
  witness_s_hash: Uint8Array,
  witness_entropy: Uint8Array
): Promise<Uint8Array> {
  console.log("Calculating commitment off-chain...");
  const public_commitment = calculateTopologicalCommitment(witness_s_hash, witness_entropy);
  
  console.log("Submitting topological identity to the Midnight ledger...");
  
  // Initialize contract instance
  const contractInstance = new SO3Contract({
    // Add any required witness overrides if needed by the contract
  });
  
  const myContract = new Contract(contractInstance, providers);
  
  // Call the 'verify_and_register' circuit.
  // The Midnight SDK generates the ZK proof locally before submitting the transaction.
  const tx = await myContract.callTx.verify_and_register(
    witness_s_hash, 
    witness_entropy, 
    public_commitment
  );
  await tx.wait();
  
  console.log("Identity registration transaction submitted successfully!");
  return public_commitment;
}

/**
 * Authenticate using a registered topological identity.
 */
export async function verifyTopologicalIdentity(
  providers: SO3IdentityProviders,
  witness_s_hash: Uint8Array,
  witness_entropy: Uint8Array
): Promise<boolean> {
  console.log("Generating Zero-Knowledge Proof for topological authentication...");
  
  const public_commitment = calculateTopologicalCommitment(witness_s_hash, witness_entropy);

  // Initialize contract
  const contractInstance = new SO3Contract({});
  const myContract = new Contract(contractInstance, providers);

  // Call the 'verify_topological_identity' circuit.
  try {
    await myContract.callTx.verify_topological_identity(
      witness_s_hash, 
      witness_entropy, 
      public_commitment
    );
    return true;
  } catch (error) {
    console.error("Authentication failed:", error);
    return false;
  }
}
