const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "oqgkbduqztrpfhfclker.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "fofvskqshlyqmsvshnps.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async rewrites() {
    const netlifyUrl = process.env.NEXT_PUBLIC_NETLIFY_URL;
    if (!netlifyUrl) return [];
    return [
      {
        source: "/.netlify/functions/:path*",
        destination: `${netlifyUrl}/.netlify/functions/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
