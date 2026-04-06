const { execSync, spawn } = require('child_process')

console.log('Running database migrations...')
execSync('node node_modules/prisma/build/index.js migrate deploy', { stdio: 'inherit' })
console.log('Migrations done.')

// Start Hocuspocus WebSocket server
const hocus = spawn('node_modules/.bin/tsx', ['server/hocuspocus.ts'], { stdio: 'inherit' })
hocus.on('exit', (code) => console.error(`Hocuspocus exited with code ${code}`))

require('./server.js')
