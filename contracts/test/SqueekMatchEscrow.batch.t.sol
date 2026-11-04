// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {SqueekMatchEscrowTestBase} from "./SqueekMatchEscrow.t.sol";
import {SqueekMatchEscrow} from "../src/SqueekMatchEscrow.sol";

contract SqueekMatchEscrowBatchTest is SqueekMatchEscrowTestBase {
    function _askIds() internal returns (uint256[] memory ids) {
        ids = new uint256[](2);
        vm.startPrank(alice);
        ids[0] = escrow.createAsk(A1, 10 ether, 0);
        ids[1] = escrow.createAsk(A2, 20 ether, 0);
        vm.stopPrank();
    }

    function test_fillAsks_buysAll() public {
        uint256[] memory ids = _askIds();
        uint256 before = sqk.balanceOf(bob);
        vm.prank(bob);
        escrow.fillAsks(ids);
        assertEq(nft.ownerOf(A1), bob);
        assertEq(nft.ownerOf(A2), bob);
        assertEq(sqk.balanceOf(bob), before - 30 ether);
        _assertNoSqkLost();
    }

    function test_fillAsks_isAtomic() public {
        uint256[] memory ids = _askIds();
        vm.prank(alice);
        escrow.cancelAsk(ids[1]);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(SqueekMatchEscrow.OrderNotOpen.selector, ids[1]));
        escrow.fillAsks(ids);
        assertEq(nft.ownerOf(A1), alice);
    }

    function test_fillAsks_rejectsBadSize() public {
        uint256[] memory none = new uint256[](0);
        vm.expectRevert(abi.encodeWithSelector(SqueekMatchEscrow.BatchSize.selector, 0, 20));
        escrow.fillAsks(none);
        uint256[] memory many = new uint256[](21);
        vm.expectRevert(abi.encodeWithSelector(SqueekMatchEscrow.BatchSize.selector, 21, 20));
        escrow.fillAsks(many);
    }

    function test_fillAsks_duplicateIdReverts() public {
        uint256[] memory ids = _askIds();
        ids[1] = ids[0];
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(SqueekMatchEscrow.OrderNotOpen.selector, ids[0]));
        escrow.fillAsks(ids);
    }
}
