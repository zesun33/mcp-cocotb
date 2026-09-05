import cocotb
from cocotb.clock import Clock
from cocotb.triggers import RisingEdge, Timer

@cocotb.test()
async def test_dff_reset(dut):
    """Test that reset initializes output q to 0."""
    clock = Clock(dut.clk, 10, units="ns")
    cocotb.start_soon(clock.start())

    dut.rst.value = 1
    dut.d.value = 1
    await RisingEdge(dut.clk)
    await RisingEdge(dut.clk)

    assert dut.q.value == 0, f"Expected q=0 during reset, got {dut.q.value}"
    dut._log.info("Reset test passed.")

@cocotb.test()
async def test_dff_toggle(dut):
    """Test data propagation when reset is deasserted."""
    clock = Clock(dut.clk, 10, units="ns")
    cocotb.start_soon(clock.start())

    dut.rst.value = 0
    dut.d.value = 1
    await RisingEdge(dut.clk)
    await Timer(1, units="ns")

    assert dut.q.value == 1, f"Expected q=1 after clock edge, got {dut.q.value}"

    dut.d.value = 0
    await RisingEdge(dut.clk)
    await Timer(1, units="ns")

    assert dut.q.value == 0, f"Expected q=0 after clock edge, got {dut.q.value}"
    dut._log.info("Toggle test passed.")

@cocotb.test(expect_fail=False)
async def test_dff_failing_assert(dut):
    """Intentional assertion failure for testing error triage."""
    clock = Clock(dut.clk, 10, units="ns")
    cocotb.start_soon(clock.start())

    dut.rst.value = 1
    dut.d.value = 0
    await RisingEdge(dut.clk)
    await Timer(1, units="ns")

    # Intentional assertion failure: q should be 0, but we assert 1
    assert dut.q.value == 1, "INTENTIONAL_ASSERTION_FAILURE: Expected q=1, but reset forced q=0"
