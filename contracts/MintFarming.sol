/**
 *Submitted for verification at Etherscan.io on 2020-07-21
 */
/*
   ____            __   __        __   _
  / __/__ __ ___  / /_ / /  ___  / /_ (_)__ __
 _\ \ / // // _ \/ __// _ \/ -_)/ __// / \ \ /
/___/ \_, //_//_/\__//_//_/\__/ \__//_/ /_\_\
     /___/

* Synthetix: YFIRewards.sol
*
* Docs: https://docs.synthetix.io/
*
*
* MIT License
* ===========
*
* Copyright (c) 2020 Synthetix
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
*/

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";

import "./interfaces/IMintable.sol";
import "./lib/VersionedInitializable.sol";

pragma solidity 0.6.2;
pragma experimental ABIEncoderV2;

contract EventHandler {
    using SafeMath for uint256;

    uint256 private _totalSupply;
    mapping(address => mapping(address => uint256)) private _supply;
    mapping(address => uint256) private _tokenTotalSupply;

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function supply(address account, address token)
        public
        view
        returns (uint256)
    {
        return _supply[account][token];
    }

    function supply(address token) public view returns (uint256) {
        return _tokenTotalSupply[token];
    }

    function _mint(
        address account,
        address token,
        uint256 amount
    ) internal {
        _totalSupply = _totalSupply.add(amount);
        _supply[account][token] = _supply[account][token].add(amount);
        _tokenTotalSupply[token] = _tokenTotalSupply[token].add(amount);
    }

    function _burn(
        address account,
        address token,
        uint256 amount
    ) internal {
        _totalSupply = _totalSupply.sub(amount);
        _supply[account][token] = _supply[account][token].sub(amount);
        _tokenTotalSupply[token] = _tokenTotalSupply[token].sub(amount);
    }
}

contract MintFarming is EventHandler, VersionedInitializable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;

    event UpdateRewardRate(address token, bytes32 grade, uint256 rewardRates);
    event RewardPaid(address indexed user, uint256 reward);
    event Mint(address indexed user, address indexed token, uint256 supply);
    event Burn(address indexed user, address indexed token, uint256 supply);

    function getRevision() internal override pure returns (uint256) {
        return uint256(0x1);
    }

    address public governance;

    modifier onlyGovernance {
        require(msg.sender == governance, "!governance");
        _;
    }

    function setGovernance(address _governance) public onlyGovernance {
        governance = _governance;
    }

    /* Fees breaker, to protect withdraws if anything ever goes wrong */
    bool public breaker;

    function seize(address token, uint256 amount) external onlyGovernance {
        IERC20(token).safeTransfer(governance, amount);
    }

    function setBreaker(bool _breaker) external onlyGovernance {
        breaker = _breaker;
    }

    /** rewards configure */

    struct Bound {
        uint256 lower;
        uint256 upper;
    }

    //reward distribution
    mapping(bytes32 => mapping(address => uint256)) public distributableRewards; //grade => token => reward/day
    mapping(bytes32 => Bound) public gradeBounds;

    EnumerableSet.UintSet private _grades;
    EnumerableSet.AddressSet private _tokens;

    function addGrade(
        bytes32 grade,
        uint256 lower,
        uint256 upper
    ) public onlyGovernance {
        _grades.add(uint256(grade));
        gradeBounds[grade] = Bound(lower, upper);
    }

    function removeGrade(bytes32 grade) public onlyGovernance {
        uint256 length = _tokens.length();
        for (uint256 i = 0; i < length; ++i) {
            delete distributableRewards[grade][_tokens.at(i)];
        }
        _grades.remove(uint256(grade));
        delete gradeBounds[grade];
    }

    //[].push(abi.encode(grade, token, amount))
    function setRewards(bytes[] memory rewards) public onlyGovernance {
        uint256 length = rewards.length;
        for (uint256 i = 0; i < length; ++i) {
            (bytes32 _grade, address _token, uint256 _amount) = abi.decode(
                rewards[i],
                (bytes32, address, uint256)
            );
            require(_grades.contains(uint256(_grade)), "unknown grade");
            distributableRewards[_grade][_token] = _amount;
            _tokens.add(_token);
        }
    }
    
    function getTokens() public view returns (address[] memory) {
        uint256 length = _tokens.length();
        address[] memory result = new address[](length);
        for (uint256 i = 0; i < length; ++i) {
            result[i] = _tokens.at(i);
        }
        return result;
    }

    function getGrades() public view returns (bytes32[] memory) {
        uint256 length = _grades.length();
        bytes32[] memory result = new bytes32[](length);
        for (uint256 i = 0; i < length; ++i) {
            result[i] = bytes32(_grades.at(i));
        }
        return result;
    }

    function gradeAt() public view returns (bytes32) {
        if (totalSupply() == 0) return bytes32(0);
        uint256 length = _grades.length();
        for (uint256 i = 0; i < length; ++i) {
            bytes32 grade = bytes32(_grades.at(i));
            Bound memory r = gradeBounds[grade];
            if (totalSupply() > r.lower && totalSupply() <= r.upper) {
                // (x, y]
                return grade;
            }
        }
        return bytes32(0);
    }

    /** rewards update */

    uint256 public constant DURATION = 180 days;

    address public kun;
    address public main;
    address public broker;

    uint256 public closingTime;
    uint256 public openingTime;

    mapping(address => uint256) public lastUpdateTimePerToken;
    mapping(address => uint256) public rewardRates; //token => rewardRate;
    mapping(address => uint256) public rewardPerTokenStored; //token => rewardPerTokenStored
    mapping(address => mapping(address => uint256))
        public userRewardPerTokenPaid; //account => token => userRewardPerTokenPaid
    mapping(address => mapping(address => uint256)) public rewards; //account => token => amount
    mapping(address => uint256) public claimedRewards; //account => amount
    uint256 public totalClaimedReward;

    modifier updateReward(address account, address token) {
        rewardPerTokenStored[token] = rewardPerToken(token);
        lastUpdateTimePerToken[token] = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account][token] = earned(account, token);
            userRewardPerTokenPaid[account][token] = rewardPerTokenStored[token];
        }
        _;
    }

    function initialize(
        address _governance,
        address _kun,
        address _main,
        address _broker
    ) public initializer {
        governance = _governance;
        kun = _kun;
        main = _main;
        broker = _broker;
    }

    function notifyOpeningTime(uint256 _openingTime) public onlyGovernance {
        require(openingTime == 0, "duplicated notifyOpeningTime");
        openingTime = _openingTime;
        closingTime = openingTime.add(DURATION);
        uint256 length = _tokens.length();
        for (uint256 i = 0; i < length; ++i) {
            lastUpdateTimePerToken[_tokens.at(i)] = openingTime;
        }
    }

    function setClosingTime(uint256 newClosingTime) public onlyGovernance {
        require(newClosingTime > block.timestamp, "Bad newClosingTime");
        closingTime = newClosingTime;
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return Math.min(block.timestamp, closingTime);
    }

    function rewardPerToken(address token) public view returns (uint256) {
        if (supply(token) == 0) return rewardPerTokenStored[token];
        return
            rewardPerTokenStored[token].add(
                lastTimeRewardApplicable()
                    .sub(lastUpdateTimePerToken[token])
                    .mul(rewardRates[token])
                    .mul(1e18)
                    .div(supply(token))
            );
    }

    function earned(address account, address token)
        public
        view
        returns (uint256)
    {
        return
            supply(account, token)
                .mul(
                rewardPerToken(token).sub(
                    userRewardPerTokenPaid[account][token]
                )
            )
                .div(1e18)
                .add(rewards[account][token]);
    }

    function totalEarned(address account) public view returns (uint256) {
        uint256 _totalEarned = 0;
        uint256 length = _tokens.length();
        for (uint256 i = 0; i < length; ++i) {
            _totalEarned = _totalEarned.add(earned(account, _tokens.at(i)));
        }
        return _totalEarned;
    }

    /** event handlers */

    function onmint(
        address publisher, //publisher
        bytes32 topic, //topic
        bytes memory data
    ) public {
        require(msg.sender == broker, "only broker");
        require(publisher == main, "unsubscribed publisher");
        require(topic == keccak256("mint"), "only topic: mint");

        (address _owner, address _token, uint256 _supply) = abi.decode(
            data,
            (address, address, uint256)
        );

        if (!_tokens.contains(_token)) return;
        if (block.timestamp < openingTime || block.timestamp > closingTime)
            return;
        mint(_owner, _token, _supply);
    }

    function onopen(
        address publisher, //publisher
        bytes32 topic, //topic
        bytes memory data
    ) public {
        require(msg.sender == broker, "only broker");
        require(publisher == main, "unsubscribed publisher");
        require(topic == keccak256("open"), "only topic: mint");

        (address _owner, address _token, , uint256 _supply) = abi.decode(
            data,
            (address, address, uint256, uint256)
        );

        if (!_tokens.contains(_token)) return;
        if (block.timestamp < openingTime || block.timestamp > closingTime)
            return;

        mint(_owner, _token, _supply);
    }

    function onburn(
        address publisher, //publisher
        bytes32 topic, //topic
        bytes memory data
    ) public {
        require(msg.sender == broker, "only broker");
        require(publisher == main, "unsubscribed publisher");
        require(topic == keccak256("burn"), "only topic: burn");

        (address _owner, address _token, uint256 _supply) = abi.decode(
            data,
            (address, address, uint256)
        );

        if (!_tokens.contains(_token)) return;
        uint256 burnAmount = Math.min(_supply, supply(_owner, _token));
        if (burnAmount != 0) {
            burn(_owner, _token, burnAmount);
        }
    }

    function getReward() public {
        require(openingTime != 0, "!notifyOpeningTime");
        uint256 length = _tokens.length();
        for (uint256 i = 0; i < length; ++i) {
            getReward(_tokens.at(i));
        }
    }

    /** internal function */

    function burn(
        address account,
        address token,
        uint256 supply
    ) internal updateReward(account, token) {
        _burn(account, token, supply);
        updateRewardRate(token);
        emit Burn(account, token, supply);
    }

    function mint(
        address account,
        address token,
        uint256 supply
    ) internal updateReward(account, token) {
        _mint(account, token, supply);
        updateRewardRate(token);
        emit Mint(account, token, supply);
    }

    function getReward(address token) internal updateReward(msg.sender, token) {
        uint256 reward = earned(msg.sender, token);
        if (reward > 0) {
            rewards[msg.sender][token] = 0;
            IMintable(kun).mint(msg.sender, reward);
            claimedRewards[msg.sender] = claimedRewards[msg.sender].add(reward);
            totalClaimedReward = totalClaimedReward.add(reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    function updateRewardRate(address token) internal {
        bytes32 grade = gradeAt();
        rewardRates[token] = distributableRewards[grade][token].div(86400);
        emit UpdateRewardRate(token, grade, rewardRates[token]);
    }
}
