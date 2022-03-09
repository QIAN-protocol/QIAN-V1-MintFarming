var { deployProxy, admin } = require("@openzeppelin/truffle-upgrades");
var MintFarming = artifacts.require("MintFarming");
var Msign = artifacts.require("Msign");
var IBroker = artifacts.require("IBroker");
var helper = require("./deployhelper");

module.exports = async function (deployer, network) {
    network = /([a-z]+)(-fork)?/.exec(network)[1];
    if (network == "test") return;

    var deployenv = helper.deployenv;

    helper.logger.write(`${__filename}\n`);

    await deployer.deploy(
        Msign,
        deployenv.msign.threshold,
        deployenv.msign.signers
    );

    var mintfarming = await deployProxy(
        MintFarming,
        [deployenv.governance, deployenv.kun, deployenv.main, deployenv.broker],
        {
            deployer: deployer,
            unsafeAllowCustomTypes: true,
        }
    );

    await admin.transferProxyAdminOwnership(Msign.address);

    var mint = web3.utils.keccak256("mint");
    var burn = web3.utils.keccak256("burn");
    var open = web3.utils.keccak256("open");

    var onburn = web3.eth.abi.encodeFunctionSignature(
        "onburn(address,bytes32,bytes)"
    );
    var onmint = web3.eth.abi.encodeFunctionSignature(
        "onmint(address,bytes32,bytes)"
    );
    var onopen = web3.eth.abi.encodeFunctionSignature(
        "onopen(address,bytes32,bytes)"
    );

    var broker = await IBroker.at(deployenv.broker);

    helper.logger.write(
        `broker.subscribe(${mintfarming.address}, ${deployenv.main}, ${mint}, ${onmint})\n`
    );
    await broker.subscribe(mintfarming.address, deployenv.main, mint, onmint);

    helper.logger.write(
        `broker.subscribe(${mintfarming.address}, ${deployenv.main}, ${burn}, ${onburn})\n`
    );
    await broker.subscribe(mintfarming.address, deployenv.main, burn, onburn);

    helper.logger.write(
        `broker.subscribe(${mintfarming.address}, ${deployenv.main}, ${open}, ${onopen})\n`
    );
    await broker.subscribe(mintfarming.address, deployenv.main, open, onopen);

    helper.exporter.write(
        JSON.stringify(
            {
                Msign: Msign.address,
                MintFarming: MintFarming.address,
            },
            null,
            4
        )
    );
};
