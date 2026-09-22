import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Do not generate AGENTS.md and CLAUDE.md on every dev start.
  agentRules: false,
};

export default nextConfig;
