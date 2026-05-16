// Ritual Pac-Man contract config
// Replace CONTRACT_ADDRESS once your contract is deployed on Ritual Chain

export const RITUAL_TESTNET = {
  chainId: 1979,
  chainIdHex: '0x7BB',
  chainName: 'Ritual',
  nativeCurrency: { name: 'RITUAL', symbol: 'RITUAL', decimals: 18 },
  rpcUrls: ['https://rpc.ritualfoundation.org'],
  blockExplorerUrls: ['https://explorer.ritualfoundation.org'],
};

// Set to 0x0...0 for demo/mock mode
export const CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000000';

export const CONTRACT_ABI = [
  'function submitScore(uint256 score) external',
  'function getHighScore(address player) view returns (uint256)',
  'function getTopScores() view returns (address[] memory, uint256[] memory)',
  'function depositAndPlay() external payable',
  'function playerStats(address player) view returns (uint256 gamesPlayed, uint256 highScore, uint256 totalScore)',
  'event ScoreSubmitted(address indexed player, uint256 score, uint256 timestamp)',
  'event NewHighScore(address indexed player, uint256 score)',
] as const;

export const PLAY_COST = '0.0001'; // RITUAL per game
