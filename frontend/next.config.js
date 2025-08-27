/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost'],
  },
  env: {
    NEXT_PUBLIC_RONIN_CHAIN_ID: '2021',
    NEXT_PUBLIC_RONIN_TESTNET_RPC: 'https://saigon-testnet.roninchain.com/rpc',
    NEXT_PUBLIC_RONIN_MAINNET_RPC: 'https://api.roninchain.com/rpc',
  },
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    return config;
  },
}

module.exports = nextConfig


