import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("Home page", () => {
  it("renders a placeholder", () => {
    render(<Home />);
    expect(screen.getByText("Clip library coming soon.")).toBeInTheDocument();
  });
});
