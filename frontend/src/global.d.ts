// CSS module declarations for swiper and other CSS imports
declare module '*.css'
declare module '*.scss'
declare module '*.sass'

// Web3 global declarations
declare global {
  interface Window {
    ethereum?: any;
    web3?: any;
  }
}

// Next.js environment variables
declare namespace NodeJS {
  interface ProcessEnv {
    readonly NEXT_PUBLIC_APP_NAME?: string;
    readonly NEXT_PUBLIC_BACKEND_URL?: string;
    readonly NEXT_PUBLIC_RPC_URL?: string;
    readonly NEXT_PUBLIC_CONTRACT_ADDRESS?: string;
    readonly NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?: string;
    readonly NEXT_PUBLIC_HOUSE_ADDRESS?: string;
    readonly NEXT_PUBLIC_BOTTLE_ADDRESS?: string;
    readonly NEXT_PUBLIC_RONIN_TESTNET_RPC?: string;
  }
}

// Common utility types
type Address = `0x${string}`;
type HexString = `0x${string}`;

// Game related types
interface GameItem {
  src: string;
  slug: string;
}

interface FAQItem {
  question: string;
  answer: string;
  open: boolean;
}


