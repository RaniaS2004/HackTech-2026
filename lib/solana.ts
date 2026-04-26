import { Buffer } from "buffer";
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction } from "@solana/web3.js";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");

function getPayer() {
  const rawKey = process.env.SOLANA_PRIVATE_KEY || "[]";
  const secretKey = Uint8Array.from(JSON.parse(rawKey));
  if (secretKey.length === 0) {
    throw new Error("SOLANA_PRIVATE_KEY missing");
  }
  return Keypair.fromSecretKey(secretKey);
}

export async function mintAgentToken(challengeId: string, model: string, confidence: number) {
  const payer = getPayer();
  const memo = JSON.stringify({
    janus: true,
    challenge_id: challengeId,
    model,
    confidence,
    issued_at: Date.now(),
  });
  const memoInstruction = new TransactionInstruction({
    keys: [],
    programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
    data: Buffer.from(memo),
  });
  const tx = new Transaction().add(memoInstruction);
  const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
  return {
    signature: sig,
    explorer: `https://explorer.solana.com/tx/${sig}?cluster=devnet`,
  };
}
