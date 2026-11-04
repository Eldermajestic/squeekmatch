// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {SqueekMatchEscrow} from "../src/SqueekMatchEscrow.sol";
import {DeploySqueekMatchEscrow} from "../script/DeploySqueekMatchEscrow.s.sol";

contract DeploySqueekMatchEscrowTest is Test {
    function test_deploy_setsArguments() public {
        DeploySqueekMatchEscrow script = new DeploySqueekMatchEscrow();
        address nft = makeAddr("nft");
        address sqk = makeAddr("sqk");
        SqueekMatchEscrow escrow = script.deploy(nft, sqk, 10);
        assertEq(address(escrow.SQUEEK()), nft);
        assertEq(address(escrow.SQK()), sqk);
        assertEq(escrow.MAXIMUM_LEVEL(), 10);
    }
}
