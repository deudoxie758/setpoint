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

    const result = await suggestTags(["data:image/jpeg;base64,AAA"]);

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

    await suggestTags(["data:image/jpeg;base64,AAA", "data:image/jpeg;base64,BBB"]);

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

  it("throws when the model returns an out-of-enum skill", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          input: { skill: "NOT_A_SKILL", outcome: "POINT_WON", confidence: 0.5, rationale: "x" },
        },
      ],
    });

    await expect(suggestTags(["data:image/jpeg;base64,AAA"])).rejects.toThrow();
  });

  it("throws when no tool_use block is present in the response", async () => {
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: "I'm not sure." }] });

    await expect(suggestTags(["data:image/jpeg;base64,AAA"])).rejects.toThrow();
  });
});
