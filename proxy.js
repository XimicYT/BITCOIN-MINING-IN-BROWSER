/* NETGRID // POOL HOPPER BRIDGE */
const WebSocket = require('ws');
const net = require('net');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

// ---------------------------------------------------------
// DIRECT IP LIST (Bypasses Main Server DNS & Firewall)
// ---------------------------------------------------------
const POOL_LIST = [
    { host: '51.15.127.80',   port: 2812, name: "Europe (Direct)" },      // Often most reliable
    { host: '162.55.103.174', port: 2811, name: "Community Node 1" },
    { host: '51.159.175.20',  port: 2812, name: "Community Node 2" },
    { host: 'magi.duinocoin.com', port: 2811, name: "Magi Pool" },        // Alternate DNS
    { host: 'server.duinocoin.com', port: 2812, name: "Main Server (Port 2812)" } // Try alt port
];

console.log(`[NETGRID] POOL HOPPER ACTIVE ON PORT ${PORT}`);

wss.on('connection', (ws) => {
    console.log('[CLIENT] Browser Connected. Starting Pool Search...');

    let poolSocket = new net.Socket();
    let currentPoolIndex = 0;
    let connected = false;

    // Function to try the next pool in the list
    const tryNextPool = () => {
        if (connected) return;
        if (currentPoolIndex >= POOL_LIST.length) {
            console.log('[ERROR] All pools failed. Closing client.');
            ws.send('ERR: ALL_POOLS_BLOCKED');
            ws.close();
            return;
        }

        const pool = POOL_LIST[currentPoolIndex];
        console.log(`[STRATEGY] Trying Pool ${currentPoolIndex + 1}/${POOL_LIST.length}: ${pool.name} (${pool.host})`);

        // Destroy old socket if it exists to clear previous attempt
        poolSocket.destroy();
        poolSocket = new net.Socket();
        poolSocket.setEncoding('utf8');
        poolSocket.setTimeout(5000); // 5 second timeout per pool

        poolSocket.connect(pool.port, pool.host, () => {
            console.log(`[SUCCESS] Connected to ${pool.name}!`);
            connected = true;
            // Setup regular listeners now that we are connected
            setupListeners();
        });

        poolSocket.on('error', (err) => {
            if (!connected) {
                console.log(`[FAIL] ${pool.name} failed: ${err.message}`);
                currentPoolIndex++;
                tryNextPool();
            }
        });

        poolSocket.on('timeout', () => {
            if (!connected) {
                console.log(`[FAIL] ${pool.name} timed out.`);
                currentPoolIndex++;
                tryNextPool();
            }
        });
    };

    // Listeners for data/messaging (Only active after successful connect)
    const setupListeners = () => {
        poolSocket.on('data', (data) => {
            if (data.toString().includes('.')) console.log(`[POOL SAYS] ${data.toString().trim()}`);
            ws.send(data.toString());
        });

        ws.on('message', (msg) => {
            poolSocket.write(msg.toString().trim() + '\n');
        });

        poolSocket.on('close', () => {
            console.log('[POOL] Connection lost.');
            ws.close();
        });
        
        ws.on('close', () => {
            poolSocket.destroy();
        });
    };

    // Kick off the search
    tryNextPool();
});