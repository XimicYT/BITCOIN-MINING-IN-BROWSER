/* NETGRID // MANUAL OVERRIDE BRIDGE */
const WebSocket = require('ws');
const net = require('net');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

// ---------------------------------------------------------
// HARDCODED POOL LIST (Skips Cloudflare Check)
// We cycle through these if one fails
// ---------------------------------------------------------
const KNOWN_POOLS = [
    { host: 'server.duinocoin.com', port: 2813 }, // Main 1
    { host: '51.15.127.80',         port: 2812 }, // Europe
    { host: 'server.duinocoin.com', port: 2812 }, // Main 2
    { host: '162.55.103.174',       port: 2811 }  // Catch-all
];

console.log(`[NETGRID] MANUAL BRIDGE ACTIVE ON PORT ${PORT}`);

wss.on('connection', (ws) => {
    console.log('[CLIENT] Connection received. Bypassing API...');

    // Pick a random pool to spread load
    const selectedPool = KNOWN_POOLS[Math.floor(Math.random() * KNOWN_POOLS.length)];
    
    console.log(`[STRATEGY] Connecting directly to -> ${selectedPool.host}:${selectedPool.port}`);

    const pool = new net.Socket();
    pool.setEncoding('utf8');
    pool.setTimeout(10000); // 10s timeout

    pool.connect(selectedPool.port, selectedPool.host, () => {
        console.log('[POOL] Connected! Pipe established.');
    });

    // Forwarding Logic
    pool.on('data', (data) => {
        // Log version to prove it works
        if(data.toString().includes('.')) console.log(`[POOL SAYS] ${data.toString().trim()}`);
        ws.send(data.toString());
    });

    ws.on('message', (msg) => {
        pool.write(msg.toString().trim() + '\n');
    });

    // Error Handling
    const cleanup = () => {
        if (!pool.destroyed) pool.destroy();
        ws.close();
    };

    pool.on('error', (err) => {
        console.error(`[POOL ERROR] ${err.message}`);
        ws.send('ERR: POOL_FAILED');
        cleanup();
    });

    pool.on('timeout', () => {
        console.error('[POOL] Timeout. Server blocked us?');
        cleanup();
    });

    pool.on('close', cleanup);
    ws.on('close', cleanup);
});