// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script} from "forge-std/Script.sol";
import {SqueekMatchEscrow} from "../src/SqueekMatchEscrow.sol";

contract DeploySqueekMatchEscrow is Script {
    function deploy(address squeekNft, address sqk, uint8 maximumLevel) public returns (SqueekMatchEscrow escrow) {
        escrow = new SqueekMatchEscrow(squeekNft, sqk, maximumLevel);
    }

    function run() external returns (SqueekMatchEscrow escrow) {
        address nft = vm.envAddress("SQUEEK_NFT");
        address sqk = vm.envAddress("SQK_TOKEN");
        uint8 maxLevel = uint8(vm.envOr("MAX_LEVEL", uint256(10)));
        vm.startBroadcast();
        escrow = deploy(nft, sqk, maxLevel);
        vm.stopBroadcast();
    }
}
