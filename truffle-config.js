const HDWalletProvider = require("truffle-hdwallet-provider"); // eslint-disable-line

module.exports = {
    compilers: {
        solc: {
            version: "0.6.2",
            parser: "solcjs",
            settings: {
                optimizer: {
                    enabled: true,
                    runs: 200,
                },
                evmVersion: "istanbul",
            },
        },
    },
    networks: {
        main: {
            network_id: "1",
            provider: () =>
                new HDWalletProvider(
                    process.env.TRUFFLE_MAIN_DEPLOYER,
                    process.env.TRUFFLE_MAIN_PROVIDER
                ),
            gasPrice: 85000000000,
            gas: 9500000,
        },
        rinkeby: {
            network_id: "4",
            provider: () =>
                new HDWalletProvider(
                    process.env.TRUFFLE_RINKEBY_DEPLOYER,
                    process.env.TRUFFLE_RINKEBY_PROVIDER
                ),
            gasPrice: 50000000000, // gwei
            gas: 9500000,
        },
        bsctest: {
            network_id: "97",
            provider: () =>
                new HDWalletProvider(
                    process.env.TRUFFLE_BSCTEST_DEPLOYER,
                    process.env.TRUFFLE_BSCTEST_PROVIDER
                ),
            gasPrice: 20000000000, // gwei
            gas: 7500000,
        },
        bscmain: {
            network_id: "56",
            provider: () =>
                new HDWalletProvider(
                    process.env.TRUFFLE_BSCMAIN_DEPLOYER,
                    process.env.TRUFFLE_BSCMAIN_PROVIDER
                ),
            gasPrice: 20000000000, // gwei
            gas: 7500000,
        },
    },
    plugins: ["truffle-plugin-verify"],
    api_keys: {
        etherscan: process.env.ETHERSCAN_API_KEY,
    },
};
