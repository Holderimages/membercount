export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  const guildId = process.env.DISCORD_GUILD_ID;
  const token = process.env.DISCORD_BOT_TOKEN;

  if (!guildId || !token) {
    console.error('Missing environment variables');
    return res.status(500).json({ 
      success: false,
      error: "Server configuration error",
      details: !guildId ? "Missing DISCORD_GUILD_ID" : "Missing DISCORD_BOT_TOKEN"
    });
  }

  try {
    // Check cache first (if implemented)
    const cacheKey = `guild-${guildId}-stats`;
    const cachedData = await getFromCache(cacheKey); // Implement your cache solution
    
    if (cachedData) {
      console.log('Serving from cache');
      return res.status(200).json({
        success: true,
        ...cachedData,
        cached: true
      });
    }

    // Fetch fresh data from Discord API
    const [guildData, presenceData] = await Promise.all([
      fetchGuildData(guildId, token),
      fetchPresenceData(guildId, token) // Optional: Get more detailed presence data
    ]);

    const result = {
      success: true,
      count: guildData.approximate_member_count || 0,
      online: guildData.approximate_presence_count || 0,
      // Additional useful data
      name: guildData.name,
      icon: guildData.icon ? 
           `https://cdn.discordapp.com/icons/${guildId}/${guildData.icon}.png` : 
           null,
      premium_tier: guildData.premium_tier,
      // Presence breakdown if available
      presence: presenceData?.presences || null
    };

    // Cache the result (implement your cache solution)
    await setToCache(cacheKey, result, 300); // Cache for 5 minutes

    console.log(`Fetched fresh data: ${result.count} members`);
    
    return res.status(200).json(result);

  } catch (err) {
    console.error("API handler error:", err);
    
    // Try to serve from cache if available
    const cachedData = await getFromCache(cacheKey);
    if (cachedData) {
      console.log('Serving stale cache after error');
      return res.status(200).json({
        success: true,
        ...cachedData,
        cached: true,
        warning: 'Serving potentially stale data'
      });
    }

    return res.status(500).json({ 
      success: false,
      error: "Internal server error",
      message: err.message 
    });
  }
}

// Helper functions
async function fetchGuildData(guildId, token) {
  const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}?with_counts=true`, {
    headers: {
      Authorization: `Bot ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Discord API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

async function fetchPresenceData(guildId, token) {
  try {
    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/widget.json`, {
      headers: {
        Authorization: `Bot ${token}`,
      },
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null; // Widget is optional
  }
}

// Implement these based on your caching solution (Redis, Vercel KV, etc.)
async function getFromCache(key) { return null; }
async function setToCache(key, data, ttl) { }
