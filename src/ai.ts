import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "node:fs/promises";
import path from "node:path";

const readSystemPrompt = async () => {
	const systemPrompt = await readFile(
		path.join(__dirname, "prompts", "system.md"),
		"utf8",
	);
	return systemPrompt;
};

const anthropic = new Anthropic({
	apiKey: process.env.ANTHROPIC_API_KEY,
});

export const createDrawing = async (subject: string) => {
	const systemPrompt = await readSystemPrompt();
	const msg = await anthropic.messages.create({
		model: "claude-3-7-sonnet-latest",
		max_tokens: 20000,
		temperature: 1,
		system: systemPrompt,
		messages: [
			{
				role: "user",
				content: [
					{
						type: "text",
						text: subject,
					},
				],
			},
		],
	});

	const response =
		msg.content[0].type === "text" ? msg.content[0].text : undefined;

	const drawingTextRaw = response?.match(/```([\s\S]*?)```/)?.[1];

	const lines = drawingTextRaw
		?.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !line.startsWith(";"));

	return { drawing: { lines }, response };
};
