type CreateResponseInput = {
  apiKey: string;
  model: string;
  instructions: string;
  input: unknown;
  schemaName: string;
  schema: Record<string, unknown>;
};

export async function createStructuredResponse<T>(input: CreateResponseInput): Promise<T> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      instructions: input.instructions,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify(input.input),
            },
          ],
        },
      ],
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: input.schemaName,
          schema: input.schema,
          strict: true,
        },
      },
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(`OpenAI API error ${response.status}: ${JSON.stringify(payload)}`);
  }

  const responseText = extractResponseText(payload);

  if (!responseText) {
    throw new Error(`OpenAI API response did not contain output text: ${JSON.stringify(payload)}`);
  }

  return JSON.parse(responseText) as T;
}

function extractResponseText(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  if ("output_text" in payload && typeof payload.output_text === "string") {
    return payload.output_text;
  }

  if (!("output" in payload) || !Array.isArray(payload.output)) {
    return undefined;
  }

  const textParts: string[] = [];

  for (const item of payload.output) {
    if (!item || typeof item !== "object" || !("content" in item) || !Array.isArray(item.content)) {
      continue;
    }

    for (const content of item.content) {
      if (!content || typeof content !== "object") {
        continue;
      }

      if ("text" in content && typeof content.text === "string") {
        textParts.push(content.text);
      }
    }
  }

  return textParts.join("").trim() || undefined;
}
