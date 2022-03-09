var MintFarming = artifacts.require("MintFarming");
var BigNumber = require("bignumber.js");
var helper = require("./deployhelper");

module.exports = async function (deployer, network) {
    network = /([a-z]+)(-fork)?/.exec(network)[1];
    if (network == "test") return;

    helper.logger.write(`${__filename}\n`);

    var deployenv = helper.deployenv;

    var mintfarming = await MintFarming.deployed();

    var grades = deployenv.grades;
    var bound = deployenv.bound;
    var tokens = deployenv.tokens;
    var rewards = deployenv.rewards;

    for (let i = 0; i < bound.length; ++i) {
        let grade = grades[bound[i].grade];
        let lower = BigNumber(bound[i].lower).toFixed();
        let upper = BigNumber(bound[i].upper).toFixed();
        helper.logger.write(`mintfarming.addGrade(${grade}, ${lower}, ${upper})\n`);
        await mintfarming.addGrade(grade, lower, upper);
    }

    for (let i = 0; i < rewards.length; ++i) {
        let token = tokens[rewards[i].token];
        let rewgrades = rewards[i].grades;
        let results = [];
        for (let j = 0; j < rewgrades.length; ++j) {
            let grade = grades[rewgrades[j].grade];
            let reward = rewgrades[j].reward;
            helper.logger.write(`mintfarming.setRewards(grade: ${grade}, token: ${token}, reward: ${reward})\n`);
            results.push(
                web3.eth.abi.encodeParameters(
                    ["bytes32", "address", "uint256"],
                    [grade, token, reward]
                )
            );
        }
        await mintfarming.setRewards(results);
    }
};
