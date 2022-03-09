var MainMock = artifacts.require("mocks/MainMock");
var BrokerMock = artifacts.require("mocks/BrokerMock");
var ERC20Mock = artifacts.require("mocks/ERC20Mock");
var MintFarming = artifacts.require("MintFarming");

var BigNumber = require("bignumber.js");
var time = require("ganache-time-traveler");

contract("main test", async function (accounts, network) {
    before(async function () {
        this.FOR = await ERC20Mock.new("Test FOR Token", "FOR", 18);
        this.KUN = await ERC20Mock.new("Test KUN Token", "KUN", 18);

        this.account0 = accounts[0];
        this.account1 = accounts[1];

        console.log("account0: ", this.account0);
        console.log("account1: ", this.account1);
        
        this.broker = await BrokerMock.new();
        this.main = await MainMock.new(this.broker.address);
    });

    afterEach(async function () {
        var mint = web3.utils.keccak256("mint");
        var burn = web3.utils.keccak256("burn");
        var open = web3.utils.keccak256("open");
        await this.broker.unsubscribe(this.mintfarming.address, this.main.address, mint);
        await this.broker.unsubscribe(this.mintfarming.address, this.main.address, burn);
        await this.broker.unsubscribe(this.mintfarming.address, this.main.address, open);
    });

    beforeEach(async function () {
        var mint = web3.utils.keccak256("mint");
        var burn = web3.utils.keccak256("burn");
        var open = web3.utils.keccak256("open");

        this.mintfarming = await MintFarming.new();
        await this.KUN.mint(this.mintfarming.address, web3.utils.toWei("9999999"));

        var block = await web3.eth.getBlock("latest");
        await this.mintfarming.initialize(this.account0, this.KUN.address, this.main.address);
        await this.mintfarming.notifyOpeningTime(block.timestamp);

        var onburn = web3.eth.abi.encodeFunctionSignature(
            "onburn(address,bytes32,bytes)"
        );
        var onmint = web3.eth.abi.encodeFunctionSignature(
            "onmint(address,bytes32,bytes)"
        );
        var onopen = web3.eth.abi.encodeFunctionSignature(
            "onopen(address,bytes32,bytes)"
        );

        await this.broker.subscribe(
            this.mintfarming.address,
            this.main.address,
            mint,
            onmint
        );
        await this.broker.subscribe(
            this.mintfarming.address,
            this.main.address,
            burn,
            onburn
        );
        await this.broker.subscribe(
            this.mintfarming.address,
            this.main.address,
            open,
            onopen
        );

        this.grade0 = web3.utils.keccak256("grade0");
        this.grade1 = web3.utils.keccak256("grade1");
        this.bound0 = { lower: "0", upper: BigNumber(1e9 * 1e18).toFixed() }; //(0, 100000000]
        this.bound1 = {
            lower: BigNumber(1e9 * 1e18).toFixed(),
            upper: BigNumber(3 * 1e9 * 1e18).toFixed(),
        }; //(100000000, 300000000]
        await this.mintfarming.addGrade(
            this.grade0,
            this.bound0.lower,
            this.bound0.upper
        );
        await this.mintfarming.addGrade(
            this.grade1,
            this.bound1.lower,
            this.bound1.upper
        );

        this.rewards0 = web3.eth.abi.encodeParameters(
            ["bytes32", "address", "uint256"],
            [this.grade0, this.FOR.address, web3.utils.toWei("6250")]
        );
        this.rewards1 = web3.eth.abi.encodeParameters(
            ["bytes32", "address", "uint256"],
            [this.grade1, this.FOR.address, web3.utils.toWei("3125")]
        );

        await this.mintfarming.setRewards([
            this.rewards0,
            this.rewards1,
        ]);
    });

    it("mintfarming.grade", async function () {
        var grades = await this.mintfarming.getGrades();
        assert.equal(grades.length, 2);

        var tokens = await this.mintfarming.getTokens();
        assert.equal(tokens.length, 1);

        var distributedRewards = await this.mintfarming.distributableRewards(
            this.grade0,
            this.FOR.address
        );
        assert.equal(distributedRewards, web3.utils.toWei("6250"));

        var distributedRewards = await this.mintfarming.distributableRewards(
            this.grade1,
            this.FOR.address
        );
        assert.equal(distributedRewards, web3.utils.toWei("3125"));

        await this.mintfarming.removeGrade(this.grade0);

        var tokens = await this.mintfarming.getTokens();
        assert.equal(tokens.length, 1);

        var grades = await this.mintfarming.getGrades();
        assert.equal(grades.length, 1);

        var distributedRewards = await this.mintfarming.distributableRewards(
            this.grade0,
            this.FOR.address
        );
        assert.equal(distributedRewards, web3.utils.toWei("0"));

        var distributedRewards = await this.mintfarming.distributableRewards(
            this.grade1,
            this.FOR.address
        );
        assert.equal(distributedRewards, web3.utils.toWei("3125"));

    });

    it("mintfarming.mint", async function () {
        await this.main.open(
            this.FOR.address,
            web3.utils.toWei("120"),
            web3.utils.toWei("100"),
            { from: this.account0 }
        );

        await this.main.open(
            this.FOR.address,
            web3.utils.toWei("120"),
            web3.utils.toWei("100"),
            { from: this.account1 }
        );

        var supply = await this.mintfarming.supply(this.account0, this.FOR.address);
        var totalSupplyOfToken = await this.mintfarming.supply(this.FOR.address);
        var gsupply = await this.mintfarming.totalSupply();

        assert.equal(supply, web3.utils.toWei("100"));
        assert.equal(totalSupplyOfToken, web3.utils.toWei("200"));
        assert.equal(gsupply, web3.utils.toWei("200"));

        var gradeAt = await this.mintfarming.gradeAt();
        assert.equal(gradeAt, this.grade0);

        var rewardRate = await this.mintfarming.rewardRates(this.FOR.address);
        //6250 * 1e18 / 86400
        assert.equal(rewardRate.toString(), "72337962962962962");

        var rewardPerTokenStored = await this.mintfarming.rewardPerTokenStored(
            this.FOR.address
        );
        console.log("rewardPerTokenStored: ", rewardPerTokenStored.toString());
        var userRewardPerTokenPaid = await this.mintfarming.userRewardPerTokenPaid(
            this.account0,
            this.FOR.address
        );
        console.log(
            "userRewardPerTokenPaid: ",
            userRewardPerTokenPaid.toString()
        );
        var rewards = await this.mintfarming.rewards(
            this.account0,
            this.FOR.address
        );
        console.log("rewards: ", rewards.toString());
        var lastUpdateTime = await this.mintfarming.lastUpdateTimePerToken(this.FOR.address);
        console.log("lastUpdateTime: ", lastUpdateTime.toString());
        var lastTimeRewardApplicable = await this.mintfarming.lastTimeRewardApplicable();
        console.log(
            "lastTimeRewardApplicable: ",
            lastTimeRewardApplicable.toString()
        );
        var rewardPerToken = await this.mintfarming.rewardPerToken(
            this.FOR.address
        );
        console.log("rewardPerToken: ", rewardPerToken.toString());
        var earned = await this.mintfarming.earned(
            this.account0,
            this.FOR.address
        );
        console.log("earned: ", earned.toString());

        await time.advanceTimeAndBlock(15552000);
        console.log("advanceTime ================> 15552000s");

        var rewardPerTokenStored = await this.mintfarming.rewardPerTokenStored(
            this.FOR.address
        );
        console.log("rewardPerTokenStored: ", rewardPerTokenStored.toString());
        var userRewardPerTokenPaid = await this.mintfarming.userRewardPerTokenPaid(
            this.account0,
            this.FOR.address
        );
        console.log(
            "userRewardPerTokenPaid: ",
            userRewardPerTokenPaid.toString()
        );
        var rewards = await this.mintfarming.rewards(
            this.account0,
            this.FOR.address
        );
        console.log("rewards: ", rewards.toString());
        var lastUpdateTime = await this.mintfarming.lastUpdateTimePerToken(this.FOR.address);
        console.log("lastUpdateTime: ", lastUpdateTime.toString());
        var lastTimeRewardApplicable = await this.mintfarming.lastTimeRewardApplicable();
        console.log(
            "lastTimeRewardApplicable: ",
            lastTimeRewardApplicable.toString()
        );
        var rewardPerToken = await this.mintfarming.rewardPerToken(
            this.FOR.address
        );
        console.log("rewardPerToken: ", rewardPerToken.toString());
        var earned = await this.mintfarming.earned(
            this.account0,
            this.FOR.address
        );
        console.log("account0 earned: ", earned.toString());

        var earned = await this.mintfarming.earned(
            this.account1,
            this.FOR.address
        );
        console.log("account1 earned: ", earned.toString());

        await this.main.burn(this.FOR.address, web3.utils.toWei("100"), {from: this.account0});
        await this.main.burn(this.FOR.address, web3.utils.toWei("100"), {from: this.account1});
    });

    it("mintfarming.mint2", async function () {
        await this.main.mint(this.FOR.address, web3.utils.toWei("100"), { from: this.account0 });

        var supply = await this.mintfarming.supply(this.account0, this.FOR.address);
        var totalSupplyOfToken = await this.mintfarming.supply(this.FOR.address);
        var gsupply = await this.mintfarming.totalSupply();

        assert.equal(supply, web3.utils.toWei("100"));
        assert.equal(totalSupplyOfToken, web3.utils.toWei("100"));
        assert.equal(gsupply, web3.utils.toWei("100"));

        var gradeAt = await this.mintfarming.gradeAt();
        assert.equal(gradeAt, this.grade0);

        var rewardRate = await this.mintfarming.rewardRates(this.FOR.address);
        //6250 * 1e18 / 86400
        assert.equal(rewardRate.toString(), "72337962962962962");

        var lastUpdateTime = await this.mintfarming.lastUpdateTimePerToken(this.FOR.address);
        console.log("lastUpdateTime: ", lastUpdateTime.toString());
        var lastTimeRewardApplicable = await this.mintfarming.lastTimeRewardApplicable();
        console.log(
            "lastTimeRewardApplicable: ",
            lastTimeRewardApplicable.toString()
        );

        var rewards0 = await this.mintfarming.rewards(
            this.account0,
            this.FOR.address
        );
        console.log("rewards0: ", rewards0.toString());

        var rewards1 = await this.mintfarming.rewards(
            this.account1,
            this.FOR.address
        );
        console.log("rewards1: ", rewards1.toString());

        var earned0 = await this.mintfarming.earned(
            this.account0,
            this.FOR.address
        );
        console.log("account0 earned: ", earned0.toString());

        var earned1 = await this.mintfarming.earned(
            this.account1,
            this.FOR.address
        );
        console.log("account1 earned: ", earned1.toString());

        await time.advanceTimeAndBlock(90 * 86400);
        console.log("advanceTime ====================> (90 * 86400) s");


        var lastUpdateTime = await this.mintfarming.lastUpdateTimePerToken(this.FOR.address);
        console.log("lastUpdateTime: ", lastUpdateTime.toString());
        var lastTimeRewardApplicable = await this.mintfarming.lastTimeRewardApplicable();
        console.log(
            "lastTimeRewardApplicable: ",
            lastTimeRewardApplicable.toString()
        );

        var rewardPerTokenStored = await this.mintfarming.rewardPerTokenStored(
            this.FOR.address
        );
        console.log("rewardPerTokenStored: ", rewardPerTokenStored.toString());
        var userRewardPerTokenPaid0 = await this.mintfarming.userRewardPerTokenPaid(
            this.account0,
            this.FOR.address
        );
        console.log(
            "userRewardPerTokenPaid0: ",
            userRewardPerTokenPaid0.toString()
        );
        var userRewardPerTokenPaid1 = await this.mintfarming.userRewardPerTokenPaid(
            this.account1,
            this.FOR.address
        );
        console.log(
            "userRewardPerTokenPaid1: ",
            userRewardPerTokenPaid1.toString()
        );

        var rewardPerToken = await this.mintfarming.rewardPerToken(
            this.FOR.address
        );
        console.log("rewardPerToken: ", rewardPerToken.toString());

        var rewards0 = await this.mintfarming.rewards(
            this.account0,
            this.FOR.address
        );
        console.log("rewards0: ", rewards0.toString());

        var rewards1 = await this.mintfarming.rewards(
            this.account1,
            this.FOR.address
        );
        console.log("rewards1: ", rewards1.toString());

        console.log("mint ====================> 100");

        await this.main.mint(this.FOR.address, web3.utils.toWei("100"), { from: this.account1 });

        var supply = await this.mintfarming.supply(this.account1, this.FOR.address);
        var totalSupplyOfToken = await this.mintfarming.supply(this.FOR.address);
        var gsupply = await this.mintfarming.totalSupply();

        assert.equal(supply, web3.utils.toWei("100"));
        assert.equal(totalSupplyOfToken, web3.utils.toWei("200"));
        assert.equal(gsupply, web3.utils.toWei("200"));

        var lastUpdateTime = await this.mintfarming.lastUpdateTimePerToken(this.FOR.address);
        console.log("lastUpdateTime: ", lastUpdateTime.toString());
        var lastTimeRewardApplicable = await this.mintfarming.lastTimeRewardApplicable();
        console.log(
            "lastTimeRewardApplicable: ",
            lastTimeRewardApplicable.toString()
        );

        var rewardPerTokenStored = await this.mintfarming.rewardPerTokenStored(
            this.FOR.address
        );
        console.log("rewardPerTokenStored: ", rewardPerTokenStored.toString());
        var userRewardPerTokenPaid0 = await this.mintfarming.userRewardPerTokenPaid(
            this.account0,
            this.FOR.address
        );
        console.log(
            "userRewardPerTokenPaid0: ",
            userRewardPerTokenPaid0.toString()
        );
        var userRewardPerTokenPaid1 = await this.mintfarming.userRewardPerTokenPaid(
            this.account1,
            this.FOR.address
        );
        console.log(
            "userRewardPerTokenPaid1: ",
            userRewardPerTokenPaid1.toString()
        );

        var rewardPerToken = await this.mintfarming.rewardPerToken(
            this.FOR.address
        );
        console.log("rewardPerToken: ", rewardPerToken.toString());

        var rewards0 = await this.mintfarming.rewards(
            this.account0,
            this.FOR.address
        );
        console.log("rewards0: ", rewards0.toString());

        var rewards1 = await this.mintfarming.rewards(
            this.account1,
            this.FOR.address
        );
        console.log("rewards1: ", rewards1.toString());


        var earned0 = await this.mintfarming.earned(
            this.account0,
            this.FOR.address
        );
        console.log("account0 earned: ", earned0.toString());

        var earned1 = await this.mintfarming.earned(
            this.account1,
            this.FOR.address
        );
        console.log("account1 earned: ", earned1.toString());

        await time.advanceTimeAndBlock(90 * 86400);
        console.log("advanceTime ====================> (90 * 86400) s");

        var lastUpdateTime = await this.mintfarming.lastUpdateTimePerToken(this.FOR.address);
        console.log("lastUpdateTime: ", lastUpdateTime.toString());
        var lastTimeRewardApplicable = await this.mintfarming.lastTimeRewardApplicable();
        console.log(
            "lastTimeRewardApplicable: ",
            lastTimeRewardApplicable.toString()
        );
        var rewardPerToken = await this.mintfarming.rewardPerToken(
            this.FOR.address
        );

        console.log("rewardPerToken: ", rewardPerToken.toString());
        var earned0 = await this.mintfarming.earned(
            this.account0,
            this.FOR.address
        );
        console.log("account0 earned: ", earned0.toString());

        var earned1 = await this.mintfarming.earned(
            this.account1,
            this.FOR.address
        );
        console.log("account1 earned: ", earned1.toString());

        await this.main.burn(this.FOR.address, web3.utils.toWei("100"), {from: this.account0});
        await this.main.burn(this.FOR.address, web3.utils.toWei("100"), {from: this.account1});

        await this.mintfarming.getReward({from: this.account0});
        await this.mintfarming.getReward({from: this.account1});
        
        var claimedRewards0 = await this.mintfarming.claimedRewards(this.account0);
        console.log("claimedRewards0: ", claimedRewards0.toString());
        var claimedRewards1 = await this.mintfarming.claimedRewards(this.account1);
        console.log("claimedRewards1: ", claimedRewards1.toString());
        var totalClaimedReward = await this.mintfarming.totalClaimedReward();
        console.log("totalClaimedReward: ", totalClaimedReward.toString());
    });
});
