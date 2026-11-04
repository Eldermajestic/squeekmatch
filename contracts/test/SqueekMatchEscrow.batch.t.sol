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

contract SqueekMatchEscrowBatchBidTest is SqueekMatchEscrowTestBase {
    function test_createBids_opensEachAndEscrowsTotal() public {
        uint256 before = sqk.balanceOf(alice);
        vm.prank(alice);
        uint256 first = escrow.createBids(1, false, 5 ether, 3, 0);
        assertEq(sqk.balanceOf(alice), before - 15 ether);
        assertEq(sqk.balanceOf(address(escrow)), 15 ether);
        for (uint256 i; i < 3; ++i) assertTrue(escrow.isOpen(first + i));
        vm.prank(bob);
        escrow.fillBid(first + 1, B1);
        assertEq(nft.ownerOf(B1), alice);
        vm.prank(alice);
        escrow.cancelBid(first);
        assertEq(sqk.balanceOf(address(escrow)), 5 ether);
        _assertNoSqkLost();
    }

    function test_createBids_rejectsBadInput() public {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(SqueekMatchEscrow.BatchSize.selector, 0, 20));
        escrow.createBids(1, false, 1 ether, 0, 0);
        vm.expectRevert(abi.encodeWithSelector(SqueekMatchEscrow.BatchSize.selector, 21, 20));
        escrow.createBids(1, false, 1 ether, 21, 0);
        vm.expectRevert(SqueekMatchEscrow.ZeroAmount.selector);
        escrow.createBids(1, false, 0, 2, 0);
        vm.expectRevert(SqueekMatchEscrow.InvalidLevel.selector);
        escrow.createBids(10, true, 1 ether, 2, 0);
        vm.stopPrank();
    }
}
