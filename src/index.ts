import { Hono } from "hono";
import { SerialAdapter } from "./SerialAdapter";
import { serve } from "@hono/node-server";
import { createDrawing } from "./ai";

const vendorId = process.env.VENDOR_ID;
const productId = process.env.PRODUCT_ID;

if (!vendorId || !productId) {
	throw new Error("VENDOR_ID and PRODUCT_ID must be set");
}

const serialAdapter = new SerialAdapter();

const run = async () => {
	await serialAdapter.init(vendorId, productId);
	await serialAdapter.write(["G28"]);
};

run();

const app = new Hono();
app.get("/", (c) => c.text("Hello!"));

app.get("/status", (c) => {
	if (!serialAdapter.ready) {
		return c.json({ status: "not initialized" }, 500);
	}

	return c.json({ status: "initialized" });
});

app.post("/send", async (c) => {
	if (!serialAdapter.ready) {
		return c.json({ status: "not initialized" }, 500);
	}

	const { data } = await c.req.json();
	try {
		await serialAdapter.write(data);
		return c.json({ status: "success" });
	} catch (error) {
		return c.json({ status: "error", error: (error as Error).message }, 500);
	}
});

app.post("/home", async (c) => {
	if (!serialAdapter.ready) {
		return c.json({ status: "not initialized" }, 500);
	}

	try {
		await serialAdapter.write(["G28"]);
		return c.json({ status: "success" });
	} catch (error) {
		return c.json({ status: "error", error: (error as Error).message }, 500);
	}
});

app.post("/stop", async (c) => {
	if (!serialAdapter.ready) {
		return c.json({ status: "not initialized" }, 500);
	}

	try {
		await serialAdapter.write(["M112"]);
		return c.json({ status: "success" });
	} catch (error) {
		return c.json({ status: "error", error: (error as Error).message }, 500);
	}
});

app.post("/prompt", async (c) => {
	if (!serialAdapter.ready) {
		return c.json({ status: "not initialized" }, 500);
	}

	const { prompt } = await c.req.json();
	const response = await createDrawing(prompt);

	if (!response.drawing.lines) {
		return c.json({ status: "error", error: "No drawing lines" }, 500);
	}

	try {
		const program = [
			"G0 Z5",
			...response.drawing.lines,
			"G0 Z5",
			"M400",
			"M118 E1 DONE_DRAWING",
		];
		await serialAdapter.write(program);
		return c.json({ status: "success" });
	} catch (error) {
		return c.json({ status: "error", error: (error as Error).message }, 500);
	}
});

serve({ fetch: app.fetch, port: 3123 });
