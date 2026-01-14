/* NETGRID // SMART STRATUM BRIDGE (DYNAMIC POOL) */
const WebSocket = require('ws');
const net = require('net');
const https = require('https');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log(`[NETGRID] SMART BRIDGE LISTENING ON PORT ${PORT}`);

// Helper: Fetch a working mining pool from Duino-Coin API
function getPool(callback) {
    https.get('https://server.duinocoin.com/getPool', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                // API returns JSON like: { "ip": "x.x.x.x", "port": 1234, ... }
                const result = JSON.parse(data);
                console.log(`[API] Assigned to pool: ${result.ip}:${result.port}`);
                callback(result.ip, result.port);
            } catch (e) {
                console.error('[API] Failed to parse pool data, using fallback.');
                callback('server.duinocoin.com', 2813); // Fallback
            }
        });
    }).on('error', (err) => {
        console.error('[API] Error fetching pool:', err.message);
        callback('server.duinocoin.com', 2813); // Fallback
    });
}

wss.on('connection', (ws) => {
    console.log('[CLIENT] Bridge Requested');

    // 1. Fetch a working pool first
    getPool((poolHost, poolPort) => {
        
        const pool = new net.Socket();
        pool.setEncoding('utf8');

        // 2. Connect to the assigned pool
        pool.connect(poolPort, poolHost, () => {
            console.log(`[POOL] Connected to upstream (${poolHost}:${poolPort})`);
        });

        // 3. Pipe data
        pool.on('data', (data) => {
            // Log first packet for debugging
            if (data.toString().includes('.')) console.log(`[POOL] Received Version: ${data.toString().trim()}`);
            ws.send(data.toString());
        });

        ws.on('message', (msg) => {
            pool.write(msg.toString().trim() + '\n');
        });

        // 4. Cleanup
        const cleanup = () => {
            if (!pool.destroyed) pool.destroy();
            ws.terminate();
        };

        pool.on('error', (err) => {
            console.log('[POOL] Error:', err.message);
            cleanup();
        });
        
        pool.on('close', cleanup);
        ws.on('close', cleanup);
    });
});