import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { type Chain } from 'viem';

// Ritual Chain (Chain ID 1979)
export const ritualChain: Chain = {
  id: 1979,
  name: 'Ritual',
  nativeCurrency: { name: 'RITUAL', symbol: 'RITUAL', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.ritualfoundation.org'] },
  },
  blockExplorers: {
    default: { name: 'Ritual Explorer', url: 'https://explorer.ritualfoundation.org' },
  },
  testnet: true,
};

export const wagmiConfig = getDefaultConfig({
  appName: 'Ritual Pac-Man',
  projectId: 'ritual-pacman-dapp',
  chains: [ritualChain],
  transports: {
    [ritualChain.id]: http('https://rpc.ritualfoundation.org'),
  },
  ssr: false,
});
