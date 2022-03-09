pragma solidity 0.6.2;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/EnumerableSet.sol";

contract Msign {
    using EnumerableSet for EnumerableSet.AddressSet;

    event Activate(address indexed sender, bytes32 id);
    event Execute(address indexed sender, bytes32 id);
    event Sign(address indexed sender, bytes32 id);
    event EnableSigner(address indexed sender, address indexed account);
    event DisableSigner(address indexed sender, address indexed account);
    event SetThreshold(address indexed sender, uint256 previousThreshold, uint256 newThreshold);

    struct proposal_t {
        address code;
        bytes   data;
        bool done;
        mapping(address => uint256) signers;
    }

    mapping(bytes32 => proposal_t) public proposals;
    EnumerableSet.AddressSet private _signers;
    uint256 public threshold;

    constructor(uint256 _threshold, address[] memory _accounts) public {
        uint256 _length = _accounts.length;
        require(_length >= 1, "Msign.constructor.EID00085");
        require(_threshold >= 1 && _threshold <= _length, "Msign.constructor.EID00089");
        threshold = _threshold;
        for (uint256 i = 0; i < _length; ++i) {
            require(_signers.add(_accounts[i]), "Msign.constructor.EID00015");
        }
    }

    modifier onlySelf() {
        require(msg.sender == address(this), "Msign.onlySelf.EID00001");
        _;
    }

    modifier onlySigner() {
        require(_signers.contains(msg.sender), "Msign.onlySigner.EID00082");
        _;
    }

    modifier onlyMulsign(bytes32 id) {
        require(getMulsignWeight(id) >= threshold, "Msign.onlyMulsign.EID00083");
        _;
    }

    function getHash(address code, bytes memory data)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(code, data));
    }

    function activate(address code, bytes memory data)
        public
        onlySigner
        returns (bytes32)
    {
        require(code != address(0), "Msign.activate.code.EID00090");
        require(data.length >= 4, "Msign.activate.data.EID00090");
        bytes32 _hash = getHash(code, data);
        proposals[_hash].code = code;
        proposals[_hash].data = data;
        emit Activate(msg.sender, _hash);
        return _hash;
    }

    function execute(bytes32 id)
        public
        onlyMulsign(id)
        returns (bool success, bytes memory result)
    {
        require(!proposals[id].done, "Msign.execute.EID00022");
        proposals[id].done = true;
        (success, result) = proposals[id].code.call(proposals[id].data);
        require(success, "Msign.execute.EID00020");
        emit Execute(msg.sender, id);
    }

    function sign(bytes32 id) public onlySigner {
        require(proposals[id].signers[msg.sender] == 0, "Msign.sign.EID00084");
        require(!proposals[id].done, "Msign.sign.EID00079");
        proposals[id].signers[msg.sender] = 1;
        emit Sign(msg.sender, id);
    }

    function enableSigner(address account) public onlySelf {
        require(_signers.add(account), "Msign.enable.EID00015");
        emit EnableSigner(msg.sender, account);
    }

    function disableSigner(address account) public onlySelf {
        require(_signers.remove(account), "Msign.disable.EID00016");
        require(_signers.length() >= 1, "Msign.disable.EID00085");
        emit DisableSigner(msg.sender, account);
    }

    function setThreshold(uint256 _threshold) public onlySelf {
        require(_threshold >= 1 && _threshold <= _signers.length(), "Msign.assign.EID00089");
        emit SetThreshold(msg.sender, threshold, _threshold);
        threshold = _threshold;
        
    }

    function getMulsignWeight(bytes32 id) public view returns (uint256) {
        uint256 _weights = 0;
        for (uint256 i = 0; i < _signers.length(); ++i) {
            _weights += proposals[id].signers[_signers.at(i)];
        }
        return _weights;
    }

    function signers() public view returns (address[] memory) {
        address[] memory values = new address[](_signers.length());
        for (uint256 i = 0; i < _signers.length(); ++i) {
            values[i] = _signers.at(i);
        }
        return values;
    }

    function isSigner(address signer) public view returns (bool) {
        return _signers.contains(signer);
    }
}
