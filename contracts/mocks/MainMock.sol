pragma solidity ^0.6.0;

import "../interfaces/IBroker.sol";

contract MainMock {
    address public broker;

    constructor(address _broker) public {
        broker = _broker;
    }

    function deposit(address token, uint256 reserve) public payable {
        IBroker(broker).publish(
            keccak256("deposit"),
            abi.encode(msg.sender, token, reserve)
        );
    }

    function withdraw(address token, uint256 reserve) public {
        IBroker(broker).publish(
            keccak256("withdraw"),
            abi.encode(msg.sender, token, reserve)
        );
    }

    //增发
    function mint(address token, uint256 supply) public {
        IBroker(broker).publish(
            keccak256("mint"),
            abi.encode(msg.sender, token, supply)
        );
    }

    //销毁
    function burn(address token, uint256 supply) public {
        IBroker(broker).publish(
            keccak256("burn"),
            abi.encode(msg.sender, token, supply)
        );
    }

    //开仓
    function open(
        address token, //deposit token
        uint256 reserve,
        uint256 supply
    ) public payable {
        IBroker(broker).publish(
            keccak256("open"),
            abi.encode(msg.sender, token, reserve, supply)
        );
    }
}
