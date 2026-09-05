// Simple D Flip-Flop with synchronous active-high reset
module dff (
    input  wire clk,
    input  wire rst,
    input  wire d,
    output reg  q
);

    always @(posedge clk) begin
        if (rst) begin
            q <= 1'b0;
        end else begin
            q <= d;
        end
    end

endmodule
