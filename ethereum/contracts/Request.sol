pragma solidity ^0.4.17;

/**
 * @title SafeMath
 * @dev Math operations with safety checks that throw on error
 */
library SafeMath {

    /**
    * @dev Multiplies two numbers, throws on overflow.
    */
    function mul(uint256 a, uint256 b) internal pure returns (uint256 c) {
        if (a == 0) {
            return 0;
        }
        c = a * b;
        assert(c / a == b);
        return c;
    }

    /**
    * @dev Integer division of two numbers, truncating the quotient.
    */
    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        // assert(b > 0); // Solidity automatically throws when dividing by 0
        // uint256 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold
        return a / b;
    }

    /**
    * @dev Subtracts two numbers, throws on overflow (i.e. if subtrahend is greater than minuend).
    */
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        assert(b <= a);
        return a - b;
    }

    /**
    * @dev Adds two numbers, throws on overflow.
    */
    function add(uint256 a, uint256 b) internal pure returns (uint256 c) {
        c = a + b;
        assert(c >= a);
        return c;
    }
}

contract RequestFactory {
    address[] public requests;

    function createRequest(string title, string description, uint256 requiredAmount, uint256 expiresAt) public {
        address newRequest = new Request(title, description, requiredAmount, expiresAt, msg.sender);

        requests.push(newRequest);
    }

    function getRequests() public view returns (address[]) {
        return requests;
    }
}

contract Request {

    using SafeMath for uint256;

    string public title;
    string public description;

    uint256 public requiredAmount;

    uint256 public expiresAt;

    uint256 public weiRaised;

    address public owner;

    mapping(address => uint256) public patrons;


    function Request(string _title, string _description, uint256 _requiredAmount, uint256 _expiresAt, address _owner) public {
        require(_expiresAt > now);
        require(_requiredAmount > 0);

        title = _title;
        description = _description;
        requiredAmount = _requiredAmount;
        expiresAt = _expiresAt;
        owner = _owner;
        weiRaised = 0;

    }

    function donate() public payable {
        require(!hasReachedLimit());
        require(!hasExpired());

        weiRaised = weiRaised.add(msg.value);
        patrons[msg.sender] = patrons[msg.sender].add(msg.value);
    }

    function hasReachedLimit() public view returns (bool) {
        return weiRaised >= requiredAmount;
    }

    function hasExpired() public view returns (bool) {
        return now >= expiresAt;
    }

    function refund() public {
        require(patrons[msg.sender] != 0);
        require(!hasReachedLimit());
        require(hasExpired());

        msg.sender.transfer(patrons[msg.sender]);

        patrons[msg.sender] = 0;
    }

    function getMoney() public {
        require(msg.sender == owner);
        require(hasReachedLimit());

        msg.sender.transfer(this.balance);
    }
}