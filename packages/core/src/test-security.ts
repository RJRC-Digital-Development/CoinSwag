import { MemoryScrubber } from './security/memory-scrubber';
import { VaultCipher } from './security/vault-cipher';
import { KeypairGeneratorService } from './services/keypair-generator';

console.log('================================================================');
console.log('CoinSwag Core Cryptographic Security & Memory Hardening Suite');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${testName}`);
    failed++;
  }
}

// -------------------------------------------------------------
// 1. Memory Zeroization & 3-Pass DoD Wiping
// -------------------------------------------------------------
console.log('--- 1. Testing Cryptographic Memory Zeroization ---');

const secretBuffer = Buffer.from('super_secret_private_key_entropy_1234567890', 'utf-8');
assert(secretBuffer.some(b => b !== 0), 'Buffer initially contains non-zero sensitive entropy');

MemoryScrubber.zeroize(secretBuffer);
assert(secretBuffer.every(b => b === 0), 'Buffer successfully zeroized with 0x00 across all bytes');

const sensitiveObj = {
  orderId: 'swap_123',
  privateKey: '0x123456789abcdef123456789abcdef',
  mnemonic: 'abandon ability able about above absent absorb abstract absurd abuse access accident',
  metadata: {
    clientIp: '127.0.0.1',
    userSecretToken: 'sec_abcdef123456'
  }
};

MemoryScrubber.sanitizeSensitiveObject(sensitiveObj);
assert(sensitiveObj.privateKey === '[ZEROIZED_BY_SECURITY_KERNEL]', 'Sensitive privateKey property scrubbed');
assert(sensitiveObj.mnemonic === '[ZEROIZED_BY_SECURITY_KERNEL]', 'Sensitive mnemonic property scrubbed');
assert(sensitiveObj.metadata.userSecretToken === '[ZEROIZED_BY_SECURITY_KERNEL]', 'Nested userSecretToken property scrubbed');
assert(sensitiveObj.orderId === 'swap_123', 'Non-sensitive orderId preserved');

// -------------------------------------------------------------
// 2. Authenticated AES-256-GCM Key Vault Encryption
// -------------------------------------------------------------
console.log('\n--- 2. Testing Authenticated AES-256-GCM Key Vault Encryption ---');

const testKeypairs = [
  KeypairGeneratorService.generateKeypair('BTC'),
  KeypairGeneratorService.generateKeypair('XMR'),
  KeypairGeneratorService.generateKeypair('ETH')
];

const passphrase = 'MyUltraSecurePassphrase!2026';
const encryptedVault = KeypairGeneratorService.formatEncryptedKeyVaultExport(
  'split_test_123',
  'sec_test_token',
  testKeypairs,
  passphrase
);

assert(encryptedVault.algorithm === 'aes-256-gcm', 'Cipher algorithm is authenticated aes-256-gcm');
assert(encryptedVault.kdf === 'pbkdf2-sha256', 'Key derivation function is pbkdf2-sha256');
assert(encryptedVault.iterations === 600000, 'Iterations enforced at 600,000');
assert(typeof encryptedVault.ciphertext === 'string' && encryptedVault.ciphertext.length > 50, 'Ciphertext generated');
assert(typeof encryptedVault.authTag === 'string' && encryptedVault.authTag.length === 32, '128-bit authentication tag generated');
assert(typeof encryptedVault.checksum === 'string' && encryptedVault.checksum.length === 64, 'HMAC-SHA256 checksum generated');

// Decrypt with correct passphrase
const decrypted = VaultCipher.decryptVault(encryptedVault, passphrase);
assert(decrypted.orderId === 'split_test_123', 'Decrypted payload matches original orderId');
assert(decrypted.vault.length === 3, 'Decrypted payload contains all 3 keypairs');
assert(decrypted.vault[0].address === testKeypairs[0].address, 'BTC address matches');

// Decrypt with incorrect passphrase
let badPassphraseFailed = false;
try {
  VaultCipher.decryptVault(encryptedVault, 'WrongPassword123!');
} catch {
  badPassphraseFailed = true;
}
assert(badPassphraseFailed, 'Decryption strictly rejected with wrong passphrase');

// Tampering detection: modify 1 character of ciphertext
const tamperedVault = { ...encryptedVault };
const originalCiphertext = tamperedVault.ciphertext;
// Flip first hex char
const flippedChar = originalCiphertext[0] === 'a' ? 'b' : 'a';
tamperedVault.ciphertext = flippedChar + originalCiphertext.slice(1);

let tamperDetected = false;
try {
  VaultCipher.decryptVault(tamperedVault, passphrase);
} catch (e: any) {
  tamperDetected = e.message.includes('Integrity check failed') || e.message.includes('Unsupported state');
}
assert(tamperDetected, 'Tampering detection successfully caught modified ciphertext bit');

console.log('\n================================================================');
console.log(`Results: ${passed} Passed, ${failed} Failed`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All Cryptographic Security & Memory tests passed successfully!\n');
}
