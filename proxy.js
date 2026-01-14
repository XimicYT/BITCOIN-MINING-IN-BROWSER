/* NETGRID // HEAVY DEBUG BRIDGE */
const WebSocket = require('ws');
const net = require('net');
const https = require('https');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log(`[SYSTEM] DEBUG BRIDGE ACTIVE ON PORT ${PORT}`);
console.log(`[SYSTEM] Waiting for browser connections...`);

// Helper: Get Pool
function getPool(callback) {
    console.log('[API] Contacting Duino-Coin Master Server to find a pool...');
    
    const req = https.get('https://server.duinocoin.com/getPool', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                const result = JSON.parse(data);
                console.log(`[API] SUCCESS. Master Server assigned: ${result.ip}:${result.port} (${result.name})`);
                callback(result.ip, result.port);
            } catch (e) {
                console.error(`[API] ERROR: Could not parse JSON. Raw data: ${data}`);
                console.log('[API] Swapping to Emergency Fallback (server.duinocoin.com:2813)');
                callback('server.duinocoin.com', 2813);
            }
        });
    });
    
    req.on('error', (err) => {
        console.error(`[API] NETWORK ERROR: ${err.message}`);
        console.log('[API] Swapping to Emergency Fallback (server.duinocoin.com:2813)');
        callback('server.duinocoin.com', 2813);
    });
}

wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`\n[CLIENT] New Connection from ${clientIp}`);
    console.log('[CLIENT] Initiating Pool Lookup...');

    getPool((poolHost, poolPort) => {
        console.log(`[POOL] Attempting TCP Connection to -> ${poolHost}:${poolPort}`);
        
        const pool = new net.Socket();
        pool.setEncoding('utf8');
        pool.setTimeout(10000); // 10 second timeout

        // Attempt Connect
        pool.connect(poolPort, poolHost, () => {
            console.log('[POOL] TCP Socket Established. Waiting for Version String...');
        });

        // Data received from Pool
        pool.on('data', (data) => {
            const msg = data.toString().trim();
            console.log(`[POOL -> CLIENT] ${msg}`);
            ws.send(data.toString());
        });

        // Data sent from Client
        ws.on('message', (msg) => {
            console.log(`[CLIENT -> POOL] ${msg}`);
            pool.write(msg.toString().trim() + '\n');
        });

        // Errors
        pool.on('error', (err) => {
            console.error(`[POOL] SOCKET ERROR: ${err.message}`);
            ws.send(`ERR: POOL_CONNECTION_FAILED: ${err.message}`);
        });

        pool.on('timeout', () => {
            console.error(`[POOL] TIMEOUT. The pool ${poolHost} did not answer in 10s.`);
            pool.end();
        });

        pool.on('close', () => {
            console.log('[POOL] Connection Closed.');
            ws.close();
        });

        ws.on('close', () => {
            console.log('[CLIENT] Browser disconnected.');
            pool.destroy();
        });
    });
});