import { createServer } from './server';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const { app } = createServer();

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 CoinSwag Swap Engine Online`);
  console.log(`🔒 Monero Privacy Hub: Active (Hop 1 -> XMR -> Hop 2)`);
  console.log(`🛡️  KYC Policy: Strictly Zero-KYC (Ephemeral Sessions)`);
  console.log(`🌐 Server listening on http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
