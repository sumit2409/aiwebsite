/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export', // static export for GitHub Pages
  trailingSlash: true  // better compatibility on Pages
};
module.exports = nextConfig;
