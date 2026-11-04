// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {SqueekMatchEscrow} from "../../src/SqueekMatchEscrow.sol";
import {ISqueekNFT} from "../../src/interfaces/ISqueekchain.sol";

contract LiveSepoliaTest is Test {
    function test_live_reads() public {
        string memory rpc = vm.envOr("SEPOLIA_RPC", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
        address nft = vm.envAddress("SQUEEK_NFT");
        address sqk = vm.envAddress("SQK_TOKEN");
        uint256 id = vm.envUint("PROBE_TOKEN");
        SqueekMatchEscrow escrow = new SqueekMatchEscrow(nft, sqk, 10);
        uint8 lvl = escrow.levelOf(id);
        assertGt(lvl, 0);
        assertEq(lvl, ISqueekNFT(nft).level(id));
        escrow.isMergeReady(id);
        assertEq(escrow.levelOf(type(uint256).max), 0);
    }
}
