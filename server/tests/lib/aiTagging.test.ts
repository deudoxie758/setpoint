const mockCreate = jest.fn();

jest.mock("@anthropic-ai/sdk", () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }));
});

import { suggestTags } from "../../src/lib/aiTagging";

describe("suggestTags", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("parses a valid tool_use response into a typed suggestion", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          input: {
            skill: "SPIKE",
            outcome: "POINT_WON",
            confidence: 0.82,
            rationale: "Player jumps and strikes the ball over the net.",
          },
        },
      ],
    });

    const result = await suggestTags(["data:image/jpeg;base64,AAA"], { jerseyColor: "white" });

    expect(result).toEqual({
      skill: "SPIKE",
      outcome: "POINT_WON",
      confidence: 0.82,
      rationale: "Player jumps and strikes the ball over the net.",
    });
  });

  it("sends each frame as a base64 image block plus one text block", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          input: { skill: "SERVE", outcome: "NO_POINT", confidence: 0.4, rationale: "Serve in progress." },
        },
      ],
    });

    await suggestTags(["data:image/jpeg;base64,AAA", "data:image/jpeg;base64,BBB"], { jerseyColor: "white" });

    const call = mockCreate.mock.calls[0][0];
    const content = call.messages[0].content;
    expect(content).toHaveLength(3); // 2 images + 1 text
    expect(content[0]).toEqual({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: "AAA" },
    });
    expect(content[1].source.data).toBe("BBB");
    expect(content[2].type).toBe("text");
  });

  it("includes the jersey color and number in the prompt when both are provided", async () => {
    mockCreate.mockResolvedValue({
      content: [
        { type: "tool_use", input: { skill: "BLOCK", outcome: "POINT_WON", confidence: 0.9, rationale: "x" } },
      ],
    });

    await suggestTags(["data:image/jpeg;base64,AAA"], { jerseyColor: "red", jerseyNumber: "7" });

    const call = mockCreate.mock.calls[0][0];
    const textBlock = call.messages[0].content.find((b: { type: string }) => b.type === "text");
    expect(textBlock.text).toContain("red");
    expect(textBlock.text).toContain("7");
  });

  it("includes skill definitions in the prompt to disambiguate adjacent skills like BLOCK vs DIG", async () => {
    mockCreate.mockResolvedValue({
      content: [
        { type: "tool_use", input: { skill: "BLOCK", outcome: "POINT_WON", confidence: 0.9, rationale: "x" } },
      ],
    });

    await suggestTags(["data:image/jpeg;base64,AAA"], { jerseyColor: "red", jerseyNumber: "5" });

    const call = mockCreate.mock.calls[0][0];
    const textBlock = call.messages[0].content.find((b: { type: string }) => b.type === "text");
    expect(textBlock.text).toContain("hands above the net");
    expect(textBlock.text).toContain("back row");
  });

  it("clarifies the directional distinction between SPIKE (own team's set) and BLOCK (intercepting an incoming attack)", async () => {
    mockCreate.mockResolvedValue({
      content: [
        { type: "tool_use", input: { skill: "BLOCK", outcome: "POINT_WON", confidence: 0.9, rationale: "x" } },
      ],
    });

    await suggestTags(["data:image/jpeg;base64,AAA"], { jerseyColor: "red", jerseyNumber: "5" });

    const call = mockCreate.mock.calls[0][0];
    const textBlock = call.messages[0].content.find((b: { type: string }) => b.type === "text");
    expect(textBlock.text).toContain("set up by their own teammate");
    expect(textBlock.text).toContain("incoming attack");
  });

  it("includes the player's team position in the prompt when provided", async () => {
    mockCreate.mockResolvedValue({
      content: [
        { type: "tool_use", input: { skill: "BLOCK", outcome: "POINT_WON", confidence: 0.9, rationale: "x" } },
      ],
    });

    await suggestTags(["data:image/jpeg;base64,AAA"], { jerseyColor: "red", jerseyNumber: "5", position: "Middle Blocker" });

    const call = mockCreate.mock.calls[0][0];
    const textBlock = call.messages[0].content.find((b: { type: string }) => b.type === "text");
    expect(textBlock.text).toContain("Middle Blocker");
  });

  it("omits position from the prompt when not provided", async () => {
    mockCreate.mockResolvedValue({
      content: [
        { type: "tool_use", input: { skill: "SERVE", outcome: "NO_POINT", confidence: 0.6, rationale: "x" } },
      ],
    });

    await suggestTags(["data:image/jpeg;base64,AAA"], { jerseyColor: "white" });

    const call = mockCreate.mock.calls[0][0];
    const textBlock = call.messages[0].content.find((b: { type: string }) => b.type === "text");
    expect(textBlock.text).not.toContain("team position is");
  });

  it("includes the jersey color without a number when jerseyNumber is not provided", async () => {
    mockCreate.mockResolvedValue({
      content: [
        { type: "tool_use", input: { skill: "SERVE", outcome: "NO_POINT", confidence: 0.6, rationale: "x" } },
      ],
    });

    await suggestTags(["data:image/jpeg;base64,AAA"], { jerseyColor: "white" });

    const call = mockCreate.mock.calls[0][0];
    const textBlock = call.messages[0].content.find((b: { type: string }) => b.type === "text");
    expect(textBlock.text).toContain("white");
    expect(textBlock.text).not.toContain("number");
  });

  it("throws when the model returns an out-of-enum skill", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          input: { skill: "NOT_A_SKILL", outcome: "POINT_WON", confidence: 0.5, rationale: "x" },
        },
      ],
    });

    await expect(suggestTags(["data:image/jpeg;base64,AAA"], { jerseyColor: "white" })).rejects.toThrow();
  });

  it("throws when no tool_use block is present in the response", async () => {
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: "I'm not sure." }] });

    await expect(suggestTags(["data:image/jpeg;base64,AAA"], { jerseyColor: "white" })).rejects.toThrow();
  });
});
