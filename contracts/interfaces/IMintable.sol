pragma solidity 0.6.2;

interface IMintable {
    function mint(address who, uint256 supply) external;
}