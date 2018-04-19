const path = require('path');
const solc = require('solc');
const fs = require('fs-extra');

// Get a full path to the build dir
const buildPath = path.resolve(__dirname, 'build');

// Remove the build dir (to flush the old version of the contracts)
fs.removeSync(buildPath);

// Compile the contracts
const campaignPath = path.resolve(__dirname, 'contracts', 'Request.sol');
const source = fs.readFileSync(campaignPath, 'utf8');
const output = solc.compile(source, 1).contracts;

// Create the build dir
fs.ensureDirSync(buildPath);

// Output the compiled versions of the contracts
for (let contract in output) {
    fs.outputJsonSync(
        path.resolve(buildPath, contract.replace(':', '') + '.json'),
        output[contract]
    );
}