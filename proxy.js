/* NETGRID // STRATUM BRIDGE (CLOUD READY) */
const WebSocket = require('ws');
const net = require('net');

// Use Render's port or default to 8080 for local testing
const PORT = process.env.PORT || 8080;

// Configuration: Solo CKPool
const POOL_HOST = 'solo.ckpool.org';
const POOL_PORT = 3333;

const wss = new WebSocket.Server({ port: PORT });

console.log(`[NETGRID] BRIDGE LISTENING ON PORT ${PORT}`);

wss.on('connection', (ws) => {
    console.log('[CLIENT] Connected');
    
    const pool = new net.Socket();
    pool.setEncoding('utf8');

    // Connect to the real mining pool
    pool.connect(POOL_PORT, POOL_HOST, () => {
        console.log('[POOL] Connected to upstream');
    });

    pool.on('data', (data) => ws.send(data.toString()));
    
    ws.on('message', (msg) => {
        pool.write(msg + '\n');
    });

    // Cleanup
    const cleanup = () => {
        if(!pool.destroyed) pool.destroy();
        ws.terminate();
    };
    
    pool.on('error', cleanup);
    pool.on('close', cleanup);
    ws.on('close', cleanup);
});