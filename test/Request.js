const assert = require('assert');
const ganache = require('ganache-cli');
const Web3 = require('web3');
const web3 = new Web3(ganache.provider());

// A helper for time issues
const seconds = require('time-funcs/seconds');

// To change the time of the latest block
const backToTheFuture = (seconds) => {
    // Increase time
    const id = Date.now();

    return new Promise((resolve, reject) => {
        web3.currentProvider.sendAsync({
            jsonrpc: '2.0',
            method: 'evm_increaseTime',
            params: [seconds],
            id: id,
        }, err1 => {
            if (err1) return reject(err1);

            web3.currentProvider.sendAsync({
                jsonrpc: '2.0',
                method: 'evm_mine',
                id: id + 1,
            }, (err2, res) => {
                return err2 ? reject(err2) : resolve(res)
            })
        })
    });
};

const getBalance = async (address) => {
    let balance = await web3.eth.getBalance(address);

    return parseFloat(web3.utils.fromWei(balance, 'ether'));
};

// Get Factory' source code
const factorySource = require('../ethereum/build/RequestFactory');
const requestSource = require('../ethereum/build/Request');

let accounts;
let factory;
let request;
let requestOwner;
let blockTimestamp;

beforeEach(async () => {
    let requestAddress;

    // Get last block to fetch the timestamp
    const lastBlock = await web3.eth.getBlock('latest');

    blockTimestamp = lastBlock.timestamp;

    accounts = await web3.eth.getAccounts();

    requestOwner = accounts[1];

    // Deploy the factory before every test
    factory = await new web3.eth.Contract(JSON.parse(factorySource.interface))
        .deploy({data: factorySource.bytecode})
        .send({from: accounts[0], gas: '1000000'});

    await factory.methods.createRequest(
        'Test title',
        'Test description',
        web3.utils.toWei('1', 'ether'),
        blockTimestamp + seconds({hours: 1})
    ).send({
        from: requestOwner,
        gas: '1000000'
    });

    // Get deployed address
    [requestAddress] = await factory.methods.getRequests().call();

    request = await new web3.eth.Contract(
        JSON.parse(requestSource.interface),
        requestAddress
    );
});

describe('Requests testing', () => {
    it('Deploys a factory and an request', () => {
        // If the factory instance has an address
        assert.ok(factory.options.address);
        assert.ok(request.options.address);
    });

    describe('check params validation', () => {
        it('ExpiresAt should be in the future', async () => {
            try {
                await factory.methods.createRequest(
                    'Test title',
                    'Test description',
                    web3.utils.toWei('1', 'ether'),
                    blockTimestamp - seconds({hours: 1})
                ).send({
                    from: requestOwner,
                    gas: '1000000'
                });
            } catch (err) {
                assert(err);

                return;
            }

            // We shouldn't get here
            assert(false);
        });

        it('requiredAmount should be more than 0', async () => {
            try {
                await factory.methods.createRequest(
                    'Test title',
                    'Test description',
                    '0',
                    blockTimestamp + seconds({hours: 1})
                ).send({
                    from: requestOwner,
                    gas: '1000000'
                });
            } catch (err) {
                assert(err);

                return;
            }

            // We shouldn't get here
            assert(false);
        });
    });

    describe('check dynamic getters', () => {
        it('implements the hasReachedLimit method in the right way', async () => {
            const contributor = accounts[2];

            let reachedLimit = await request.methods.hasReachedLimit()
                .call({from: requestOwner});

            assert.equal(reachedLimit, false);

            await request.methods.donate().send({
                from: contributor,
                value: web3.utils.toWei('10', 'ether'),
                gas: '1000000'
            });

            reachedLimit = await request.methods.hasReachedLimit()
                .call({from: requestOwner});

            assert.equal(reachedLimit, true);
        });

        it('implements the hasExpired method in the right way', async () => {
            let hasExpired;

            hasExpired = await request.methods.hasExpired()
                .call({from: requestOwner});

            assert.equal(hasExpired, false);

            await backToTheFuture(seconds({days: 1}));

            hasExpired = await request.methods.hasExpired()
                .call({from: requestOwner});

            assert.equal(hasExpired, true);
        });
    });

    describe('check eth donating', () => {
        it('should be able to take donations when the request has not expired and the limit has not been reached yet', async () => {
            const contributor = accounts[2];

            await request.methods.donate().send({
                from: contributor,
                value: web3.utils.toWei('0.5', 'ether'),
                gas: '1000000'
            });
        });

        it('should not be able to take donations when the request has expired', async () => {
            const contributor = accounts[2];

            await backToTheFuture(seconds({days: 1}));

            try {
                await request.methods.donate().send({
                    from: contributor,
                    value: web3.utils.toWei('0.5', 'ether'),
                    gas: '1000000'
                });
            } catch (err) {
                assert(err);

                return;
            }

            assert(false);
        });

        it('should not be able to take donations when the limit has been reached', async () => {
            const contributor = accounts[2];

            await request.methods.donate().send({
                from: accounts[3],
                value: web3.utils.toWei('2', 'ether'),
                gas: '1000000'
            });

            try {
                await request.methods.donate().send({
                    from: contributor,
                    value: web3.utils.toWei('0.5', 'ether'),
                    gas: '1000000'
                });
            } catch (err) {
                assert(err);

                return;
            }

            assert(false);
        });
    });

    describe('check money refund', () => {
        it('should not be able to call the refund function if the contributor is not in the patrons list', async () => {
            const contributor = accounts[2];

            try {
                await request.methods.refund().send({
                    from: contributor,
                    gas: '1000000'
                });
            } catch (err) {
                assert(err);

                return;
            }

            assert(false);
        });

        it('should not be able to refund his money if the request has reached the limit', async () => {
            const contributor = accounts[2];

            // Donate a little bit of money
            await request.methods.donate().send({
                from: contributor,
                value: web3.utils.toWei('0.5', 'ether'),
                gas: '1000000'
            });

            // Make another donation
            await request.methods.donate().send({
                from: accounts[3],
                value: web3.utils.toWei('1.5', 'ether'),
                gas: '1000000'
            });


            try {

                await request.methods.refund().send({
                    from: contributor,
                    gas: '1000000'
                });
            } catch (err) {
                assert(err);

                return;
            }

            assert(false);
        });

        it('should not be able to refund his money if the request has not expired yet', async () => {
            const contributor = accounts[2];

            // Donate a little bit of money
            await request.methods.donate().send({
                from: contributor,
                value: web3.utils.toWei('0.5', 'ether'),
                gas: '1000000'
            });


            try {
                await request.methods.refund().send({
                    from: contributor,
                    gas: '1000000'
                });
            } catch (err) {
                assert(err);

                return;
            }

            assert(false);
        });

        it('should be able to refund his money if everything is OK', async () => {
            const contributor = accounts[2];

            // Donate a little bit of money
            await request.methods.donate().send({
                from: contributor,
                value: web3.utils.toWei('0.5', 'ether'),
                gas: '1000000'
            });

            await backToTheFuture(seconds({days: 1}));

            const balanceBefore = await getBalance(contributor);

            await request.methods.refund().send({
                from: contributor,
                gas: '1000000'
            });

            const balanceAfter = await getBalance(contributor);

            assert(balanceAfter > balanceBefore + 0.4);
        });
    });

    describe('check money receiving', () => {
        it('should not be able to receive the money if that is not the owner', async () => {
            const contributor = accounts[2];

            // Donate some little amount
            await request.methods.donate().send({
                from: contributor,
                value: web3.utils.toWei('1.3', 'ether'),
                gas: '1000000'
            });

            try {
                await request.methods.getMoney().send({
                    from: accounts[3],
                    gas: '1000000'
                });
            } catch (err) {
                assert(err);

                return;
            }

            assert(false);
        });

        it('should not be able to receive the money until the limit has been reached', async () => {
            const contributor = accounts[2];

            // Donate some little amount
            await request.methods.donate().send({
                from: contributor,
                value: web3.utils.toWei('0.3', 'ether'),
                gas: '1000000'
            });

            try {
                await request.methods.getMoney().send({
                    from: requestOwner,
                    gas: '1000000'
                });
            } catch (err) {
                assert(err);

                return;
            }

            assert(false);
        });

        it('should be able to receive the money when the limit has been reached', async () => {
            const contributor = accounts[2];

            // Donate the required sum (even more)
            await request.methods.donate().send({
                from: contributor,
                value: web3.utils.toWei('1.5', 'ether'),
                gas: '1000000'
            });

            const balanceBefore = await getBalance(requestOwner);

            await request.methods.getMoney().send({
                from: requestOwner,
                gas: '1000000'
            });

            const balanceAfter = await getBalance(requestOwner);

            assert(balanceAfter > balanceBefore + 1);
        });
    });

});

