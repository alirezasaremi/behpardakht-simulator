import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RootLayout from "./layout";
import Home from "./page";

describe("home page", () => {
  it("identifies the local simulator and its credential warning", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: "شبیه‌ساز غیررسمی درگاه پرداخت Behpardakht" })).toBeInTheDocument();
    expect(screen.getByText(/هیچ پرداخت واقعی انجام نمی‌شود/)).toBeInTheDocument();
    expect(screen.getByText(/هرگز شمارهٔ کارت/)).toBeInTheDocument();
  });

  it("declares Persian RTL document root", () => {
    expect(renderToStaticMarkup(RootLayout({ children: <div />, params: Promise.resolve({}) }))).toContain('<html lang="fa" dir="rtl"');
  });
});
