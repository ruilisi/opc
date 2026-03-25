const { execSync } = require('child_process')

console.log('Running database migrations...')
execSync('node node_modules/prisma/build/index.js migrate deploy', { stdio: 'inherit' })
console.log('Migrations done.')

require('./server.js')
