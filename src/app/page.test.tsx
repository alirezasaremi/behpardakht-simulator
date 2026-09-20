import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("home page", () => {
  it("identifies the local simulator and its credential warning", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: "Unofficial Behpardakht Payment Gateway Simulator" })).toBeInTheDocument();
    expect(screen.getByText(/No real payment occurs/i)).toBeInTheDocument();
    expect(screen.getByText(/Never enter real card/i)).toBeInTheDocument();
  });
});
