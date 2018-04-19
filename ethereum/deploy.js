const HDWalletProvider = require('truffle-hdwallet-provider');
const Web3 = require('web3');
const compiledFactory = require('./build/RequestFactory');

const mnemonic = 'robbin bobin barabek skushal sorok chelovek garden weather hybrid alarm humble domain';

const provider = new HDWalletProvider(
    mnemonic,
    'https://rinkeby.infura.io/Pk7w5MsZp4kMqCEmmpad'
);

const web3 = new Web3(provider);

const deploy = async () => {
    const accounts = await web3.eth.getAccounts();

    const result = await new web3.eth.Contract(JSON.parse(compiledFactory.interface))
        .deploy({data: compiledFactory.bytecode, arguments: []})
        .send({'from': accounts[0], 'gas': '1000000'});

    console.log('Contract deployed to', result.options.address);
};

deploy();